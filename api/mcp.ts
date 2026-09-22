import { handleBody, TOOLS, SERVER_INFO } from './_lib/core.ts'
import { AuthError, openSupabaseDb } from './_lib/supabaseDb.ts'

/**
 * The agent connector: an MCP server (JSON-RPC over HTTP) that an agent adds
 * by URL, and the same tools as plain JSON for anything that can POST.
 *
 *   POST /api/mcp            MCP messages, or {"tool": "...", "args": {...}}
 *   GET  /api/mcp            what this is and how to call it
 *
 * Sign-in is the coach's own email and password as HTTP Basic auth, sent
 * over HTTPS. Nothing is stored server-side; each call signs in afresh.
 */

export async function GET(req: Request) {
  const origin = new URL(req.url).origin
  return json(200, {
    ...SERVER_INFO,
    endpoint: `${origin}/api/mcp`,
    auth: 'HTTP Basic: the planner email and password',
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

export async function POST(req: Request) {
  const url = new URL(req.url)
  const creds = credentials(req)
  if (!creds) {
    return json(401, { error: 'Sign in with HTTP Basic auth: the planner email and password' }, { 'WWW-Authenticate': 'Basic realm="lesson planner"' })
  }

  let body: unknown
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
    return json(500, { error: e instanceof Error ? e.message : String(e) })
  }
}

function credentials(req: Request): { email: string; password: string } | null {
  const header = req.headers.get('authorization') ?? ''
  const basic = /^Basic\s+(.+)$/i.exec(header)?.[1]
  if (!basic) return null
  const decoded = Buffer.from(basic, 'base64').toString('utf8')
  const at = decoded.indexOf(':')
  if (at <= 0) return null
  return { email: decoded.slice(0, at), password: decoded.slice(at + 1) }
}

function json(status: number, data: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  })
}
