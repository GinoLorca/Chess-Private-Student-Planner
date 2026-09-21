# Known artifacts

Two live claude.ai artifacts share the same lesson data and engine, differing
only in visual theme (an intentional A/B test Gino is running). Both get
updated together for any lesson-content change, by default.

| Theme | Repo file | Live URL |
|---|---|---|
| Gold (dark) — original design | `lesson-artifacts/lesson-planner-gold.html` | https://claude.ai/artifact/Vjv9BNvDiLVYNSn7nXyuAW |
| Warm desk (light) — alternate design | `lesson-artifacts/lesson-planner-warmdesk.html` | https://claude.ai/artifact/Jmm6dxECYTs2TcYDei42Cn |

If Gino ever says one theme "won" the A/B test and he only wants the other
maintained going forward, update this table (strike the losing theme, note
the date) rather than deleting its row — it's still useful history.

## Source of truth: repo file, cross-checked against the live artifact

The repo files above are the durable, version-controlled source of truth —
they survive between sessions, the live artifact state does not (no session
carries memory of edits another session made directly on claude.ai). Before
editing:

1. Start from the repo file (`lesson-artifacts/lesson-planner-*.html`).
2. If there's any reason to suspect the live artifact has diverged from the
   repo copy (Gino mentions editing it directly on claude.ai, or a while has
   passed since the last skill-driven update), use the Artifact tool's `read`
   action on the URL above first, diff it mentally against the repo file, and
   reconcile before proceeding — don't silently overwrite manual edits Gino
   made on the live page.
3. After editing and verifying (see the main SKILL.md workflow), publish with
   the Artifact tool's `publish` action, passing this **exact existing URL**
   as `url` so it updates in place rather than creating a new artifact.
4. Commit the updated repo file(s) in the same session, so the repo and the
   live artifact never drift apart for more than one skill invocation.

## Propagation rule for engine/design changes

A **lesson-content** change (new lesson, new puzzle, editing an explanation)
only touches data — it's independent per theme file, but still goes to both
by default since both must have the same lessons available.

A **structural or design** change — anything in the shared CSS, the board
rendering (`renderBoard`, `arrowMarkup`, `wireAnnotateDrag`), piece-set code,
or the screen/navigation shell — is engine code that both theme files
duplicate (each file is fully standalone, no shared include). Such a change
**must be applied to both files identically** and re-verified in both, or the
two themes silently stop being a fair A/B comparison. If Gino asks for a
design tweak (resize a piece, fix a color, change board size), treat "both
files" as part of the request even if he only mentions one, and say so when
reporting back — don't ask each time, but do flag it if the two themes'
engine code has already drifted for some other reason and reconciling them
is a bigger job than the requested tweak.
