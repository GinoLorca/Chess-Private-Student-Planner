---
name: import-arcade-theme
description: Bring a Chess Arcade theme (skin) into this app, or bring every theme up to date with Chess Arcade. Use whenever the coach says they added or changed a theme in Chess Arcade, names an Arcade theme to "import", "add", "bring over" or "wire up" (Drive-Thru, Rosé, Chess Book, Uptown Express, Outer Space...), asks for "the latest themes", or notices a theme here looks different from Arcade (backgrounds, sounds, pieces, colours).
---

# Import a Chess Arcade theme

Every Chess Arcade theme in this app is generated from Arcade's own source by
`scripts/import-arcade-themes.mjs`. Never hand-port a theme: run the importer.
It reads Arcade's single `index.html` and writes:

| Output | What |
| --- | --- |
| `src/skins.arcade.css` | colours for light and dark (bridged onto this app's tokens), the page pattern and artwork, board squares, last move, the frame's border image, piece treatment and colours (`--pw-*`, `svg[data-p]`), display and body fonts |
| `src/lib/arcadeThemes.generated.ts` | the themes Settings lists; which ship artwork, colour the Theme Staunton pieces, bring sounds; analysis-board colours |
| `public/skins/<id>-bg.(svg\|jpg)` | artwork, only where Arcade ships some |
| `public/sounds/themes/<id>/*.mp3` | the theme's sounds (move, capture, castle, check, checkmate, promote, win, lose, matchStart) |
| `index.html` | any Google Font a theme uses that isn't loaded yet |

The app's own choices per theme (description, folder stamps, sticky note,
clip, corner radii, which piece set it pairs with) live in
`scripts/arcade-themes.config.json`. App-only CSS (the Folder design under each
theme, board-frame thickness) lives in `src/skins.css`. Neither is touched by
the importer.

## One, two, three

**1. Get today's Chess Arcade.** Clone `GinoLorca/chess-arcade` into the
scratchpad (add the repo to the session first if it isn't there), or pull an
existing checkout. Then see what changed, without writing anything:

```sh
npm run arcade:import -- --from <path-to-chess-arcade> --check
```

It lists every theme it found, files that are new or out of date, themes new
in Arcade, and artwork or sounds Arcade no longer ships.

**2. Import.**

```sh
npm run arcade:import -- --from <path-to-chess-arcade>
```

If `--check` listed files Arcade no longer ships, show the coach that list and
get a yes before deleting them (their standing rule), then run again with
`--prune`. A theme new in Arcade imports with defaults; give it a config entry
(description, stamps and sticky note under `tokens`) and, if its board needs a
thicker or thinner frame here, a line in `src/skins.css`.

**3. Look at it, then ship.** `VITE_DEMO=1 npx vite`, Settings → Skin → the
theme (a theme that colours pieces puts Theme Staunton on). Check a lesson page
and a position page in light and dark, at Mac, iPad and iPhone widths: page
background, board and frame, pieces, card titles in the theme's display font,
no sideways scroll. Then typecheck (`npx tsc --noEmit -p tsconfig.app.json`),
lint, build, commit with the generated files, push.

## What it maps, and what it leaves

Arcade selectors scoped to a theme (`:root[data-skin="id"] …`; Tournament Felt
is Arcade's default, `:root` / `:root:not([data-skin])`) become this app's:

- `--bg`, `--surface`, `--ink`, `--brass`… → the app's tokens through a bridge
  repeated in the dark block (the app's own dark colours come later in the
  cascade and would otherwise win)
- `…:not([data-custom-bg]) body::before` → the page pattern; `THEME_ART` /
  `THEME_ART_SVG` → artwork, with a per-device Artwork / Pattern switch
- `.sq.light` / `.sq.dark` → `.board-sq`; `.sq.last-move` → `.board-last`;
  `.board-frame` border-image → the board's frame (full-size boards only)
- `.piece-wrap`, `svg[data-p]` → `.board-piece` (layout properties dropped);
  the analysis board gets the same for themes Repertoire Lab has no palette for
- the title rule's font → `--font-display` (and `.font-display`); `body` font →
  `--font-sans`

Everything else in Arcade (drill cards, panels, buttons, HUDs) has no
counterpart here; the importer counts those rules as skipped. If a theme's
look depends on one of them, add the equivalent by hand in `src/skins.css`.

If the importer stops with "Chess Arcade has no … any more", Arcade renamed a
constant it reads (`SKIN_LABEL`, `SOUND_DATA`, `SKIN_SOUND_DEFAULTS`,
`THEME_ART`, `THEME_ART_SVG`): update the importer, don't hand-port.
