import { Chess } from 'chess.js'
import type { Puzzle } from '../types/domain'
import { normalizeFen } from './fen'
import { lineSteps, sameMove } from './solution'

/**
 * Moves and squares named in an explanation, worked out against the position
 * so each can be shown on the board. Explanations are written the way books
 * write them: the answer's own moves ("15.Nxe5!"), side lines ("1.Kd1? Bf5
 * 2.Qe3 Nxc2"), threats ("Black is threatening ...Bf5") and squares ("the
 * c6-knight"). Each mention is replayed from the position it belongs to; one
 * that can't be played legally there stays plain text, so a tap never shows
 * a wrong position.
 */

export interface Ply {
  san: string
  from: string
  to: string
  /** The position after this move. */
  fen: string
}

/** A side line, from the starting position: the answer's moves it shares, then its own. */
export interface SideLine {
  id: number
  plies: Ply[]
  /** The first ply that isn't the answer's. */
  branch: number
}

export type MentionTarget =
  /** One of the answer's moves: step n of the answer. */
  | { kind: 'main'; step: number }
  /** A move of a side line: the line, and which of its plies. */
  | { kind: 'line'; line: SideLine; ply: number }
  /** A move threatened in a position where it isn't that side's turn. */
  | { kind: 'threat'; fen: string; san: string; from: string; to: string; black: boolean }
  /** A square: lit on whatever the board shows. */
  | { kind: 'square'; square: string }

export interface Mention {
  start: number
  end: number
  target: MentionTarget
}

/** Where a text's mentions are read from: the start, or the move a comment belongs to. */
export interface MentionText {
  text: string
  /** The answer step the text is about (0 = the starting position). */
  at?: number
}

const SAN = String.raw`(?:O-O-O|O-O|0-0-0|0-0|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8](?:=?[QRBN])?|[a-h][1-8](?:=?[QRBN])?)`
// An optional move number ("15." / "15..." / "15…") or a bare "...", the move,
// then check and the book's !/? marks. Not inside a word or after a hyphen.
const TOKEN = new RegExp(String.raw`(?<![\w\-.…])(?:(\d{1,3})\s?(\.{3}|…|\.)\s?|(\.{2,3}|…)\s?)?(${SAN})([+#]?)([!?]{0,2})(?![\w])`, 'g')

interface Token {
  start: number
  end: number
  number: number | null
  /** Written as Black's move: "15...Nf6" or "...Nf6". */
  black: boolean | null
  san: string
  /** Bare square-shaped pawn moves ("e4") are often just squares. */
  bare: boolean
  marked: boolean
}

function tokenize(text: string): Token[] {
  const out: Token[] = []
  for (const m of text.matchAll(TOKEN)) {
    const start = m.index ?? 0
    const end = start + m[0].length
    const [, num, dots, lead, san, check, marks] = m
    // "a1-h8" is a diagonal, not two squares.
    if (/^[a-h][1-8]$/.test(san) && /^-[a-h][1-8]/.test(text.slice(end))) continue
    const black = num ? dots !== '.' : lead ? true : null
    out.push({
      start,
      end,
      number: num ? Number(num) : null,
      black,
      san: san.replace(/0/g, 'O'),
      bare: /^[a-h][1-8]$/.test(san) && !num && !lead && !check && !marks,
      marked: Boolean(check || marks),
    })
  }
  return out
}

function tryMove(fen: string, san: string): Ply | null {
  try {
    const chess = new Chess(fen)
    const played = chess.move(san)
    return { san: played.san, from: played.from, to: played.to, fen: chess.fen() }
  } catch {
    return null
  }
}

function turnOf(fen: string) {
  return fen.split(' ')[1] === 'b'
}

/** The same position with the other side to move, for showing a threat. */
function passTurn(fen: string) {
  const p = fen.split(' ')
  p[1] = p[1] === 'w' ? 'b' : 'w'
  p[3] = '-'
  return p.join(' ')
}

interface Line {
  plies: Ply[]
  side: SideLine | null
}

/**
 * Every mention in the texts of one position, text by text. The texts share
 * the move numbering, lined up with the answer's: explanations often use the
 * game's numbers ("15.Nxe5") where the answer counts from 1.
 */
