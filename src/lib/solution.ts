import { Chess } from 'chess.js'
import type { BoardArrow, Puzzle } from '../types/domain'
import { normalizeFen } from './fen'

export interface LineStep {
  /** 0 is the starting position; n is after the n-th answer move. */
  index: number
  fen: string
  san?: string
  from?: string
  to?: string
  comment?: string
  /** The move as an arrow, for drawing it on the board. */
  arrow?: BoardArrow
}

const MOVE_ARROW = '#15781b'

/**
 * Walk the recorded answer from the starting position, working out which
 * squares each move touches so the board can draw it. Falls back to the
 * stored FENs when a move can't be replayed (illegal set-ups still present).
 */
export function lineSteps(puzzle: Puzzle): LineStep[] {
  const start = normalizeFen(puzzle.starting_fen, puzzle.side_to_move)
  const steps: LineStep[] = [{ index: 0, fen: start }]
  let chess: Chess | null = null
  try {
    chess = new Chess(start)
  } catch {
    chess = null
  }
  puzzle.solution.forEach((move, i) => {
    let from: string | undefined
    let to: string | undefined
    let fen = move.fen
    if (chess) {
      try {
        const played = chess.move(move.san)
        from = played.from
        to = played.to
        fen = chess.fen()
      } catch {
        chess = null
      }
    }
    steps.push({
      index: i + 1,
      fen: fen || steps[i].fen,
      san: move.san,
      from,
      to,
      comment: move.comment || undefined,
      arrow: from && to ? { startSquare: from, endSquare: to, color: MOVE_ARROW } : undefined,
    })
  })
  return steps
}

/**
 * Why a recorded answer can't be played from its position, or null when it
 * can. Imported lessons carry a few of these (a castling move on a position
 * saved without castling rights, a move typed for the wrong square); the coach
 * needs to see them before the lesson, not at the table.
 */
export function answerProblem(puzzle: Puzzle): string | null {
  if (puzzle.solution.length === 0) return null
  const steps = lineSteps(puzzle)
  const bad = steps.find((s) => s.index > 0 && !s.from)
  if (!bad) return null
  const legalUpTo = bad.index - 1
  return legalUpTo === 0
    ? `${bad.san} isn't a legal move from this position — re-record the answer.`
    : `${bad.san} isn't legal after move ${legalUpTo} — re-record the answer from there.`
}

/** "1. Rf8" / "1… Rf8" style label for the n-th answer move. */
export function stepLabel(puzzle: Puzzle, index: number): string {
  const startsBlack = puzzle.side_to_move === 'b'
  const half = index - 1 + (startsBlack ? 1 : 0)
  const number = 1 + Math.floor(half / 2)
  return half % 2 === 0 ? `${number}.` : `${number}…`
}
