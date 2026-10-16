#!/usr/bin/env node
/**
 * Chess Arcade → this app: every theme, straight from Arcade's own source.
 *
 *   npm run arcade:import -- --from <chess-arcade checkout, or its index.html> [--check] [--prune]
 *
 * Reads Chess Arcade's single-file app and (re)writes, for every theme it has:
 *
 *   src/skins.arcade.css               colours for light and dark, bridged onto this app's tokens;
 *                                      the page pattern and artwork; board squares, last move and
 *                                      frame; piece treatment and colours; display and body fonts
 *   src/lib/arcadeThemes.generated.ts  the themes Settings lists, which ship artwork, colour the
 *                                      Theme Staunton pieces or bring sounds, and their analysis-board
 *                                      colours
 *   public/skins/<id>-bg.(svg|jpg)     artwork, where Arcade ships some
 *   public/sounds/themes/<id>/*.mp3    each theme's sounds (public/sounds/*.mp3: the defaults)
 *   index.html                         the Google Fonts the themes use
 *
 * The app's own touches on a theme (its description, folder stamps and sticky note, corners,
 * which piece set it pairs with) come from scripts/arcade-themes.config.json. A theme Arcade has
 * that isn't in the config imports with defaults, so a new one shows up with no setup.
 *
 *   --check  report what's new or out of date, change nothing (exits 1 when anything is)
 *   --prune  delete artwork and sounds Arcade no longer ships (otherwise they're only listed)
 *
 * No dependencies: Node 18+ only.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_FILE = path.join(ROOT, 'scripts/arcade-themes.config.json')
const OUT_CSS = 'src/skins.arcade.css'
const OUT_TS = 'src/lib/arcadeThemes.generated.ts'

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const option = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const fromArg = option('from')
if (!fromArg) {
  console.error('Usage: npm run arcade:import -- --from <chess-arcade checkout or index.html> [--check] [--prune]')
  process.exit(2)
}
const fromFile = fs.statSync(fromArg).isDirectory() ? path.join(fromArg, 'index.html') : fromArg
const html = fs.readFileSync(fromFile, 'utf8')
const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
const CHECK = flag('check')
const PRUNE = flag('prune')
const sourceHash = crypto.createHash('sha256').update(html).digest('hex').slice(0, 12)

// ---------------------------------------------------------------------------
// A small CSS reader: rules (with the @media they sit in), selector lists and
// declarations, skipping quoted strings so data: URLs can hold anything.
// ---------------------------------------------------------------------------
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')

/** Index just past the brace that closes the one at `open`. */
function closeOf(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c === '"' || c === "'") {
      i = skipString(text, i)
      continue
    }
    if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i + 1
  }
  return text.length
}
function skipString(text, at) {
  const q = text[at]
  for (let i = at + 1; i < text.length; i++) {
    if (text[i] === '\\') i++
    else if (text[i] === q) return i
  }
  return text.length
}
/** Split at top-level `sep` (not inside quotes, parentheses or brackets). */
function splitTop(text, sep) {
  const out = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"' || c === "'") i = skipString(text, i)
    else if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === sep && depth === 0) {
      out.push(text.slice(start, i))
      start = i + 1
    }
  }
  out.push(text.slice(start))
  return out.map((s) => s.trim()).filter(Boolean)
}
function parseRules(text, media = null) {
  const rules = []
  let i = 0
  while (i < text.length) {
    const open = nextBrace(text, i)
    if (open < 0) break
    const prelude = text.slice(i, open).split(';').pop().trim()
    const end = closeOf(text, open)
    const inner = text.slice(open + 1, end - 1)
    if (prelude.startsWith('@media') || prelude.startsWith('@supports')) rules.push(...parseRules(inner, prelude))
    else if (!prelude.startsWith('@')) rules.push({ selectors: splitTop(prelude.replace(/\s+/g, ' '), ','), body: inner, media })
    i = end
  }
  return rules
}
function nextBrace(text, from) {
  for (let i = from; i < text.length; i++) {
    if (text[i] === '"' || text[i] === "'") i = skipString(text, i)
    else if (text[i] === '{') return i
  }
  return -1
}
/** [property, value] pairs, in order. */
const declarations = (body) =>
  splitTop(body, ';')
    .map((d) => {
      const at = d.indexOf(':')
      return at < 0 ? null : [d.slice(0, at).trim(), d.slice(at + 1).trim().replace(/\s+/g, ' ')]
    })
    .filter(Boolean)

