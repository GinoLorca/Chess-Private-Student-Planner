# Going live, step by step

Everything here is done in a web browser on your Mac, except the optional last part (which
needs the Terminal). Budget about 30 minutes. You'll end with the app on your iPad's home screen,
signed in, with Jojo's and Parker's lessons in it.

---

## Part A — Supabase: the database and your login (≈10 min)

1. Go to **https://supabase.com** → **Start your project** → sign up (GitHub or email).
2. **New project**. Name it `lesson-planner`. Set a database password (save it in your
   password manager — you rarely need it, but don't lose it). Region: pick the one closest to
   you. Click **Create new project** and wait a minute for it to spin up.
3. In the left sidebar click **SQL Editor** → **New query**.
4. Open the file `supabase/setup_all.sql` from this repo (on GitHub: browse to it, click
   **Raw**, select all, copy). Paste it into the query box and click **Run**. You should see
   "Success. No rows returned". That created every table and security rule at once.
5. Left sidebar → **Authentication** → **Users** → **Add user** → **Create new user**. Enter
   the email and a password you'll sign in with. Tick **Auto Confirm User**. Click **Create user**.
6. Left sidebar → **Project Settings** (gear) → **API**. Keep this tab open — you need two
   values from it in Part B:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (the long string under *Project API keys*)

## Part B — Vercel: hosting the app (≈10 min)

1. Go to **https://vercel.com** → **Sign Up** → **Continue with GitHub** (use the GitHub
   account that owns this repo).
2. **Add New…** → **Project** → find **Chess-Private-Student-Planner** → **Import**.
   (If Vercel asks to install its GitHub app, allow it for this repo.)
3. On the configure screen:
   - **Framework Preset**: Vite (it should detect this).
   - **Build Command**: `npm run build` · **Output Directory**: `dist` (defaults are fine).
   - Open **Environment Variables** and add two:
     - `VITE_SUPABASE_URL` → the Project URL from Part A step 6
     - `VITE_SUPABASE_ANON_KEY` → the anon public key from Part A step 6
4. Click **Deploy**. About a minute later you get a URL like
   `https://chess-private-student-planner.vercel.app`. Open it and sign in with the user from
   Part A step 5.

   > If the deployment built from the wrong branch (the page looks like the old app), go to
   > the project's **Settings → Git → Production Branch** and set it to
   > `claude/friendly-ritchie-hw1zrk`, then **Deployments → ⋯ → Redeploy**.

## Part C — Import Jojo's and Parker's lessons (≈5 min)

Jojo's file looks the student up by name, so:

1. In the app, add a student named exactly: `Joseph "Jojo" Liu` (straight double quotes).
2. Back in Supabase → **SQL Editor** → **New query**. Paste the contents of
   `supabase/seed_jojo_lessons_1_10.sql` (GitHub → **Raw** → select all → copy) and **Run** —
   once only; running twice duplicates the lessons. Nothing needs editing: with one login
   account the script uses it automatically.
3. New query again, paste `supabase/seed_parker_downing.sql`, **Run** once. This creates
   Parker and his two lessons.
4. Reload the app. Jojo has Lessons 1–10, Parker has 1–2. A few positions show an
   *answer doesn't replay* flag — open each, re-record the answer on the board, done.

## Part D — Put it on the iPad and iPhone (≈2 min)

1. Open the Vercel URL in **Safari** (it must be Safari for this step).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Launch it from the home screen. It runs full-screen, keeps the screen awake in lesson views,
   and opens lessons you've already looked at even without Wi-Fi.

## Part E — Optional: the AI helpers (≈10 min, needs Terminal)

This turns on *Read a board from an image* and *Draft with AI*. Skip it for now if you like —
nothing else depends on it.

1. Get an API key: **https://console.anthropic.com** → sign up → **API Keys** → **Create Key**.
   Copy it (starts with `sk-ant-`). Add a few dollars of credit under **Billing**; a board read
   costs about 1–2¢.
2. On the Mac, open **Terminal** (Spotlight → type "Terminal"). Paste these lines one at a time:

   ```bash
   # Homebrew, if you don't have it yet (it will ask for your Mac password):
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

   brew install supabase/tap/supabase
   cd ~/Desktop
   git clone https://github.com/GinoLorca/Chess-Private-Student-Planner.git
   cd Chess-Private-Student-Planner
   git checkout claude/friendly-ritchie-hw1zrk

   supabase login                    # opens a browser tab; approve it
   supabase link --project-ref XXXX  # XXXX = the part before .supabase.co in your Project URL
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-PASTE-YOUR-KEY-HERE
   supabase functions deploy chess-ai
   ```