export function findMentions(puzzle: Puzzle, texts: MentionText[]): Mention[][] {
  const start = normalizeFen(puzzle.starting_fen, puzzle.side_to_move)
  const steps = lineSteps(puzzle)
  const main: Ply[] = []
  for (const s of steps.slice(1)) {
    if (!s.from || !s.to || !s.san) break
    main.push({ san: s.san, from: s.from, to: s.to, fen: s.fen })
  }
  // Answer moves past one that doesn't replay can't be shown; their mentions stay plain.
  const unplayable = puzzle.solution.slice(main.length).map((m) => m.san)
  const startsBlack = turnOf(start)
  const blackAt = (ply: number) => (ply + (startsBlack ? 1 : 0)) % 2 === 1
  const moveNumberAt = (ply: number) => Math.floor((ply + (startsBlack ? 1 : 0)) / 2)

  const tokens = texts.map((t) => tokenize(t.text))
  // Which number the first move has, in the order to try: lined up by a
  // numbered mention of the answer's first move, else the position's own
  // number; then lined up by any answer move; then 1.
  const numbered = tokens.flat().filter((t) => t.number !== null)
  const alignedTo = (j: number) => {
    const t = numbered.find((n) => sameMove(main[j].san, n.san) && blackAt(j) === n.black)
    return t ? (t.number as number) - moveNumberAt(j) : null
  }
  const firstAligned = main.length ? alignedTo(0) : null
  const anyAligned = main.map((_, j) => alignedTo(j)).find((b) => b !== null) ?? null
  const bases = [...new Set([firstAligned ?? (Number(start.split(' ')[5]) || 1), anyAligned ?? 1, 1])]
  const plyOf = (number: number, black: boolean, first: number) => (number - first) * 2 + (black ? 1 : 0) - (startsBlack ? 1 : 0)

  const mainLine: Line = { plies: main, side: null }
  const sides: SideLine[] = []
  const before = (line: Line, ply: number) => (ply === 0 ? start : line.plies[ply - 1].fen)
  const isMainPrefix = (plies: Ply[], upTo: number) => upTo <= main.length && plies.slice(0, upTo).every((p, i) => p.san === main[i].san)

  /** Play a move at a ply of a line: the line's own move, its next move, or a new branch. */
  function place(line: Line, ply: number, san: string): { line: Line; ply: number } | null {
    if (ply < 0 || ply > line.plies.length) return null
    const played = tryMove(before(line, ply), san)
    if (!played) return null
    if (ply < line.plies.length && line.plies[ply].san === played.san) return { line, ply }
    if (ply === line.plies.length && line.side) {
      line.plies.push(played)
      return { line, ply }
    }
    const plies = [...line.plies.slice(0, ply), played]
    if (isMainPrefix(plies, plies.length)) return { line: mainLine, ply }
    // The same moves mentioned twice are one line, so both light up together.
    const same = sides.find((s) => s.plies.length === plies.length && s.plies.every((p, i) => p.san === plies[i].san))
    if (same) return { line: { plies: same.plies, side: same }, ply }
    const side: SideLine = { id: sides.length + 1, plies, branch: plies.findIndex((p, i) => i >= main.length || p.san !== main[i].san) }
    sides.push(side)
    return { line: { plies, side }, ply }
  }

  /** The other side's move, where it isn't their turn: what they threaten. */
  function threatAt(fen: string, t: Token): MentionTarget | null {
    if (t.black === turnOf(fen)) return null
    const ply = tryMove(passTurn(fen), t.san)
    return ply ? { kind: 'threat', fen, san: ply.san, from: ply.from, to: ply.to, black: !turnOf(fen) } : null
  }

  function targetOf(line: Line, ply: number): MentionTarget {
    if (!line.side || isMainPrefix(line.plies, ply + 1)) return { kind: 'main', step: ply + 1 }
    return { kind: 'line', line: line.side, ply }
  }

  return texts.map((text, ti) => {
    const out: Mention[] = []
    const home = { line: mainLine, ply: Math.min(text.at ?? 0, main.length) }
    // Where the discussion is: the line last talked about, and how far along it.
    let cursor = home
    let prevEnd = -1
    let placedEnd = -1
    let prev: 'none' | 'placed' | 'failed' = 'none'
    for (const t of tokens[ti]) {
      const first = prevEnd < 0
      const gap = first ? '' : text.text.slice(prevEnd, t.start)
      prevEnd = t.end
      // Only spaces or commas since the last move: "2.Qe3 Nxc2" goes on with the line.
      const follows = /^[\s,]*$/.test(gap)
      // A sentence ended since the last move placed: the discussion starts over.
      const newSentence = placedEnd < 0 || /[.!?]\s|\n/.test(text.text.slice(placedEnd, t.start))
      const threatened = /threat(?:en(?:s|ing)?)?(?:\s+(?:is|to|of|with|play|playing))*\s*$/i.test(text.text.slice(Math.max(0, t.start - 40), t.start))
      const here = before(cursor.line, cursor.ply)
      const colourOk = (fen: string) => t.black === null || turnOf(fen) === t.black

      let placed: { line: Line; ply: number } | null = null
      let threat: MentionTarget | null = null
      const answerMatch = main.findIndex((m, i) => sameMove(m.san, t.san) && (t.black === null || blackAt(i) === t.black))

      if (prev === 'failed' && follows) {
        // The rest of a line that couldn't be played: plain too.
      } else if (answerMatch < 0 && unplayable.some((san) => sameMove(san, t.san))) {
        // An answer move that doesn't replay: plain.
      } else if (t.number !== null && t.black !== null) {
        // A numbered move: on the line under discussion, else the answer's, at that number.
        for (const first of bases) {
          const ply = plyOf(t.number, t.black, first)
          placed = place(cursor.line, ply, t.san) ?? place(mainLine, ply, t.san)
          if (placed) break
        }
        // "White's threat is 2.d5": a numbered move for the side not to move.
        if (!placed && threatened) threat = threatAt(here, t) ?? threatAt(start, t)
      } else {
        if (prev === 'placed' && /^\s*(?:\/|or|,\s*or)\s*$/.test(gap)) {
          // "Ke5/Kf5", "Ne7 or Nf6": another move in the same place.
          placed = place(cursor.line, cursor.ply - 1, t.san)
        }
        if (!placed && prev === 'placed' && follows) placed = place(cursor.line, cursor.ply, t.san)
        if (!placed && threatened) threat = threatAt(here, t)
        if (!placed && !threat && answerMatch >= 0) placed = { line: mainLine, ply: answerMatch }
        if (!placed && !threat && (!t.bare || threatened)) {
          const fromStart = () => (colourOk(start) ? place(mainLine, 0, t.san) : null)
          const fromHere = () => (colourOk(here) ? place(cursor.line, cursor.ply, t.san) : null)
          if (newSentence) {
            // A new sentence starts from the position again: an alternative, or a threat in it.
            const homeFen = before(home.line, home.ply)
            placed = (home.ply === 0 ? fromStart() : colourOk(homeFen) ? place(mainLine, home.ply, t.san) : null) ?? null
            if (!placed) threat = threatAt(homeFen, t)
            if (!placed && !threat) placed = fromHere()
          } else {
            // Mid-sentence: the line being talked about, else a threat in it.
            placed = fromHere()
            if (!placed) threat = threatAt(here, t)
          }
          // Any position of the answer where that side is to move.
          for (let k = 1; !placed && !threat && k <= main.length; k++) {
            if (colourOk(before(mainLine, k))) placed = place(mainLine, k, t.san)
          }
        }
      }

      if (placed) {
        out.push({ start: t.start, end: t.end, target: targetOf(placed.line, placed.ply) })
        cursor = { line: placed.line, ply: placed.ply + 1 }
        placedEnd = t.end
        prev = 'placed'
      } else if (threat) {
        out.push({ start: t.start, end: t.end, target: threat })
        prev = 'none'
      } else if (t.bare) {
        // A square-shaped word that isn't a move here: the square itself.
        out.push({ start: t.start, end: t.end, target: { kind: 'square', square: t.san } })
        prev = 'none'
      } else {
        prev = 'failed'
      }
    }
    return out
  })
}
