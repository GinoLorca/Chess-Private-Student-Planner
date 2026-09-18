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

## Notes

- Data model and RLS policies: `supabase/migrations/0001_init.sql`.
- The puzzle editor has three tabs: **Setup position** (paste a FEN or drag pieces from
  the tray), **Annotate answer** (click a square to start an arrow / click again to
  finish it, or toggle highlights), **Record solution** (drag pieces to play out the
  answer — moves are validated with `chess.js` and appear as a numbered list you can
  annotate).
