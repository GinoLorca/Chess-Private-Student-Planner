# Lesson Planner

A private lesson planner for chess coaching, built for the lesson table: an iPad in the coach's
hand, a student across a real board. Students live in folders; each has lesson plans, notes, game
reviews and invoices. A lesson plan is themed sections of positions, each with a board, arrows
and highlights, a quiz prompt, the answer line and the coach's explanation.

- **New lesson = the FENs.** The + button asks for the positions and nothing else: one row per
  FEN (or Lichess / Chess.com link) with an optional source link, + for another row, and a
  multi-line paste splits into rows. Moves after a FEN on the same line become the answer. Create lesson makes Lesson N and opens the workbench.
- **Annotate workbench** — one position at a time with the rest queued beside it: play the
  answer on the board, right-drag arrows, write the question and the note, *Save, done* stamps
  it and brings up the next. The folder shows *Annotate · n* until the queue is empty, and
  *+ FENs* on any section appends more.
- Sections, theme blocks and agenda items stay optional; *Duplicate as next lesson* and
  *Save shape as template* live in the lesson's ⋯ menu.
- **Quick add** turns a Lichess puzzle / study / game link, a Chess.com game link, a FEN, PGN, a
  Lichess puzzle theme, or a photo/screenshot of any board into a position in one step.
- **Editor** — set up the position by tapping, draw arrows, play out the answer, engine-check it.
  The label follows the first answer move, the quiz prompt has a smart default from the section
  theme (or a tap-to-pick alternative), explanation starters are one tap, and *Done, add another*
  chains straight into the next Quick add.
- **Coach view** — set-up piece list, quiz prompt, answer stepper with auto-drawn arrows, notes.
- **Present** — the student's side: quiz first, answer on reveal.
- **Learn** — solve it yourself: the board is live and nothing is given away. A right move is
  accepted and the other side replies; a wrong one bounces back. Solved (or *Show me the
  answer*), then *Show explanation* reveals the line, arrows and notes. A tally for the
  session sits in the top bar.
- **Recycle** — ⋯ on a lesson → *Recycle for another student…* copies the whole lesson,
  annotations included, as that student's next lesson.
- **Clicker** — in Coach view and Present, a Bluetooth presentation clicker (Page Down / Page
  Up, or the arrow keys and space) walks the whole lesson: reveal, each answer move, then the
  next position; the back button reverses it; Escape returns to the folder. `]` and `[` jump a
  whole position, and so does a sideways swipe anywhere on the screen, as in Photos.
- **The eye** — on the position page and in every lesson view, an eye button hides the
  explanation and move notes in one tap (say, when a student leans over). The clicker's third
  button does the same once you teach it to the app in Settings → Clicker; B, period and H
  work out of the box.
- **Lesson sheet** — the whole lesson in document form, printable to PDF.
- **School logos and colours** — a student's folder can carry their school badge (⋯ on the
  folder → *School logo…*: a built-in badge with its school colour in one tap, or any picture
  from the iPad) and a deep school colour such as navy or black; the folder, tabs, stamp and
  Rolodex card switch to light ink on their own.
- **Position library and links** — every position across every student in one searchable
  page (Library, from the Students screen), each with *Copy link* and *Present*. A link opens the
  position in Present mode on its own: no student name, no lesson number, no other positions to
  swipe to, so a class never learns whose lesson it came from. It survives the position moving
  between lessons. *Copy link* is also
  on every index card, the position page, the workbench and the lesson's ⋯ menu (*Copy links to
  all positions*). Paste a link into the ICN Chess Club Planner's *Puzzle / exercise links* row
  with a label, and the class lesson opens it straight at the board.
- **Works without a connection.** Every student's lessons are pulled onto the device while
  online, so the whole cabinet opens on a plane or in a dead Wi-Fi room. Anything changed
  offline (a stamp, a note, an annotation) waits in a queue, shown in a bar at the top, and
  syncs when the connection returns. Sign-in survives offline, the display fonts are cached,
  and a new version of the app installs itself on the next launch.
- Installable PWA, light and dark.

## Stack

- React 19 + TypeScript + Vite, Tailwind CSS 4, Framer Motion, TanStack Query (with a localStorage
  persister for offline reads), `vite-plugin-pwa`
- A custom board component (no chessboard library); `chess.js` for move legality and PGN
- Supabase (Postgres + Auth + one Edge Function for the AI helpers)
- `api/mcp.js`: an MCP connector (Vercel function, plain JavaScript) so an agent can create
  lessons from FENs with a bearer key, complete with the answer line, a note per move, the
  question, the explanation, arrows and highlights, ready to teach from Coach view; see
  DEPLOY.md, "Letting an agent add lessons"

