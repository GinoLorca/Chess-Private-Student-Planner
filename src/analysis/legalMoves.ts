import { Chess, type Square } from 'chess.js'

// Repertoire Lab's board helpers (src/lib/legalMoves.js there).

/** Square name -> board coordinates in "cells from the top-left", honouring which way the board is facing. */
export function squareCell(square: string, orientation: 'white' | 'black') {
  const file = square.charCodeAt(0) - 97 // a..h -> 0..7
  const rank = Number(square[1]) - 1 // 1..8 -> 0..7
  return orientation === 'black' ? { x: 7 - file, y: rank } : { x: file, y: 7 - rank }
}

/** The square of the king that's in check, if any. */
export function checkedKingSquare(game: Chess | null): Square | null {
  if (!game) return null
  try {
    if (!game.inCheck()) return null
    const turn = game.turn()
    for (const row of game.board()) {
      for (const piece of row) {
        if (piece && piece.type === 'k' && piece.color === turn) return piece.square
      }
    }
  } catch {
    // an empty or invalid position simply has no check
  }
  return null
}

// The pale yellow chess.com leaves on the square a piece came from and the one
// it landed on. backgroundColor, not the background shorthand, so nothing laid
// over the same square later loses its own background longhands.
export const LAST_MOVE_STYLE = { backgroundColor: 'rgba(245, 205, 78, 0.42)' }

// A red glow under the king in check, in the style chess.com uses.
export const CHECK_STYLE = {
  background: 'radial-gradient(circle at center, rgba(226, 74, 74, 0.95) 12%, rgba(226, 74, 74, 0.55) 46%, transparent 72%)',
}

/** The from/to of the move that produced the position at `ply` in a line of SAN moves. */
export function lastMoveOf(moves: string[], ply: number, startFen?: string) {
  if (!moves?.length || !ply) return null
  try {
    const board = startFen ? new Chess(startFen) : new Chess()
    for (let i = 0; i < ply - 1; i += 1) board.move(moves[i])
    const mv = board.move(moves[ply - 1])
    return mv ? { from: mv.from, to: mv.to } : null
  } catch {
    return null
  }
}