3. In the app, open any lesson → **Quick add** → **Read a board from an image** and try a
   Chessable screenshot. If the function isn't deployed, the button tells you so instead of
   failing silently.

---

## When the app gets an update

Vercel redeploys on every push, so the app itself updates by itself. When an update adds a
database change there is a new file in `supabase/migrations/`, numbered after the ones you've
run. Paste it into **SQL Editor → New query** and **Run**, once. Every migration is safe to
re-run, so if you're not sure which you've done, run `supabase/setup_all.sql` again instead.

| Migration | Adds |
|---|---|
| `0004_lesson_flow.sql` | lesson status (planned / in progress / taught) and saved lesson templates |
| `0005_skins.sql` | the chosen skin (Folder or a Chess Arcade skin) |
| `0006_puzzle_done.sql` | the done flag on positions, for the annotation queue |
| `0007_student_logo.sql` | a school logo on each student folder |

---

## Letting an agent add lessons (the connector)

The app serves its own connector at **`https://<your-app>.vercel.app/api/mcp`**. It's an MCP
server (the standard agents use for tools) and also answers plain JSON, so any agent that can
call a URL can use it. Nothing to deploy or configure: it's part of the app and uses the same
Supabase settings Vercel already has.

**Sign-in: an API key for the agent (≈3 min, once).** The agent gets a key, not your password.
The key stands for your login, which lives only in Vercel's environment settings:

1. Make up a long random key. In Terminal, `openssl rand -hex 32` prints one; or use any
   password generator, 40+ characters.
2. In Vercel: your project → **Settings → Environment Variables**. Add three, for all
   environments:
   - `MCP_API_KEY` = the key you just made
   - `MCP_USER_EMAIL` = your planner login email
   - `MCP_USER_PASSWORD` = your planner password
3. **Deployments → ⋯ on the latest → Redeploy**, so the function picks them up.
4. Paste the key into the agent's credential store. It sends `Authorization: Bearer <key>`.

The connector then signs into Supabase as you, under the same row security as the app, so
it can only see your students. Nothing is stored server-side beyond those settings. To cut
the agent off, change `MCP_API_KEY` and redeploy. (Your own login also works, as HTTP Basic
auth, for a quick test from a terminal.)

**Giving it to the agent.** Add it as a tool server / custom MCP connector with:

- URL: `https://<your-app>.vercel.app/api/mcp`
- Auth: Bearer token = the key

If the agent can't do MCP, tell it to POST JSON to the same URL with the same header:

```bash
curl https://<your-app>.vercel.app/api/mcp \
  -H 'Authorization: Bearer <key>' -H 'Content-Type: application/json' \
  -d '{"tool":"create_lesson","args":{"student_id":"<id>","positions":[
        {"fen":"6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1","answer":"Rd8#","note":"Back rank.","source_url":"https://lichess.org/study/..."}
      ]}}'
```

A GET on the URL says whether the key is configured yet.

**The tools.** `list_students` (ids and names), `list_lessons(student_id)` (each lesson with
positions done / total and its link), `create_lesson(student_id, positions, title?)` (makes
Lesson N and returns its link and the annotate link), `add_positions(lesson_id, positions)`.

**A position** is `{ fen, source_url?, label?, question?, note?, answer? }`. Only `fen` is
required; the placement alone is fine. `answer` is the line as moves ("Rf8 Bxh4 b4", move
numbers optional), checked against the position, so an impossible line is rejected instead of
saved. For positions taken from a course (Chessable, a Lichess study, a book): `fen` is the
starting FEN, `answer` the move line, `source_url` the course link, and `note` carries the
course's own comment on the move, so the author's explanation arrives with the position instead
of being retyped. Whatever the agent leaves blank you finish in the workbench: the lesson shows
**Annotate · n** until every position is saved.

**If the agent drives the app in a browser instead**, it can use the same New lesson sheet
you do. Each row takes a FEN, and moves typed after the FEN on the same line ("… w KQ - 0 8
8. O-O dxc4 9. Bxc4") become the answer line automatically.

A brief for the agent: *"Use the lesson planner connector. Call list_students to find the
student, then create_lesson with the FENs I give you. Fill every position completely: the
answer line, a question in plain coaching words, a note, a short label, and the source link.
When a position comes from a course, read the course's comment or annotation on that move and
put it in the note, quoted or closely paraphrased, then add two to four sentences on why the
answer works and what the alternatives lose. Reply with the lesson link."* With every field
filled, the workbench is a review pass: open each position, check it, tap Save, done.

Opening `https://<your-app>.vercel.app/api/mcp` in a browser shows the same information.

---

**Stuck anywhere?** Tell Claude which step and paste what the screen says.
