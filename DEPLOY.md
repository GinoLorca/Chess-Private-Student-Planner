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

---

**Stuck anywhere?** Tell Claude which step and paste what the screen says.