## 1. Local setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL + anon key
npm run dev
```

Or skip the backend entirely to look around:

```bash
VITE_DEMO=1 npm run dev
```

Demo mode runs the whole app against the imported sample lessons in memory (edits persist in the
browser's localStorage). The AI helpers return sample responses in demo mode.

## 2. Create your Supabase project

1. Create a project at [supabase.com](https://supabase.com) (the free tier is plenty).
2. In **SQL Editor**, run each migration once, in order — they're all additive and safe to re-run:

   | File | Adds |
   |---|---|
   | `supabase/migrations/0001_init.sql` | students, lesson plans, sections, puzzles, notes + RLS |
   | `supabase/migrations/0002_user_settings.sql` | per-account preferences |
   | `supabase/migrations/0003_sources_and_themes.sql` | puzzle sources/themes, lesson theme blocks, board colours, imported piece sets, Lichess/Chess.com usernames |
   | `supabase/migrations/0004_lesson_flow.sql` | lesson status + taught date, saved lesson templates |
   | `supabase/migrations/0005_skins.sql` | the chosen skin |
   | `supabase/migrations/0006_puzzle_done.sql` | the done flag on positions (annotation queue) |
   | `supabase/migrations/0007_student_logo.sql` | a school logo on each student folder |

3. In **Project Settings → API**, copy the **Project URL** and **anon public key** into
   `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. In **Authentication → Users**, **Add user** — the one account you'll sign in with. There is no
   public sign-up.

## 3. Deploy

Any static host works (Vercel and Netlify are the simplest):

1. Import the repo; build command `npm run build`, output directory `dist`.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's environment settings.
3. Deploy, then open the URL on each device and sign in.

**Install on the iPad / iPhone:** open the deployed URL in Safari → Share → **Add to Home Screen**.
It launches full-screen without browser chrome, keeps the screen awake during a lesson, and opens
lessons you've already loaded even without Wi-Fi.

## 4. AI helpers (optional)

Two features call Claude through a Supabase Edge Function, so the API key stays server-side and
only your signed-in account can use it:

- **Read a board from an image** (Quick add → *Read a board from an image*): a screenshot of a
  Chessable / Chess.com / book position, or a phone photo of a real board, becomes a position for
  you to confirm — side to move and orientation are picked up when visible, and a confidence
  banner flags anything uncertain.
- **Draft with AI** (editor → Explanation): drafts the explanation from the position and your
  recorded answer, in plain coaching language, for you to edit.

Setup, once, with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <your-project-ref>
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...     # from console.anthropic.com
supabase functions deploy chess-ai
```

Cost: the function uses Claude Opus 5 ($5 / $25 per million tokens). A board image is roughly
1,500–2,500 tokens, so reading a position is about 1–2¢ and a draft explanation under 1¢. Without
the key set, the buttons show a clear message and everything else keeps working.

## Quick add, in detail

| You paste or pick… | What happens |
|---|---|
| Lichess puzzle link or 5-character id | Position, side to move and the full solution line |
| Lichess study (chapter) link | The chapter's moves, **with the arrows and highlights drawn in the study** |
| Lichess or Chess.com game link | The game opens in a scrubber; step to the moment, choose the answer length |
| FEN / PGN text | Imported directly (PGN comments' `[%cal]` / `[%csl]` arrows come along) |
| A Lichess theme chip | A random puzzle of that theme, with *Another* |
| A photo or screenshot | Read into a position by the AI helper (see above) |
| **Several at once** — links or FENs one per line, a multi-game PGN, or a whole study | One position each, added in one go; study chapters and puzzle-style PGN games bring their answer line. Full games are listed for you to pick the moment. Then *Next without explanation* in the editor sweeps through them. |

Chess.com game links need your Chess.com username in Settings (the public archive is per player).
**Engine check** in the editor asks Lichess's cloud analysis for the top line of any position — no
account or key needed — and says whether it agrees with your first move.

## Skins

Settings → Skin switches the whole app between the planner's own **Folder** look and the five
Chess Arcade skins (Tournament Felt, Hustler, Bauhaus, Game Boy, Outer Space), ported token for
token: colours, page background, board squares and textures, piece treatment, display font and
corner radii. Light and dark work inside each skin. The layout never changes with the skin.

## Piece sets and board colours

Settings has three built-in piece sets (Classic, Bauhaus Set, Wavy) and seven board colour presets plus a custom pair. **Import
piece set** takes the twelve piece images from any set (Chess Arcade or elsewhere): files named
like `wK.png` or `black_knight.svg` are matched automatically, the rest you assign with a picker.
Imported sets are stored with your account and sync across devices.

## Notes

- Data model and RLS policies: `supabase/migrations/`.
- Lesson rows flag an answer that doesn't replay from its position (e.g. an imported castling move
  on a position saved without castling rights) so it can be re-recorded before the lesson.
- Reviewed marks and agenda ticks are per device per session; a new lesson day starts clean.
