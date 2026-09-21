# Lesson Planner

A private lesson planner for chess coaching. Students live in manila-folder tabs; each
student has MISC, Game Review, Invoices, Lesson Plan, and Student Notes folders. Lesson
plans hold themed sections of puzzles/positions, each with a position editor (set up any
FEN, draw arrows and highlights, record the solution sequence, write a summary, link a
reference), a **Present to student** mode (quiz first, reveal on demand), and a
**Coach's View** cheat-sheet mode for quickly cycling through positions with the answer,
notes and solution already visible — built for running higher-rated students through
prepared material fast.

## Stack

- React + TypeScript + Vite, Tailwind CSS, Framer Motion
- `react-chessboard` + `chess.js` for the interactive board / move validation
- Supabase (Postgres + Auth) for storage and cross-device sync

## 1. Local setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL + anon key
npm run dev
```

Without Supabase credentials the app still runs and shows the login screen with a
banner explaining what's missing — it won't be usable until Supabase is configured.

## 2. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project (the free tier is
   plenty for a single-user planner).
2. In the Supabase dashboard, open **SQL Editor** and run the contents of
   [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql). This
   creates the `students`, `lesson_plans`, `lesson_sections`, `puzzles`, and `notes`
   tables with row-level security so only your account can ever read or write your data.
3. In **Project Settings → API**, copy the **Project URL** and **anon public key** into
   `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. In **Authentication → Users**, click **Add user** and create the one account you'll
   sign in with (email + password). This app has no public sign-up — accounts are only
   ever created by you from the dashboard.

## 3. Deploy

Any static host works since this is a client-side app that talks directly to Supabase.
Vercel or Netlify are the simplest:

1. Push this repo to GitHub.
2. Import it into Vercel/Netlify.
3. Build command: `npm run build`, output directory: `dist`.
4. Add the two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
   in the host's project settings.
5. Deploy. Sign in on any device — laptop for building lessons, tablet/phone for
   presenting — and everything stays in sync through Supabase.

## Try it without a backend

```bash
VITE_DEMO=1 npm run dev
```

Demo mode runs the whole app against the imported sample lessons in memory (edits persist in the
browser's localStorage). It's the quickest way to see a build on an iPad before deploying.

## Migrations

Run these in the Supabase SQL editor, in order, once each. All of them are additive — re-running
is harmless and existing rows are never touched.

| File | Adds |
|---|---|
| `0001_init.sql` | students, lesson plans, sections, puzzles, notes + RLS |
| `0002_user_settings.sql` | per-account preferences (piece set) |
| `0003_sources_and_themes.sql` | puzzle sources/themes, lesson theme blocks, board colours, imported piece sets, Lichess/Chess.com usernames |

## Quick Add

On any lesson, **Quick add** takes a pasted Lichess puzzle / study / game link, a Chess.com game
link (set your Chess.com username in Settings first), a FEN, or PGN — or browses Lichess puzzles by
theme. Studies bring their arrows and highlights with them. For games and studies you scrub to the
moment and the puzzle is cut from there. **Engine check** in the editor asks Lichess's cloud
analysis for the top line of any position — no account or key needed.

## Notes

- Data model and RLS policies: `supabase/migrations/0001_init.sql`.
- The puzzle editor has three tabs: **Setup position** (paste a FEN or drag pieces from
  the tray), **Annotate answer** (click a square to start an arrow / click again to
  finish it, or toggle highlights), **Record solution** (drag pieces to play out the
  answer — moves are validated with `chess.js` and appear as a numbered list you can
  annotate).
