# Chessable capture and FEN-to-line converter

Two command-line tools for getting variations out of a Chessable course and into the
`<start FEN> <moves>` form the lesson planner uses:

| Tool | Does |
|---|---|
| `2026-09-21-fens-to-line.mjs` | Converts a list of FENs (one per line) into one line per variation: `1r2r1k1/... b - - 0 5 5...Red8 6.f3 Be6 7.Rbd1 Rd4 8.Kf2 Rbd8` |
| `2026-09-21-chessable-capture.mjs` | Signs in to Chessable with **your** account, opens a variation, presses forward through it, records the FEN after every move, follows **Next »** to the following variations, and runs the converter on the result |

Both run with the project's own `node_modules`; nothing else is installed globally.

## One-time setup

```bash
npm install                       # adds Playwright to the dev dependencies
npx playwright install chromium   # the browser the capture script drives (one download)
```

Then either sign in once in a visible browser (this also handles 2FA or a captcha):

```bash
npm run chessable:login
```

or put your credentials in `.env.local` so the script can sign in on its own:

```
CHESSABLE_EMAIL=you@example.com
CHESSABLE_PASSWORD=your-chessable-password
```

Either way the signed-in session is saved to `.chessable/state.json` and reused on later runs, so
the password is not needed again until Chessable logs the session out. `.env.local`,
`.chessable/` and `captures/` are all git-ignored; keep it that way. Only `VITE_*` variables reach
the browser bundle, so the `CHESSABLE_*` ones stay on your machine.

## Capturing

Open the variation on Chessable, copy its URL, then:

```bash
# this one variation
npm run chessable:capture -- "https://www.chessable.com/variation/12345678/"

# this variation and every one after it until the breadcrumb chapter changes
npm run chessable:capture -- "https://www.chessable.com/variation/12345678/" --chapter

# a fixed number of variations, or everything "Next »" leads to
npm run chessable:capture -- "<url>" --count 12
npm run chessable:capture -- "<url>" --all

# also write a PGN the planner's Quick add accepts directly
npm run chessable:capture -- "<url>" --chapter --pgn
```

The grouped lines print to the terminal and are written to `captures/<date>-<slug>.txt`, next
to `captures/<date>-<slug>.fens.txt` with the raw FENs (so the conversion can be re-run) and, with
`--pgn`, a `.pgn` with one `[FEN]`-headed game per variation. Files are rewritten after every
variation, so an interrupted run keeps what it had. `--out some/base` picks the file names.

Each variation's title becomes a `# title` line above its moves; `--no-titles` drops them.

Other flags: `--headed` (watch the browser), `--wait 4000` (slower pages), `--slow 300`
(slow every action down), `--no-rewind` (trust that the page opens at the start of the line).

## How the script reads the page

It does not depend on Chessable's markup staying the same:

- The **FEN** comes from whichever input box holds a FEN (preferring one labelled "FEN").
- **Forward** is the right-arrow key, or, if that does nothing, the icon-only chevron button.
  Every step is checked to be exactly one legal move, so a button that jumps to the end of the
  line is rejected instead of recorded.
- The **end of the line** is when a step no longer changes the FEN.
- **Next variation** is the visible link or button whose text is just "Next" (with or without »).
- The **chapter** is the last link of the breadcrumb (`Course > Chapters > 3. …`).

If Chessable changes its layout and something stops being found, run

```bash
npm run chessable:probe -- "<url>"
```

which prints what the script picked plus every FEN-looking input and every button on the page,
and set the matching override in `.env.local`:

```
CHESSABLE_FEN_SELECTOR=#fenInput
CHESSABLE_NEXT_MOVE_SELECTOR=button.next-move
CHESSABLE_FIRST_MOVE_SELECTOR=button.first-move
CHESSABLE_NEXT_VARIATION_SELECTOR=a.next-variation
```

On an error the script saves `captures/<date>-error.png`, a screenshot of the page as it was.

## Converter on its own

```bash
npm run fens:convert -- captures/2026-09-21-chapter-3.fens.txt
pbpaste | npm run fens:convert            # FENs from the clipboard (macOS)
npm run fens:convert -- fens.txt --pgn    # PGN games instead of lines
```

Input rules: one FEN per line; a blank line or a `# title` line ends a variation; a FEN that is
not one legal move after the previous one starts a new variation automatically, so a raw dump of
several lines back to back still splits correctly; repeated positions are skipped; anything that
is not a FEN is reported on stderr, never silently dropped.

## Offline self-test

`tools/chessable/fixtures/2026-09-21-chessable-mock.html` is a stand-in for the Chessable viewer
(breadcrumb, title, FEN box, move buttons, arrow keys, "Next »"). It needs no account:

```bash
npm run chessable:selftest        # captures all three mock variations into captures/selftest.*
```

Add `?startPly=2` to the mock URL to open mid-line (exercises rewind) or `?nokeys=1` to disable the
arrow keys (exercises the button strategy).

## For an agent

The whole job in one go, from a fresh checkout on a machine that has signed in once:

1. `npm install` (once) and `npx playwright install chromium` (once).
2. If `.chessable/state.json` is missing: `npm run chessable:login` (needs a visible browser or
   `CHESSABLE_EMAIL` / `CHESSABLE_PASSWORD` in `.env.local`).
3. `npm run chessable:capture -- "<variation url>" --chapter --pgn`
4. Read `captures/<date>-<slug>.txt` for the lines, `.pgn` for the planner import.
5. If step 3 reports "No FEN box found" or stops after one move, run
   `npm run chessable:probe -- "<url>"`, pick the selectors, add them to `.env.local`, rerun.

Or use the `/chessable-capture` skill in Claude Code, which follows exactly this list.

## Notes

- One account, your own course: the script only reads pages you can already open, at human
  pace. Do not share `.chessable/state.json`; it is as good as a password.
- Headless runs are the default once a session is saved. If Chessable's bot check blocks a headless
  run, add `--headed`.
- FENs are compared by placement and side to move, so a difference in how Chessable and chess.js
  write the en-passant square never breaks the move detection.
