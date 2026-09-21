# Lesson artifacts

Two standalone, single-file HTML apps used to deliver interactive chess
lessons directly (no backend, no build step — open the file or the published
link and it works). These are a parallel, currently-primary delivery tool to
the real React/Supabase app in `src/`, not a build output of it.

- `lesson-planner-gold.html` — the original dark "gold" theme.
- `lesson-planner-warmdesk.html` — an alternate light "warm desk" theme,
  A/B testing against the gold theme.

Both files share the same engine (board rendering, piece sets, puzzle
editor, presentation/coach modes) and the same lesson data — only the CSS
differs. See `.claude/skills/chess-lesson-builder/` for the skill that adds
new lessons to both and republishes them, including the live claude.ai
artifact URLs for each.
