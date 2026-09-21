#!/usr/bin/env node
/**
 * fens-to-line: turn a sequence of FENs (one position per line, as stepped
 * through a Chessable variation) into one line per variation:
 *
 *   <starting FEN> 5...Red8 6.f3 Be6 7.Rbd1 Rd4 8.Kf2 Rbd8
 *
 * Grouping rules, in order:
 *   - a blank line, or a line starting with '#', ends the current group
 *     (a '# ...' line becomes the title of the group that follows it)
 *   - a FEN that is not exactly one legal move after the previous FEN starts
 *     a new group (so a raw dump of several variations back to back still
 *     splits correctly)
 *   - a FEN identical to the previous one is skipped
 *
 * Usage:
 *   node tools/chessable/2026-09-21-fens-to-line.mjs [file ...] [--pgn] [--no-titles]
 *   cat fens.txt | node tools/chessable/2026-09-21-fens-to-line.mjs
 *
 *   --pgn         write each group as a PGN game with a [FEN] header instead
 *                 (that form pastes straight into the planner's Quick add)
 *   --no-titles   drop the '# title' comment lines from the output
 *
 * Also importable: groupTokens / renderGroups / moveBetween / formatMoves.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Chess } from 'chess.js'

export const FEN_RE =
  /^([rnbqkpRNBQKP1-8]{1,8}\/){7}[rnbqkpRNBQKP1-8]{1,8}\s+[wb](\s+(-|[KQkqA-Ha-h]{1,4}))?(\s+(-|[a-h][36]))?(\s+\d+)?(\s+\d+)?$/

/** All six FEN fields, defaults filled in. */
export function normalizeFen(fen) {
  const p = fen.trim().split(/\s+/)
  return `${p[0]} ${p[1] ?? 'w'} ${p[2] ?? '-'} ${p[3] ?? '-'} ${p[4] ?? '0'} ${p[5] ?? '1'}`
}

/** Placement + side to move: what identifies a position when comparing two FENs. */
export function positionKey(fen) {
  const [placement, side] = fen.trim().split(/\s+/)
  return `${placement} ${side ?? 'w'}`
}

/** SAN of the one legal move that takes `from` to `to`, or null if there is none. */
export function moveBetween(from, to) {
  let chess
  try {
    chess = new Chess(normalizeFen(from))
  } catch {
    return null
  }
  const target = positionKey(to)
  for (const m of chess.moves({ verbose: true })) {
    if (positionKey(m.after) === target) return m.san
  }
  return null
}

/**
 * "5...Red8 6.f3 Be6" for a line that starts from `startFen`.
 * With `pgn: true` the spacing is standard PGN ("5... Red8 6. f3 Be6").
 */
export function formatMoves(startFen, sans, { pgn = false } = {}) {
  const [, side, , , , fullmove] = normalizeFen(startFen).split(' ')
  let number = Number(fullmove) || 1
  let white = side !== 'b'
  const sep = pgn ? ' ' : ''
  const out = []
  sans.forEach((san, i) => {
    if (white) {
      out.push(`${number}.${sep}${san}`)
    } else {
      out.push(i === 0 ? `${number}...${sep}${san}` : san)
      number++
    }
    white = !white
  })
  return out.join(' ')
}

/**
 * Tokenise the text form: FEN lines, '# title' lines and blank-line breaks.
 * Anything else is reported back as a note rather than dropped silently.
 */
export function parseInput(text) {
  const tokens = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      tokens.push({ type: 'break' })
    } else if (line.startsWith('#')) {
      tokens.push({ type: 'title', text: line.replace(/^#+\s*/, '') })
    } else if (FEN_RE.test(line)) {
      tokens.push({ type: 'fen', fen: line })
    } else {
      tokens.push({ type: 'junk', text: line })
    }
  }
  return tokens
}

/**
 * Walk the tokens into groups: { title, start, fens, sans, notes }.
 * `fens` holds every position of the group including the start.
 */
export function groupTokens(tokens) {
  const groups = []
  let current = null
  let pendingTitle = ''
  const close = () => {
    current = null
  }
  const open = (fen) => {
    current = { title: pendingTitle, start: fen, fens: [fen], sans: [], notes: [] }
    pendingTitle = ''
    groups.push(current)
  }

  for (const token of tokens) {
    if (token.type === 'break') {
      close()
      continue
    }
    if (token.type === 'title') {
      close()
      pendingTitle = token.text
      continue
    }
    if (token.type === 'junk') {
      const target = current ?? groups[groups.length - 1]
      const note = `ignored a line that isn't a FEN: "${token.text.slice(0, 60)}"`
      if (target) target.notes.push(note)
      else groups.push({ title: pendingTitle, start: '', fens: [], sans: [], notes: [note] })
      continue
    }
    if (!current) {
      open(token.fen)
      continue
    }
    const last = current.fens[current.fens.length - 1]
    if (positionKey(last) === positionKey(token.fen)) continue // the same position again
    const san = moveBetween(last, token.fen)
    if (san) {
      current.sans.push(san)
      current.fens.push(token.fen)
    } else {
      current.notes.push('the next FEN was not one legal move away, so a new group starts there')
      close()
      open(token.fen)
    }
  }
  return groups.filter((g) => g.start || g.notes.length)
}

/** One text line per group (or one PGN game per group with `pgn`). */
export function renderGroups(groups, { pgn = false, titles = true } = {}) {
  const blocks = []
  for (const g of groups) {
    if (!g.start) continue
    if (pgn) {
      const headers = []
      if (titles && g.title) headers.push(`[Event "${g.title.replace(/"/g, "'")}"]`)
      headers.push('[SetUp "1"]', `[FEN "${normalizeFen(g.start)}"]`)
      const moves = formatMoves(g.start, g.sans, { pgn: true })
      blocks.push(`${headers.join('\n')}\n\n${moves ? `${moves} *` : '*'}`)
    } else {
      const moves = formatMoves(g.start, g.sans)
      const line = moves ? `${g.start} ${moves}` : g.start
      blocks.push(titles && g.title ? `# ${g.title}\n${line}` : line)
    }
  }
  return blocks.join(pgn ? '\n\n' : titles && groups.some((g) => g.title) ? '\n\n' : '\n')
}

export function convert(text, opts = {}) {
  const groups = groupTokens(parseInput(text))
  return { groups, output: renderGroups(groups, opts) }
}

function readAll(files) {
  if (files.length === 0) return readFileSync(0, 'utf8')
  return files.map((f) => readFileSync(f, 'utf8')).join('\n\n')
}

function main(argv) {
  const files = []
  const opts = { pgn: false, titles: true }
  for (const arg of argv) {
    if (arg === '--pgn') opts.pgn = true
    else if (arg === '--no-titles') opts.titles = false
    else if (arg === '-h' || arg === '--help') {
      console.log(
        'usage: fens-to-line [file ...] [--pgn] [--no-titles]\n' +
          'Reads FENs one per line (files or stdin); prints one "<start FEN> <moves>" line per variation.',
      )
      return 0
    } else if (arg.startsWith('-')) {
      console.error(`unknown option ${arg}`)
      return 2
    } else files.push(arg)
  }
  const { groups, output } = convert(readAll(files), opts)
  if (output) console.log(output)
  for (const [i, g] of groups.entries()) {
    for (const note of g.notes) console.error(`group ${i + 1}${g.title ? ` (${g.title})` : ''}: ${note}`)
  }
  return groups.length ? 0 : 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2))
}
