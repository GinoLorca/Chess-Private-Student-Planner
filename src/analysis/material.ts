import { Chess } from 'chess.js'

// Material captured, chess.com style (Repertoire Lab's src/lib/material.js) —
// computed straight from the position rather than by replaying capture moves,
// so it's correct for any FEN. A promoted pawn reads as a "captured" pawn the
// same way it does on chess.com.

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }
const START_COUNTS: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 }
// Highest value first, the way chess.com orders the captured-piece icons.
const ICON_ORDER = ['q', 'r', 'b', 'n', 'p']

export interface Material {
  capturedByWhite: string[]
  capturedByBlack: string[]
  /** Positive: White is ahead. */
  diff: number
}

export function materialDiff(chess: Chess | string): Material {
  const game = typeof chess === 'string' ? new Chess(chess) : chess
  const counts: Record<'w' | 'b', Record<string, number>> = { w: {}, b: {} }
  for (const row of game.board()) {
    for (const sq of row) {
      if (!sq) continue
      counts[sq.color][sq.type] = (counts[sq.color][sq.type] ?? 0) + 1
    }
  }
  const missing = (side: 'w' | 'b') => {
    const out: string[] = []
    for (const type of ICON_ORDER) {
      const short = Math.max(0, (START_COUNTS[type] ?? 0) - (counts[side][type] ?? 0))
      for (let i = 0; i < short; i += 1) out.push(type)
    }
    return out
  }
  const capturedByWhite = missing('b')
  const capturedByBlack = missing('w')
  const points = (arr: string[]) => arr.reduce((sum, t) => sum + (VALUES[t] ?? 0), 0)
  return { capturedByWhite, capturedByBlack, diff: points(capturedByWhite) - points(capturedByBlack) }
}
