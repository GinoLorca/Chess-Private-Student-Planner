# Pitfalls, in the order they showed up

Each of these cost a deploy cycle with a non-technical owner relaying
messages between two agents. The signature is what to recognise them by.

## 1. The function crashes before it runs

Signature: `500 FUNCTION_INVOCATION_FAILED` on every method, including GET,
no body, no log line from your code.

Cause: the module failed to load. With Vercel's Node functions this was
TypeScript sources importing each other with `.ts` extensions
(`import x from './_lib/core.ts'`). Locally, with `allowImportingTsExtensions`
and a type-check-only tsconfig, everything passed.

Fix: ship plain JavaScript with `.js` specifiers and nothing to compile. Keep
types as JSDoc if you want them. Verify with `node -e "import('./api/mcp.js')"`
before pushing.

## 2. "[object Object]"

Signature: `{"ok": false, "error": "[object Object]"}`; only some tools fail.

Cause: a library that rejects with a plain object (`{ message, details,
hint, code }`), and a catch block doing `e instanceof Error ? e.message :
String(e)`.

Fix: one `errorMessage(e)` helper that reads `message`/`details`/`hint`/`code`
off objects, plus wrap each storage call's error into a real `Error` that
names the step: `Listing lessons: column lesson_plans.status does not exist
[42703]`.

## 3. The schema isn't what the code thinks

Signature: `column <table>.<col> does not exist`, from a tool that the app's
own UI seemed to cope with (the UI selected `*` and never noticed).

Cause: the owner ran migrations 1 to 3 and 5 but skipped 4. Nobody had checked.

Fix: give them the SQL inline, all pending migrations in one paste, each
statement `if not exists` / `drop ... if exists` so it's safe to re-run. Warn
them that the SQL editor will show a "destructive operations" dialog because
of the `drop ... if exists` guards, and that it's safe. Where it's cheap, make
the connector tolerate the missing column (omit it on insert, retry the
select without it) so the agent isn't blocked on the owner.

## 4. The agent can't do the auth you offered

Signature: the agent says it has no "URL + Basic auth" connector, its
credential flow "declines username+password schemes", and it can't pull the
owner's password out of its vault to build a header.

Fix: bearer key in an env var, standing for the login kept in two more env
vars. The agent stores one token. Keep Basic as a fallback for curl.

## 5. Credentials in the URL

Tempting when the agent "can only set a URL". Don't: URLs land in access
logs, browser history and screenshots. If the platform truly can't set a
header, it also can't be trusted with a scheduled pipeline; push back.

## 6. The owner's browser shows the app at /api/...

Signature: opening the connector URL renders the web app instead of JSON,
but curl and the agent see JSON.

Cause: the app is an installed PWA and its service worker's navigate fallback
serves `index.html` for any navigation, `/api/` included.

Fix: add `/^\/api\//` to `navigateFallbackDenylist` in the PWA config, and
tell the owner a Private window has no service worker for an immediate check.

## 7. Nobody can tell which build is live

Signature: "still crashing", but is that the old deploy or the new one?

Fix: put `VERCEL_GIT_COMMIT_SHA` (first 7 chars) and a version string in the
GET response, and bump the version on each fix. Then the check is "does the
page say 1.0.3 / 73c5f6b".

## 8. The agent's data and the UI's parser disagree

Signature: the agent, driving the UI as a fallback, pastes "FEN then the
moves" into a field that expects a bare FEN; the detector reads move numbers
as PGN and the PGN parser fails on the first character of the FEN.

Fix: in the domain parser, find the value anywhere in the line and treat what
follows as the natural next field (moves after a FEN are the answer). The
agent's format was better than the form's; meet it.

## 9. The vault link

Signature: the agent's own "connect" card says "this connection link is
invalid", and a fresh link comes back identical because the vault dedupes by
provider.

This is the agent platform's problem, not the connector's. Tell the owner to
paste the key in the agent's chat for now and sort the vault out later. Don't
spend the connector's deploy cycles on it.

## 10. "Connection dying mid-response"

The agent's phrasing for a 500 whose body it didn't like, or a function
timeout. Don't diagnose from the phrasing; get the version/commit from GET,
then the exact error text, then the host's function log.
