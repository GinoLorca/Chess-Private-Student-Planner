---
name: agent-connector
description: Build a connector so an AI agent (Muse, Claude, a scheduled bot, any tool-calling assistant) can read and write a web app's data without a browser. Produces an MCP server over HTTP that also answers plain JSON, served from the app's own repo (a Vercel function), signed in with a bearer key that stands for the owner's login. Use this whenever someone wants an agent or automation to "add things to my app", "log in and enter data for me", "have a connector", "use MCP", "give the bot an API key", or is already driving the app's UI through a browser agent and it keeps breaking, even if they never say "API" or "connector".
---

# Agent connector for a web app

The job: let an agent do, in one call, what the owner does by hand in the app.
The agent doesn't get the owner's password and doesn't drive a browser. It gets
a URL, a key, and three to five verbs.

This skill came out of building one for a chess lesson planner (React + Vite on
Vercel, Supabase behind it) so a "Muse" agent could create lessons from FENs.
The traps below all bit for real. Read `references/pitfalls.md` before you
start, then `references/template.md` for the code skeleton.

## Step 1: decide the verbs

Look at what the owner does in the UI for the task the agent will take over,
and name it as three to five tools. Fewer is better: an agent reasons well over
a short list with clear names. A good set is: one or two `list_*` calls so the
agent can find ids, one `create_*` that does the whole job, one `add_*` to
append to something existing.

For each tool write the input as the owner would describe it, not as the
database stores it. Inputs like `{ fen, answer, note, source_url }` read well
to an agent; `{ starting_fen, solution_jsonb, summary }` do not. Do the mapping
server-side, and validate the domain data there too (a FEN parses, a move line
replays legally), so the agent gets a sentence back instead of a silent bad
row. Say in each tool description what happens to fields the agent leaves
blank, so it knows it can hand off partial work.

Return links, not just ids: the agent will paste them to the owner.

## Step 2: one endpoint, two dialects

Serve `POST /api/mcp` as a stateless MCP server (JSON-RPC 2.0 over HTTP:
`initialize`, `ping`, `tools/list`, `tools/call`; notifications get a 202 with
no body). Also accept `{ "tool": "...", "args": {...} }` on the same URL for
agents that can't speak MCP but can POST JSON. Same tools, same code path, so
there is one thing to test and document.

`GET /api/mcp` describes itself: name, version, the live commit, how to sign
in, the tool list, one example call. This is the owner's smoke test and the
agent's first read. Put the commit in it from the host's env (Vercel sets
`VERCEL_GIT_COMMIT_SHA`) and bump the version on every fix, or nobody can tell
whether a deploy landed. This single line saved an hour.

## Step 3: sign-in the agent can actually do

Offer a bearer key first. Many agent platforms refuse username+password
schemes and can't build a Basic header from a vault, but can store one API
token. The key is an env var on the host (`MCP_API_KEY`), compared in
constant time, and it stands for the owner's login kept in two more env vars
(`MCP_USER_EMAIL`, `MCP_USER_PASSWORD`). The server signs into the app's auth
with those, so every query runs under the same row-level security as the app.
Nothing is stored server-side beyond those settings; revoking is "change the
key, redeploy".

Keep Basic auth with the owner's own login as a second option for a terminal
test. Never accept credentials in the URL (they end up in logs), and don't add
open CORS headers: agents call server to server.

## Step 4: host it inside the app

Put the function in the app's repo (`api/mcp.js` on Vercel, helpers in
`api/_lib/`), so it deploys with the app and reuses the env it already has
(`VITE_SUPABASE_URL` etc. are ordinary env vars to the function). Write it in
plain JavaScript with `.js` import specifiers and no build step. TypeScript
with `.ts` imports crashed on deploy with `FUNCTION_INVOCATION_FAILED` on
every request, before auth even ran, and there is no error to read; plain JS
removes the whole class.

Separate the pure core (protocol framing, tool dispatch, validation) from the
storage adapter behind a small `Db` interface. The core is then testable with
an in-memory store and no network, which matters because you usually can't
reach the live host from where you're writing the code.

## Step 5: make errors readable

Some clients (Supabase's) throw plain objects, not `Error`s. `String(e)` turns
them into `"[object Object]"` and hides the real message, which for us was
"column lesson_plans.status does not exist", a missing migration. Wrap every
storage error into a real `Error` that names the step and keeps message,
details, hint and code. Tool failures go back as MCP results with
`isError: true`, not protocol errors, so the agent can read them and tell the
owner. Prefer a few flat queries over one nested join: easier to attribute
when they fail. Where a column comes from a recent migration, tolerate its
absence if cheap (omit it on insert, retry the select without it).

## Step 6: test before pushing

Two scripts, both offline:

- core: MCP handshake, `tools/list`, each tool against an in-memory `Db`,
  validation errors become `isError` results with nothing written, batch and
  malformed bodies.
- http: the handler with real `Request` objects: GET describes itself, POST
  without auth is 401 with a `WWW-Authenticate` header, wrong key is 401,
  bad JSON is 400, right key reaches storage.

Run them with plain `node` against the shipped `.js` files (a `.mts` test can
import them with `--experimental-strip-types`).

## Step 7: hand-off, two audiences

For the owner, in the deploy guide: the three env vars, that a redeploy is
needed after adding them, and the GET check ("if the page shows
`Bearer <MCP_API_KEY>` the key is live; if it says not configured, redeploy").
Give them a key rather than asking them to generate one, and say it can be
swapped any time.

For the agent, a block it can be handed verbatim: the URL, "Bearer token",
the tool names, the field mapping from their data to the tool's inputs, a
curl example, and a one-line brief ("call list_students to find the student,
then create_lesson with ..., reply with the link").

Expect the agent to relay errors word for word, and design the messages for
that reader. "Saving positions: column puzzles.done does not exist [42703]"
told the agent, and then the owner, exactly what to run.

## When something fails after deploy

Work down this ladder; each rung has a distinct signature.

| Symptom | Cause | Fix |
|---|---|---|
| `FUNCTION_INVOCATION_FAILED` on GET and POST alike | runtime can't load the module (`.ts` imports, bad export shape) | plain JS, `.js` specifiers, `export async function GET/POST(request)` |
| `"[object Object]"` in the error | a thrown non-Error stringified | wrap storage errors (Step 5) |
| `column X does not exist` | a migration was never run | give the owner the SQL to paste; say the "destructive operations" warning is the `drop ... if exists` guard, safe to run |
| agent says it can't use Basic / can't read the vault | platform refuses password schemes | bearer key (Step 3) |
| owner opens `/api/...` and sees the app | the app's service worker's navigate fallback | denylist `/^\/api\//` in the PWA config |
| "did the fix deploy?" | nothing distinguishes builds | version bump + commit stamp on GET (Step 2) |
| agent's data doesn't fit the UI's parser | it types "FEN then moves" into a FEN field | make the domain parser find the value inside the line and treat the rest as the natural next field |
