import { timingSafeEqual } from 'node:crypto'
import { errorMessage, handleBody, TOOLS, SERVER_INFO } from './_lib/core.js'
import { AuthError, openSupabaseDb } from './_lib/supabaseDb.js'

/**
 * The agent connector: an MCP server (JSON-RPC over HTTP) that an agent adds
 * by URL, and the same tools as plain JSON for anything that can POST.
 *
 *   POST /api/mcp            MCP messages, or {"tool": "...", "args": {...}}
 *   GET  /api/mcp            what this is and how to call it
 *
 * Two ways to sign in, both over HTTPS, nothing stored server-side:
 *   - Authorization: Bearer <MCP_API_KEY>   the agent's key; the server then
 *     signs into Supabase with MCP_USER_EMAIL / MCP_USER_PASSWORD (Vercel env)
 *   - Authorization: Basic base64(email:password)   the coach's own login
 */

/** @param {Request} req */
export async function GET(req) {
  const origin = new URL(req.url).origin
  return json(200, {
    ...SERVER_INFO,
    endpoint: `${origin}/api/mcp`,
    auth: {
      bearer: process.env.MCP_API_KEY ? 'Authorization: Bearer <MCP_API_KEY>' : 'not configured (set MCP_API_KEY, MCP_USER_EMAIL, MCP_USER_PASSWORD on Vercel)',
      basic: 'Authorization: Basic base64(email:password), the planner login',
    },
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    example: {
      tool: 'create_lesson',
      args: {
        student_id: '<id from list_students>',
        positions: [{ fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', answer: 'Rd8#', note: 'Back rank.' }],
      },
    },
  })
}

/** @param {Request} req */
export async function POST(req) {
  const url = new URL(req.url)
  const creds = credentials(req)
  if (creds === 'bad-key') return json(401, { error: 'That bearer key is not the MCP_API_KEY set on the server' })
  if (!creds) {
    return json(
      401,
      { error: 'Sign in with Authorization: Bearer <MCP_API_KEY>, or HTTP Basic with the planner email and password' },
      { 'WWW-Authenticate': 'Bearer realm="lesson planner", Basic realm="lesson planner"' },
    )
  }

  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Body must be JSON' })
  }

  try {
    const db = await openSupabaseDb(creds.email, creds.password)
    const { status, json: out } = await handleBody(body, { db, appOrigin: url.origin })
    return status === 202 ? new Response(null, { status }) : json(status, out)
  } catch (e) {
    if (e instanceof AuthError) return json(401, { error: `Sign-in failed: ${e.message}` })
    return json(500, { error: errorMessage(e) })
  }
}

/**
 * Who is calling: the bearer key maps to the coach's login kept in Vercel's
 * environment; Basic auth carries the login itself.
 * @param {Request} req
 * @returns {{ email: string, password: string } | 'bad-key' | null}
 */
function credentials(req) {
  const header = req.headers.get('authorization') ?? ''
  const bearer = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim()
  if (bearer) {
    const key = process.env.MCP_API_KEY
    const email = process.env.MCP_USER_EMAIL
    const password = process.env.MCP_USER_PASSWORD
    if (!key || !email || !password || !sameSecret(bearer, key)) return 'bad-key'
    return { email, password }
  }
  const basic = /^Basic\s+(.+)$/i.exec(header)?.[1]
  if (!basic) return null
  const decoded = Buffer.from(basic, 'base64').toString('utf8')
  const at = decoded.indexOf(':')
  if (at <= 0) return null
  return { email: decoded.slice(0, at), password: decoded.slice(at + 1) }
}

/** Constant-time comparison, so a wrong key takes as long as a right one. */
function sameSecret(a, b) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * @param {number} status
 * @param {unknown} data
 * @param {Record<string, string>} [extra]
 */
function json(status, data, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  })
}
