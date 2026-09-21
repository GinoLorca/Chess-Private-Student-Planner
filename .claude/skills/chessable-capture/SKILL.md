---
name: chessable-capture
description: Pull one variation, a chapter, or a whole run of variations out of the coach's Chessable course as "<start FEN> 5...Red8 6.f3 Be6" lines (and PGN for Quick add). Use when given a chessable.com variation URL, or asked to record the moves/FENs of a Chessable lesson.
---

# Chessable capture

Everything lives in `tools/chessable/`; the walk-through is
`tools/chessable/2026-09-21-chessable-capture-README.md`.

## Steps

1. Make sure the tools can run:
   - `npm install` if `node_modules/` is missing.
   - `npx playwright install chromium` if the capture script complains that Chromium is not installed.
2. Make sure there is a Chessable session:
   - `.chessable/state.json` present → skip this step.
   - Otherwise run `npm run chessable:login`. With `CHESSABLE_EMAIL` and `CHESSABLE_PASSWORD` in
     `.env.local` it signs in by itself; without them a browser window opens for the coach to sign
     in. Never print, echo or commit the credentials or the state file.
3. Capture. `$ARGUMENTS` is the variation URL plus any of the script's flags; default to the whole
   chapter with PGN when only a URL was given:
   ```bash
   npm run chessable:capture -- "<url>" --chapter --pgn
   ```
   Use `--count N` for a fixed number of variations, `--all` to follow "Next »" to the end, or no
   flag for just the one variation.
4. Report the lines the script printed (they are also in `captures/<date>-<slug>.txt`; the PGN in
   `captures/<date>-<slug>.pgn` pastes straight into the planner's Quick add). Mention any
   "group N: ..." notes the script printed; they mean a line was split or something was skipped.

## When it fails

- "No FEN box found" or a variation with 0 or 1 moves when the page clearly has more: run
  `npm run chessable:probe -- "<url>"`, pick the FEN input / next-move button / Next link from the
  output, add `CHESSABLE_FEN_SELECTOR`, `CHESSABLE_NEXT_MOVE_SELECTOR` or
  `CHESSABLE_NEXT_VARIATION_SELECTOR` to `.env.local`, rerun.
- Login loops or a bot check: rerun with `--headed`.
- `captures/<date>-error.png` is a screenshot of the page at the moment of an error; look at it.
- Sanity-check the machinery without an account: `npm run chessable:selftest`.
