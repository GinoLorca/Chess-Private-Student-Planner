import type { Chess, Move, Square } from 'chess.js'
import { squareCell } from './legalMoves'

/**
 * Where a picked piece can go, drawn as an overlay above the arrows
 * (Repertoire Lab's src/components/LegalDots.jsx): a dot is always one crisp
 * dot, never a second circle showing through an arrow's shaft.
 */
export function LegalDots({ game, square, boardWidth, orientation }: { game: Chess | null; square: string | null; boardWidth: number; orientation: 'white' | 'black' }) {
  if (!game || !square || !boardWidth) return null
  let moves: Move[] = []
  try {
    moves = game.moves({ square: square as Square, verbose: true })
  } catch {
    return null
  }
  if (moves.length === 0) return null
  // A promotion offers four variants landing on the same square: one dot per destination.
  moves = [...new Map(moves.map((mv) => [mv.to, mv])).values()]

  const size = boardWidth / 8
  return (
    <svg
      width={boardWidth}
      height={boardWidth}
      viewBox={`0 0 ${boardWidth} ${boardWidth}`}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 11 }}
    >
      {moves.map((mv) => {
        const c = squareCell(mv.to, orientation)
        const cx = (c.x + 0.5) * size
        const cy = (c.y + 0.5) * size
        // A ring around something you can take, a dot on an empty square.
        return mv.captured ? (
          <circle key={mv.to} cx={cx} cy={cy} r={size * 0.42} fill="none" stroke="rgba(20, 23, 29, 0.32)" strokeWidth={size * 0.11} />
        ) : (
          <circle key={mv.to} cx={cx} cy={cy} r={size * 0.16} fill="rgba(20, 23, 29, 0.34)" />
        )
      })}
    </svg>
  )
}
