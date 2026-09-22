# Code skeleton

Three files, plain JavaScript, ESM (`"type": "module"` in package.json).
Vercel treats `api/*.js` as functions and ignores `api/_lib/`. Replace the
tool bodies and the `Db` adapter; keep the shape.

## api/mcp.js (transport + auth)

```js
import { timingSafeEqual } from 'node:crypto'
import { errorMessage, handleBody, TOOLS, SERVER_INFO } from './_lib/core.js'
import { AuthError, openDb } from './_lib/db.js'

export async function GET(req) {
  const origin = new URL(req.url).origin
  return json(200, {
    ...SERVER_INFO,
    build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    endpoint: `${origin}/api/mcp`,
    auth: {
      bearer: process.env.MCP_API_KEY ? 'Authorization: Bearer <MCP_API_KEY>' : 'not configured (set MCP_API_KEY, MCP_USER_EMAIL, MCP_USER_PASSWORD)',
      basic: 'Authorization: Basic base64(email:password)',
    },
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    example: { tool: TOOLS[0].name, args: {} },
  })
}

export async function POST(req) {
  const url = new URL(req.url)
  const creds = credentials(req)
  if (creds === 'bad-key') return json(401, { error: 'That bearer key is not the MCP_API_KEY set on the server' })
  if (!creds) return json(401, { error: 'Sign in with Authorization: Bearer <MCP_API_KEY> or HTTP Basic' }, { 'WWW-Authenticate': 'Bearer, Basic' })
  let body
  try { body = await req.json() } catch { return json(400, { error: 'Body must be JSON' }) }
  try {
    const db = await openDb(creds.email, creds.password)
    const { status, json: out } = await handleBody(body, { db, appOrigin: url.origin })
    return status === 202 ? new Response(null, { status }) : json(status, out)
  } catch (e) {
    if (e instanceof AuthError) return json(401, { error: `Sign-in failed: ${e.message}` })
    return json(500, { error: errorMessage(e) })
  }
}

function credentials(req) {
  const header = req.headers.get('authorization') ?? ''
  const bearer = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim()
  if (bearer) {
    const { MCP_API_KEY: key, MCP_USER_EMAIL: email, MCP_USER_PASSWORD: password } = process.env
    if (!key || !email || !password || !sameSecret(bearer, key)) return 'bad-key'
    return { email, password }
  }
  const basic = /^Basic\s+(.+)$/i.exec(header)?.[1]
  if (!basic) return null
  const decoded = Buffer.from(basic, 'base64').toString('utf8')
  const at = decoded.indexOf(':')
  return at > 0 ? { email: decoded.slice(0, at), password: decoded.slice(at + 1) } : null
}

function sameSecret(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

function json(status, data, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  })
}
```

## api/_lib/core.js (protocol + tools, no I/O)

```js
export const PROTOCOL_VERSION = '2025-03-26'
export const SERVER_INFO = { name: 'my-app', version: '1.0.0' }   // bump on every fix
export class ToolError extends Error {}

export const TOOLS = [
  { name: 'list_things', description: '...', inputSchema: { type: 'object', properties: {} } },
  { name: 'create_thing', description: '... what happens to blank fields ...',
    inputSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } },
]

export function errorMessage(e) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && typeof e.message === 'string') {
    const extra = [e.details, e.hint].filter(Boolean).join(' · ')
    return `${e.message}${extra ? ` (${extra})` : ''}${e.code ? ` [${e.code}]` : ''}`
  }
  return String(e)
}

export async function callTool(name, args, { db, appOrigin }) {
  switch (name) {
    case 'list_things': return { things: await db.listThings() }
    case 'create_thing': {
      if (typeof args.name !== 'string' || !args.name.trim()) throw new ToolError('name is required')
      const t = await db.createThing(args.name.trim())          // validate domain data before writing
      return { id: t.id, url: `${appOrigin}/#/things/${t.id}` }  // links, not just ids
    }
    default: throw new ToolError(`Unknown tool "${name}"`)
  }
}

export async function handleRpc(msg, ctx) {
  const id = msg.id ?? null
  const ok = (result) => ({ jsonrpc: '2.0', id, result })
  if (msg.id === undefined) return null                        // notification → 202
  switch (msg.method) {
    case 'initialize': return ok({ protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO })
    case 'ping': return ok({})
    case 'tools/list': return ok({ tools: TOOLS })
    case 'tools/call':
      try {
        const result = await callTool(String(msg.params?.name ?? ''), msg.params?.arguments ?? {}, ctx)
        return ok({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result })
      } catch (e) {
        return ok({ content: [{ type: 'text', text: errorMessage(e) }], isError: true })   // readable by the agent
      }
    default: return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${msg.method}` } }
  }
}

export async function handleBody(body, ctx) {
  if (body && typeof body === 'object' && 'tool' in body && !('jsonrpc' in body)) {
    try { return { status: 200, json: { ok: true, result: await callTool(body.tool, body.args ?? {}, ctx) } } }
    catch (e) { return { status: e instanceof ToolError ? 400 : 500, json: { ok: false, error: errorMessage(e) } } }
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(m, ctx)))).filter(Boolean)
    return out.length ? { status: 200, json: out } : { status: 202, json: null }
  }
  if (!body || typeof body !== 'object' || body.jsonrpc !== '2.0')
    return { status: 400, json: { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } } }
  const res = await handleRpc(body, ctx)
  return res ? { status: 200, json: res } : { status: 202, json: null }
}
```

## api/_lib/db.js (storage adapter)

```js
import { createClient } from '@supabase/supabase-js'
export class AuthError extends Error {}

export async function openDb(email, password) {
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await sb.auth.signInWithPassword({ email, password })   // as the owner: RLS applies
  if (error) throw new AuthError(error.message)
  return {
    async listThings() {
      const { data, error } = await sb.from('things').select('id, name').order('name')
      if (error) throw describe(error, 'Listing things')
      return data
    },
    async createThing(name) {
      const { data, error } = await sb.from('things').insert({ name }).select('id').single()
      if (error) throw describe(error, 'Creating the thing')
      return data
    },
  }
}

function describe(error, what) {
  const extra = [error.details, error.hint].filter(Boolean).join(' · ')
  return new Error(`${what}: ${error.message}${extra ? ` (${extra})` : ''}${error.code ? ` [${error.code}]` : ''}`)
}
```

## Tests (offline)

```js
// core: in-memory db, no network
const db = { async listThings() { return [{ id: '1', name: 'a' }] }, async createThing(name) { return { id: '2', name } } }
const ctx = { db, appOrigin: 'https://example.test' }
await handleBody({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, ctx)   // 200, serverInfo
await handleBody({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx)       // 202
await handleBody({ tool: 'create_thing', args: {} }, ctx)                            // 400, "name is required"

// http: the handler with Request objects
await POST(new Request('https://x/api/mcp', { method: 'POST', body: '{}' }))          // 401 + WWW-Authenticate
process.env.MCP_API_KEY = 'k'; process.env.MCP_USER_EMAIL = 'e'; process.env.MCP_USER_PASSWORD = 'p'
await POST(new Request('https://x/api/mcp', { method: 'POST', headers: { authorization: 'Bearer wrong' }, body: '{}' })) // 401
```

## Hand-off text for the agent

```
Connector: https://<app>/api/mcp
Auth: Bearer token (the key I'll give you)
Tools: list_things, create_thing
Mapping: my "title" → name
Brief: call list_things to check for duplicates, then create_thing for each item I give you, and reply with the links.
```