const css = stripComments([...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n'))
const rules = parseRules(css)

// ---------------------------------------------------------------------------
// JavaScript literals Arcade keeps its data in.
// ---------------------------------------------------------------------------
/** A JS string literal (or several joined with +) at `from`, decoded; and where it ended. */
function readJsStringAt(text, from) {
  let i = from
  let out = ''
  for (;;) {
    while (/\s/.test(text[i])) i++
    const q = text[i]
    if (q !== "'" && q !== '"') break
    const end = skipString(text, i)
    const raw = text.slice(i + 1, end)
    out += JSON.parse('"' + raw.replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"') + '"')
    i = end + 1
    let j = i
    while (/\s/.test(text[j])) j++
    if (text[j] !== '+') break
    let k = j + 1
    while (/\s/.test(text[k])) k++
    if (text[k] !== "'" && text[k] !== '"') break
    i = k
  }
  return [out, i]
}
const readJsString = (text, from) => readJsStringAt(text, from)[0]
/** `{ key: value, ... }` read entry by entry: string values decoded, object values as their source text. */
function readMap(text, from) {
  const open = text.indexOf('{', from)
  const end = closeOf(text, open)
  const out = {}
  let i = open + 1
  while (i < end - 1) {
    // Commas, whitespace and comments between entries.
    for (;;) {
      const gap = /^(?:[\s,]+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/.exec(text.slice(i, i + 4000))
      if (!gap) break
      i += gap[0].length
    }
    const m = /^(?:(\w+)|'([^']+)'|"([^"]+)")\s*:\s*/.exec(text.slice(i, i + 200))
    if (!m) break
    const key = m[1] ?? m[2] ?? m[3]
    i += m[0].length
    if (text[i] === '{') {
      const close = closeOf(text, i)
      out[key] = text.slice(i, close)
      i = close
    } else if (text[i] === "'" || text[i] === '"') {
      const [value, next] = readJsStringAt(text, i)
      out[key] = value
      i = next
    } else {
      const stop = text.slice(i).search(/[,}\n]/)
      out[key] = text.slice(i, i + stop).trim()
      i += stop
    }
  }
  return out
}
const readStringMap = (text, from) => Object.fromEntries(Object.entries(readMap(text, from)).filter(([, v]) => !v.startsWith('{')))
const at = (marker) => {
  const i = html.indexOf(marker)
  if (i < 0) throw new Error(`Chess Arcade has no "${marker}" any more: the importer needs updating.`)
  return i + marker.length
}

const SKIN_LABEL = readStringMap(html, at('const SKIN_LABEL ='))
const THEME_IDS = Object.keys(SKIN_LABEL).filter((id) => id !== 'custom')

// Sounds: Arcade's defaults, and each theme's own set.
const SOUND_DATA = readStringMap(html, at('const SOUND_DATA ='))
const SKIN_SOUNDS = {}
{
  for (const [id, source] of Object.entries(readMap(html, at('const SKIN_SOUND_DEFAULTS =')))) {
    if (THEME_IDS.includes(id) && source.startsWith('{')) SKIN_SOUNDS[id] = readStringMap(source, 0)
  }
}

// Artwork: Bauhaus and Game Boy's pictures, and any theme in THEME_ART_SVG.
const ART = {}
{
  const svgs = readStringMap(html, at('const THEME_ART_SVG ='))
  for (const [id, svg] of Object.entries(svgs)) ART[id] = { ext: 'svg', data: Buffer.from(svg) }
  for (const [id, name] of Object.entries(readMap(html, at('const THEME_ART =')))) {
    const start = at(`const ${name} =`)
    const statement = html.slice(start, html.indexOf(';', start))
    // Built at runtime from an SVG constant: 'data:image/svg+xml,' + encodeURIComponent(X).
    const ref = statement.match(/encodeURIComponent\((\w+)\)/)
    if (ref) {
      ART[id] = { ext: 'svg', data: Buffer.from(readJsString(html, at(`const ${ref[1]} =`))) }
      continue
    }
    const value = readJsString(html, start)
    if (value.startsWith('data:image/jpeg;base64,')) ART[id] = { ext: 'jpg', data: Buffer.from(value.split(',')[1], 'base64') }
    else if (value.startsWith('data:image/png;base64,')) ART[id] = { ext: 'png', data: Buffer.from(value.split(',')[1], 'base64') }
    else if (value.startsWith('data:image/svg+xml,')) ART[id] = { ext: 'svg', data: Buffer.from(decodeURIComponent(value.slice(19))) }
  }
}

// Fonts: Arcade's Google Fonts request, family by family.
const ARCADE_FONTS = {}
{
  const link = html.match(/https:\/\/fonts\.googleapis\.com\/css2\?([^"']+)/)
  for (const part of (link ? link[1] : '').split('&')) {
    if (!part.startsWith('family=')) continue
    const spec = part.slice(7)
    ARCADE_FONTS[decodeURIComponent(spec.split(':')[0].replace(/\+/g, ' '))] = spec
  }
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------
/** Custom properties of every top-level rule whose only selector is exactly `selector`. */
function tokens(selector) {
  const out = {}
  for (const r of rules) {
    if (r.media || r.selectors.length !== 1 || r.selectors[0] !== selector) continue
    for (const [k, v] of declarations(r.body)) if (k.startsWith('--')) out[k] = v
  }
  return out
}
const scope = (id) => (id === 'felt' ? ':root:not([data-skin])' : `:root[data-skin="${id}"]`)
const lightOf = (id) => (id === 'felt' ? tokens(':root') : tokens(`:root[data-skin="${id}"]`))
const darkOf = (id) => (id === 'felt' ? tokens(':root[data-theme="dark"]') : tokens(`:root[data-skin="${id}"][data-theme="dark"]`))

// Felt is Arcade's default, so its colours sit in :root among the app's own
// settings: keep only the names some theme sets, and the felt pattern's own.
const THEME_KEYS = new Set(THEME_IDS.filter((id) => id !== 'felt').flatMap((id) => [...Object.keys(lightOf(id)), ...Object.keys(darkOf(id))]))
const filterFelt = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => THEME_KEYS.has(k) || k.startsWith('--felt-')))

function hex(value) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value).trim())
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a, b) {
  const x = hex(a)
  const y = hex(b)
  if (!x || !y) return 21
  const [l1, l2] = [luminance(x), luminance(y)].sort((p, q) => q - p)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Ink straight on the page background: the theme's ink, or its paper where the table is dark. */
function pageInk(t) {
  const onBg = contrast(t['--ink'], t['--bg']) >= 4.5 ? 'var(--ink)' : 'var(--surface)'
  const accent = ['--brass-text', '--brass', '--brass-soft'].find((k) => t[k] && contrast(t[k], t['--bg']) >= 3)
  return {
    '--on-bg': onBg,
    '--on-bg-2': `color-mix(in srgb, ${onBg} 72%, var(--bg))`,
    '--accent-on-bg': accent ? `var(${accent})` : onBg,
  }
}

// Arcade's colours onto this app's names. Accent fills are the theme's
// "brass"; accent text uses --brass-text where the theme has one. Repeated in
// the dark block: the app's own dark colours come later in the cascade.
const BRIDGE = {
  '--ink-2': 'var(--ink-soft)',
  '--ink-3': 'color-mix(in srgb, var(--ink-soft) 72%, var(--bg))',
  '--line-strong': 'color-mix(in srgb, var(--line) 70%, var(--ink))',
  '--surface-3': 'color-mix(in srgb, var(--surface-2) 82%, var(--ink))',
  '--accent': 'var(--brass)',
  '--accent-strong': 'var(--brass-text, color-mix(in srgb, var(--brass) 82%, var(--ink)))',
  '--accent-ink': 'var(--brass-ink)',
  '--accent-soft': 'color-mix(in srgb, var(--brass) 18%, var(--surface))',
  '--danger': 'var(--bad)',
  '--danger-soft': 'var(--bad-soft)',
  '--warn': 'var(--hanging)',
  '--warn-soft': 'color-mix(in srgb, var(--hanging) 18%, var(--surface))',
  '--board-line': 'var(--board-border)',
  '--board-coord-on-light': 'var(--board-dark)',
  '--board-coord-on-dark': 'var(--board-light)',
  '--board-last-move': 'color-mix(in srgb, var(--brass-soft) 45%, transparent)',
  '--paper': 'var(--surface)',
  '--paper-rule': 'color-mix(in srgb, var(--line) 30%, transparent)',
  '--paper-head-rule': 'color-mix(in srgb, var(--bad) 45%, transparent)',
  '--shadow-lg': 'var(--shadow)',
}

// ---------------------------------------------------------------------------
// Per-theme rules: what Arcade does to the page, board and pieces under a
// theme, mapped onto this app's elements. Anything else (Arcade's own drill
// cards, panels, buttons) has no counterpart here and is only counted.
// ---------------------------------------------------------------------------
function themeRules(id) {
  const base = scope(id)
  const found = { pattern: [], body: [], title: null, squares: [], last: [], pieces: [], frame: [], skipped: 0 }
  for (const r of rules) {
    for (const sel of r.selectors) {
      if (!sel.startsWith(base)) continue
      const rest = sel.slice(base.length)
      const decls = declarations(r.body)
      if (r.media) {
        found.skipped++
        continue
      }
      if (/^(:not\(\[data-custom-bg\]\))? body::before$/.test(rest)) found.pattern.push(...decls)
      else if (rest === ' body') found.body.push(...decls)
      else if (/\.title\b/.test(rest) && !found.title && decls.some(([k]) => k === 'font-family')) found.title = decls
      else if (rest === ' .sq.light' || rest === ' .sq.dark') found.squares.push({ which: rest.slice(5), decls })
      else if (rest === ' .sq.last-move') found.last.push(...decls)
      else if (rest === ' .board-frame' && decls.some(([k]) => k === 'border-image')) found.frame.push(...decls)
      else if (/piece-wrap|svg\[data-p/.test(rest)) {
        const mapped = rest
          .replace(/:is\(\.sq \.piece-wrap,\s*\.piece-wrap\.drag-ghost\)/g, '.board-piece')
          .replace(/\.sq \.piece-wrap/g, '.board-piece')
          .replace(/\.piece-wrap/g, '.board-piece')
          .replace(/:has\(>\s*/g, ':has(')
        // Arcade lays its piece wrapper out its own way: on the piece itself only the look comes over.
        const look = mapped.includes('::') ? decls : decls.filter(([k]) => !LAYOUT.includes(k))
        if (/drag-ghost|#board|move-ring|plaque|promo|picked|\.sq\b/.test(mapped)) found.skipped++
        else if (look.length) found.pieces.push({ sel: mapped, decls: look })
      } else found.skipped++
    }
  }
  // A theme that doesn't set its own title face uses Arcade's default (h1.title): only the face comes over.
  if (!found.title) {
    const r = rules.find((x) => !x.media && x.selectors.some((t) => t === 'h1.title' || t === '.title') && declarations(x.body).some(([k]) => k === 'font-family'))
    if (r) found.title = pick(declarations(r.body), ['font-family', 'letter-spacing'])
  }
  return found
}

const LAYOUT = ['position', 'display', 'width', 'height', 'inset', 'top', 'left', 'right', 'bottom', 'margin', 'transform']
const declBlock = (decls, indent = '  ') => decls.map(([k, v]) => `${indent}${k}: ${v};`).join('\n')
const pick = (decls, names) => decls.filter(([k]) => names.includes(k))

// ---------------------------------------------------------------------------
// Build everything in memory, then write what changed.
// ---------------------------------------------------------------------------
const outputs = new Map() // path relative to ROOT -> Buffer|string
const themes = []
const css_ = []
const fontsNeeded = new Set()
const report = []

css_.push(`/* ---------------------------------------------------------------------------
   Generated by scripts/import-arcade-themes.mjs from Chess Arcade (${sourceHash}).
   Do not edit: change scripts/arcade-themes.config.json (or skins.css, for the
   app's own touches) and run the importer again.
   --------------------------------------------------------------------------- */

/* A preview card wears only its own theme: nothing leaks in from the page's. */
.skin-surface[data-skin] { --brass-text: initial; --pw-white-fill: initial; --pw-black-fill: initial; --pw-stroke: initial; --pw-detail: initial; }
`)

for (const id of THEME_IDS) {
  const cfg = config.themes?.[id] ?? {}
  const light0 = id === 'felt' ? filterFelt(lightOf(id)) : lightOf(id)
  const dark0 = { ...light0, ...(id === 'felt' ? filterFelt(darkOf(id)) : darkOf(id)) }
  if (!light0['--bg']) {
    report.push(`${id}: no colours found in Arcade, skipped`)
    continue
  }
  const found = themeRules(id)
  const fontOf = (decls) => decls.find(([k]) => k === 'font-family')?.[1]
  const display = cfg.display ?? (found.title ? fontOf(found.title) : null) ?? "'Fraunces', Georgia, serif"
  const body = fontOf(found.body)
  for (const f of [display, body]) if (f) fontsNeeded.add(f.split(',')[0].replace(/["']/g, '').trim())
  const themePieces = Boolean(light0['--pw-white-fill'] || light0['--pw-black-fill'])
  const art = ART[id] ? `/skins/${id}-bg.${ART[id].ext}` : null
  const sounds = Object.keys(SKIN_SOUNDS[id] ?? {})

  const tokenBlock = (t, extra) =>
    declBlock([
      ...Object.entries(t),
      ...(t['--brass-text'] ? [] : [['--brass-text', 'initial']]),
      ...Object.entries(BRIDGE),
      ...Object.entries(pageInk(t)),
      ['--font-display', display],
      ...(body ? [['--font-sans', body]] : []),
      ...Object.entries({ ...(cfg.tokens ?? {}), ...extra }),
    ])
  const sel = (s = '') => `:root[data-skin="${id}"]${s}, .skin-surface[data-skin="${id}"]${s}`
  const label = cfg.label ?? SKIN_LABEL[id]
  css_.push(`/* ============ ${label.toUpperCase()} ============ */
${sel()} {
${tokenBlock(light0, cfg.lightTokens ?? {})}
}
:root[data-theme='dark'][data-skin="${id}"], :root[data-theme='dark'] .skin-surface[data-skin="${id}"] {
${tokenBlock(dark0, cfg.darkTokens ?? {})}
}`)

  // The page: the theme's pattern; its artwork on top unless switched off on this device.
  if (found.pattern.length) {
    css_.push(`:root[data-skin="${id}"] body::before, .skin-surface[data-skin="${id}"] {\n${declBlock(found.pattern)}\n}`)
  }
  if (art) {
    css_.push(`:root[data-skin="${id}"]:not([data-art-off~="${id}"]) body::before,
:root:not([data-art-off~="${id}"]) .skin-surface[data-skin="${id}"] {
  background-image: linear-gradient(var(--bg-scrim), var(--bg-scrim)), url('${art}');
  background-size: cover; background-position: center center; background-repeat: no-repeat;
}`)
  }
  // Display type: the font-display utility is compiled to Fraunces, so point it at the theme's face.
  const titleLook = pick(found.title ?? [], ['font-style', 'font-weight', 'letter-spacing'])
  css_.push(`:is(:root[data-skin="${id}"], .skin-surface[data-skin="${id}"]) .font-display {\n  font-family: var(--font-display);${titleLook.length ? '\n' + declBlock(titleLook) : ''}\n}`)

  // The board.
  const analysis = !cfg.analysisFromRepertoireLab
  for (const { which, decls } of found.squares) {
    css_.push(`[data-skin="${id}"] .board-sq.${which} {\n${declBlock(decls)}\n}`)
    if (analysis) {
      const forced = decls.map(([k, v]) => [k, k === 'background-color' ? `${v} !important` : v])
      css_.push(`.rl-analysis[data-rl-skin='${id}'] [data-square-color='${which === 'light' ? 'white' : 'black'}'] {\n${declBlock(forced)}\n}`)
    }
  }
  if (found.last.length) css_.push(`[data-skin="${id}"] .board-last {\n  background: transparent;\n${declBlock(found.last)}\n}`)
  if (found.frame.length) {
    // The board sets its border inline as a shorthand, which resets border-image: hence !important.
    css_.push(`[data-skin="${id}"] .board-frame:not([data-bare]) {
  border-style: solid !important;
  border-color: transparent !important;
  border-width: max(6px, 1.9cqw) !important;
${declBlock(pick(found.frame, ['border-image', 'border-image-source', 'border-image-slice', 'border-image-repeat']).map(([k, v]) => [k, `${v} !important`]))}
}`)
  }
  // The pieces: the treatment every piece gets, and per-piece colours (data-p).
  for (const { sel: s, decls } of found.pieces) {
    css_.push(`[data-skin="${id}"]${s} {\n${declBlock(decls)}\n}`)
    // The analysis board's Theme Staunton pieces sit in a span of their own.
    if (analysis && s.startsWith(' .board-piece')) {
      css_.push(`.rl-analysis[data-rl-skin='${id}'] [data-piece] > span${s.slice(' .board-piece'.length)} {\n${declBlock(decls)}\n}`)
    }
  }

  // Assets.
  if (art) outputs.set(`public/skins/${id}-bg.${ART[id].ext}`, ART[id].data)
  for (const [key, uri] of Object.entries(SKIN_SOUNDS[id] ?? {})) {
    outputs.set(`public/sounds/themes/${id}/${key}.mp3`, Buffer.from(uri.split(',')[1], 'base64'))
  }

  const pal = (t) => ({
    '--bg': t['--bg'], '--panel': t['--surface'], '--card': t['--surface-2'],
    '--card-hover': `color-mix(in srgb, ${t['--surface-2']} 90%, ${t['--ink']})`,
    '--border': t['--line'], '--text': t['--ink'], '--muted': t['--ink-soft'],
    '--accent': t['--brass-text'] ?? t['--brass'], '--accent-dim': t['--brass-soft'],
    '--green': t['--good'], '--red': t['--bad'], '--amber': t['--hanging'], '--track': t['--surface-2'],
    boardLight: t['--board-light'], boardDark: t['--board-dark'],
    pieceLight: t['--pw-white-fill'] ?? '#ffffff', pieceDark: t['--pw-black-fill'] ?? '#000000',
  })
  themes.push({
    id,
    label,
    description: cfg.description ?? `${label}, from Chess Arcade.`,
    suggestedPieceSet: cfg.suggestedPieceSet ?? (themePieces ? 'staunton' : 'classic'),
    dark: cfg.dark ?? luminance(hex(light0['--bg']) ?? [1, 1, 1]) < 0.05,
    art: Boolean(art),
    themePieces,
    sounds,
    ...(analysis ? { palette: { light: pal(light0), dark: pal(dark0) } } : {}),
  })
  report.push(`${id.padEnd(11)} ${label.padEnd(16)} pattern:${found.pattern.length ? 'y' : '-'} art:${art ? 'y' : '-'} squares:${found.squares.length} pieces:${found.pieces.length} frame:${found.frame.length ? 'y' : '-'} sounds:${sounds.length} theme-pieces:${themePieces ? 'y' : '-'} (Arcade-only rules skipped: ${found.skipped})`)
}

for (const [key, uri] of Object.entries(SOUND_DATA)) outputs.set(`public/sounds/${key}.mp3`, Buffer.from(uri.split(',')[1], 'base64'))
outputs.set(OUT_CSS, css_.join('\n\n') + '\n')
outputs.set(
  OUT_TS,
  `// Generated by scripts/import-arcade-themes.mjs from Chess Arcade (${sourceHash}).
// Do not edit: change scripts/arcade-themes.config.json and run the importer again.

export interface ArcadeTheme {
  id: string
  label: string
  description: string
  /** The piece set Chess Arcade pairs with this theme; the coach can override. */
  suggestedPieceSet: 'classic' | 'bauhaus' | 'wavy' | 'staunton'
  /** Nocturnal by nature: its light mode is already dark chrome. */
  dark: boolean
  /** Ships artwork (public/skins/<id>-bg.*); a switch in Settings puts its pattern back. */
  art: boolean
  /** Colours the Theme Staunton pieces: choosing the theme puts those pieces on. */
  themePieces: boolean
  /** The events it has its own sound for (public/sounds/themes/<id>/<event>.mp3). */
  sounds: string[]
  /** The analysis board's colours, for themes Repertoire Lab has no palette for. */
  palette?: { light: Record<string, string>; dark: Record<string, string> }
}

export const ARCADE_SOURCE = '${sourceHash}'

export const ARCADE_THEMES: ArcadeTheme[] = ${JSON.stringify(themes, null, 2)}
`,
)

// Fonts: add any family the themes use that index.html doesn't load yet (never removes one).
{
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  const m = indexHtml.match(/https:\/\/fonts\.googleapis\.com\/css2\?([^"']+)/)
  if (m) {
    const have = new Set(m[1].split('&').filter((p) => p.startsWith('family=')).map((p) => decodeURIComponent(p.slice(7).split(':')[0].replace(/\+/g, ' '))))
    const add = [...fontsNeeded].filter((f) => !have.has(f) && ARCADE_FONTS[f]).map((f) => `family=${ARCADE_FONTS[f]}`)
    if (add.length) {
      const query = m[1].replace(/&display=swap/, '') + '&' + add.join('&') + (m[1].includes('display=swap') ? '&display=swap' : '')
      outputs.set('index.html', indexHtml.replace(m[1], query))
    }
  }
}

// ---------------------------------------------------------------------------
// Compare, write, report.
// ---------------------------------------------------------------------------
const changed = []
for (const [rel, content] of outputs) {
  const file = path.join(ROOT, rel)
  const next = Buffer.isBuffer(content) ? content : Buffer.from(content)
  const now = fs.existsSync(file) ? fs.readFileSync(file) : null
  if (now && now.equals(next)) continue
  changed.push(`${now ? 'update' : 'new   '} ${rel}`)
  if (!CHECK) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, next)
  }
}
// What Arcade no longer ships: artwork and sound files of its themes that nothing produced.
const stale = []
for (const id of THEME_IDS) {
  for (const ext of ['svg', 'jpg', 'png']) {
    const rel = `public/skins/${id}-bg.${ext}`
    if (fs.existsSync(path.join(ROOT, rel)) && !outputs.has(rel)) stale.push(rel)
  }
  const dir = path.join(ROOT, `public/sounds/themes/${id}`)
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (!outputs.has(`public/sounds/themes/${id}/${f}`)) stale.push(`public/sounds/themes/${id}/${f}`)
}
if (PRUNE && !CHECK) for (const rel of stale) fs.rmSync(path.join(ROOT, rel))

console.log(`Chess Arcade ${sourceHash}: ${themes.length} themes`)
for (const line of report) console.log('  ' + line)
const known = new Set(Object.keys(config.themes ?? {}))
const fresh = themes.filter((t) => !known.has(t.id)).map((t) => t.label)
if (fresh.length) console.log(`New in Arcade (imported with defaults; add them to the config to tune): ${fresh.join(', ')}`)
console.log(changed.length ? `${CHECK ? 'Out of date' : 'Wrote'}:\n  ${changed.join('\n  ')}` : 'Everything is up to date.')
if (stale.length) console.log(`${PRUNE && !CHECK ? 'Deleted' : 'No longer in Arcade (run with --prune to delete)'}:\n  ${stale.join('\n  ')}`)
if (CHECK && (changed.length || stale.length)) process.exit(1)
