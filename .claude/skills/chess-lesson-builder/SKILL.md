---
name: chess-lesson-builder
description: Turns a set of chess lesson parameters (student, positions/FENs, quiz prompts, explanations, solution moves) into a new interactive lesson inside Gino's "Lesson Planner" artifact app, and republishes it live. Use this whenever Gino sends puzzle/position content for a student and wants an interactive lesson built or added — phrases like "add a lesson for Jojo", "here's lesson 12 for Parker", "make this into an interactive lesson", "build the next lesson", or a pasted batch of FEN positions with explanations for a student. Also use it for any request to resize pieces, change board colors, or otherwise tweak the shared design of these lesson artifacts, since that touches the same files this skill owns. Do NOT use this for the real React/Supabase app under src/ — these are standalone HTML artifact deliverables, a separate parallel tool from the production app.
---

# Chess lesson builder

Gino runs a chess coaching business and delivers interactive lessons through
two standalone HTML artifacts (no backend — everything is baked into the
file). He plans to keep producing lessons in this exact format all year, so
the job here is mechanical and repeatable: take lesson content from him,
turn it into the app's puzzle-data format, verify it doesn't break anything,
and publish it live — the same way, every time.

Read `references/known-artifacts.md` for the two files/URLs involved and the
rule for when a change needs to go to both. Read
`references/lesson-data-format.md` for the exact data shapes (`pz()` helper,
section/lesson-plan objects) before writing any lesson content — guessing at
the schema instead of checking it is how a lesson silently fails to render.

## Workflow

### 1. Get the lesson content

Gino may paste FENs with explanations directly, describe a game and which
moments from it he wants as puzzles, or reference a Lichess/Chess.com puzzle
set. Whatever the input shape, you need, per puzzle: a position + side to
move, a solution in SAN, and an explanation. See
`references/lesson-data-format.md` → "What to ask Gino for" for the full
list and what's optional.

**Ask rather than invent** when something chess-specific is missing or
ambiguous (which move is actually best, what the position even reflects). A
wrong tactical claim in a lesson is worse than a short delay to ask. It's
fine to derive a FEN yourself from a described position/game, and fine to
lightly tighten his prose for the summary field — that's not inventing
content.

### 2. Locate the target in both repo files

Work from `lesson-artifacts/lesson-planner-gold.html` and
`lesson-artifacts/lesson-planner-warmdesk.html` (see
`references/known-artifacts.md` for when to reconcile against the live
artifact first). In each file, find the student's `make<Name>Lessons()`
function — or set one up if they don't have one yet — per
`references/lesson-data-format.md` → "Where this lives per student".

### 3. Build the new lesson plan object

Follow the exact shapes in `references/lesson-data-format.md`. In short:
puzzles via `pz(label, placement, side, quizPrompt, summary, sanList, refUrl, refLabel)`,
grouped into one or more sections, wrapped in a lesson-plan object with the
next sequential `number` for that student. Append it to the end of the
student's lesson array in **both** files — the data must be identical in
both themes.

### 4. Verify before publishing

Cheap check first, expensive check second — don't skip to Playwright on a
file that doesn't even parse:

```bash
python3 .claude/skills/chess-lesson-builder/scripts/verify_artifact.py lesson-artifacts/lesson-planner-gold.html
python3 .claude/skills/chess-lesson-builder/scripts/verify_artifact.py lesson-artifacts/lesson-planner-warmdesk.html
```

Then a visual smoke test with Playwright (`chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`,
the browser is pre-installed — don't run `playwright install`) against each
file: open it, navigate to the student → Lesson Plan → the new lesson, and
screenshot it. Confirm the puzzle count matches what you added, the board
renders the position correctly (not an empty board — a wrong FEN placement
still parses as valid JS, so the syntax check alone won't catch a typo'd
position), and open one puzzle in the editor's Annotate tab to confirm it
loads. This mirrors how earlier lesson-import work in this repo was
verified — reuse that approach rather than inventing a new one.

If either check fails, fix the specific puzzle/lesson object you just added
before re-running both checks — don't move on with a broken file.

### 5. Publish

Use the Artifact tool's `publish` action for each file, with `url` set to
that file's **existing** URL from `references/known-artifacts.md` (never
omit `url` — that would create a stray new artifact instead of updating the
live one). Publish both themes unless Gino explicitly said just one.

### 6. Commit

Stage and commit the updated `lesson-artifacts/*.html` file(s) so the repo
stays the durable source of truth, e.g.:

```
Add Lesson 12 for Parker Downing (rook endgame technique)
```

Push per this session's normal branch/push conventions.

### 7. Report back

Tell Gino what was added (student, lesson number, section titles, puzzle
count), link both live artifacts, and list the files you changed — per his
standing preference for a short summary of what changed and where at the end
of a task.

## Design/structural change requests

If the request isn't lesson content but a tweak to the shared look (resize a
piece set, change a color, adjust board size, fix a layout bug) — this is
still this skill's territory, since it owns these two files. Apply the
change to both `lesson-artifacts/*.html` files identically (see
`references/known-artifacts.md` → "Propagation rule"), verify each with the
same two-step check above, publish both, commit both. Don't let the two
theme files drift into different engine versions — that quietly invalidates
the A/B comparison Gino is running.
