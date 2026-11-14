import { createClient } from '@supabase/supabase-js'
import { ownerOf, paidDoc, sameDoc } from './_lib/paidExport.js'

/**
 * Optional: copies the paid lessons into a JSON file in a private GitHub repository, for another app
 * of the coach's to read (the file's shape: _lib/paidExport.js). The app calls this, signed in, a
 * moment after a lesson is marked paid or unpaid, and at start. It does nothing until two settings
 * are on Vercel (DEPLOY.md, "Paid lessons into a private file"):
 *
 *   PAYMENTS_EXPORT_TOKEN   a fine-grained GitHub token: that one repository, Contents read and write
 *   PAYMENTS_EXPORT_REPO    the repository, "owner/name"
 *   PAYMENTS_EXPORT_PATH    optional: the file, "income/lessons.json" unless set
 *
 *   POST /api/paid-export   Authorization: Bearer <the coach's Supabase access token>
 *
 * The file remembers whose lessons it holds (a hash of the account id), so no other account of the
 * same Supabase project can ever replace it.
 */

const DEFAULT_PATH = 'income/lessons.json'
const GITHUB = 'https://api.github.com'

/** @param {Request} req */
export async function POST(req) {
  const ghToken = process.env.PAYMENTS_EXPORT_TOKEN?.trim()
  const repo = process.env.PAYMENTS_EXPORT_REPO?.trim()
  const path = (process.env.PAYMENTS_EXPORT_PATH?.trim() || DEFAULT_PATH).replace(/^\/+/, '')
  if (!ghToken || !repo) return json(200, { configured: false })
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || !/^[A-Za-z0-9_/.-]+\.json$/.test(path) || path.split('/').includes('..')) {
    return json(500, { error: 'PAYMENTS_EXPORT_REPO must be owner/name and PAYMENTS_EXPORT_PATH a .json path' })
  }

  const jwt = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')?.[1]?.trim()
  if (!jwt) return json(401, { error: 'Sign in first' })
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return json(500, { error: 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set on the server' })

  // Every read runs as the coach, under the same row security as the app.
  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: who, error: authError } = await sb.auth.getUser(jwt)
  if (authError || !who?.user) return json(401, { error: 'The sign-in has expired' })

  const [payments, students] = await Promise.all([
    sb.from('lesson_payments').select('id, student_id, lesson_date, amount, created_at'),
    sb.from('students').select('id, name'),
  ])
  if (payments.error || students.error) return json(502, { error: (payments.error ?? students.error).message })

  const owner = ownerOf(who.user.id)
  const doc = paidDoc(payments.data ?? [], students.data ?? [], owner, new Date().toISOString())
  try {
    const result = await writeFile(ghToken, repo, path, doc)
    return json(result.status, result.body)
  } catch (e) {
    return json(502, { error: e instanceof Error ? e.message : String(e) })
  }
}

/** Write the file when what it says changed; read again and retry when another write got there first. */
async function writeFile(token, repo, path, doc) {
  const target = `${GITHUB}/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await fetch(target, { headers, cache: 'no-store' })
    let sha
    if (current.status === 200) {
      const file = await current.json()
      sha = file.sha
      let old = null
      try {
        old = JSON.parse(Buffer.from(String(file.content ?? ''), 'base64').toString('utf8'))
      } catch {
        old = null
      }
      if (old && old.owner && old.owner !== doc.owner) return { status: 403, body: { error: 'That file holds another account’s lessons' } }
      if (old && sameDoc(old, doc)) return { status: 200, body: { configured: true, written: false, lessons: doc.items.length } }
    } else if (current.status !== 404) {
      return { status: 502, body: { error: `GitHub answered ${current.status} when the file was read` } }
    }
    const put = await fetch(target, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Update',
        content: Buffer.from(`${JSON.stringify(doc, null, 1)}\n`, 'utf8').toString('base64'),
        ...(sha ? { sha } : {}),
      }),
    })
    if (put.ok) return { status: 200, body: { configured: true, written: true, lessons: doc.items.length } }
    if (put.status !== 409 && put.status !== 422) return { status: 502, body: { error: `GitHub answered ${put.status} when the file was written` } }
  }
  return { status: 409, body: { error: 'The file kept changing; the next mark will write it' } }
}

/**
 * @param {number} status
 * @param {unknown} data
 */
function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
