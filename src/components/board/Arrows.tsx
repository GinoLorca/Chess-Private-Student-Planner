import type { BoardArrow } from '../../types/domain'
import { squareToCell, type Orientation } from '../../lib/fen'

// Proportions in square units, lifted from chess.com's arrow polygons: slim
// shaft, modest head, tip on the target's centre, tail clear of the piece.
const SHAFT = 0.22
const HEAD_LEN = 0.36
const HEAD_HALF = 0.26
const TAIL_INSET = 0.36

function isKnightHop(dx: number, dy: number) {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  return (ax === 1 && ay === 2) || (ax === 2 && ay === 1)
}

/**
 * Arrow layer drawn in the board's own 8x8 coordinate space. Because the SVG
 * is stretched over a square parent with an 8x8 viewBox, a square is always
 * exactly one unit — arrows can't drift out of alignment with the grid.
 */
export function Arrows({ arrows, orientation }: { arrows: BoardArrow[]; orientation: Orientation }) {
  if (arrows.length === 0) return null
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 8 8"
      preserveAspectRatio="none"
      aria-hidden
    >
      {arrows.map((arrow, i) => {
        const a = squareToCell(arrow.startSquare, orientation)
        const b = squareToCell(arrow.endSquare, orientation)
        const dx = b.x - a.x
        const dy = b.y - a.y
        if (dx === 0 && dy === 0) return null
        const centre = (c: { x: number; y: number }) => ({ x: c.x + 0.5, y: c.y + 0.5 })
        const start = centre(a)
        const end = centre(b)
        const stroke = arrow.color || '#15781b'

        // Knight moves bend: long leg first, then the turn, like the move reads.
        const corner = isKnightHop(dx, dy)
          ? Math.abs(dy) > Math.abs(dx)
            ? centre({ x: a.x, y: b.y })
            : centre({ x: b.x, y: a.y })
          : null

        const legFrom = corner ?? start
        const vx = end.x - legFrom.x
        const vy = end.y - legFrom.y
        const len = Math.hypot(vx, vy) || 1
        const ux = vx / len
        const uy = vy / len

        const legTo = corner ?? end
        const tx = legTo.x - start.x
        const ty = legTo.y - start.y
        const tlen = Math.hypot(tx, ty) || 1
        const tailX = start.x + (tx / tlen) * TAIL_INSET
        const tailY = start.y + (ty / tlen) * TAIL_INSET

        const baseX = end.x - ux * HEAD_LEN
        const baseY = end.y - uy * HEAD_LEN
        const px = -uy
        const py = ux
        const points = corner
          ? `${tailX},${tailY} ${corner.x},${corner.y} ${baseX},${baseY}`
          : `${tailX},${tailY} ${baseX},${baseY}`

        return (
          <g key={`${arrow.startSquare}${arrow.endSquare}${i}`} opacity={0.8}>
            <polyline
              points={points}
              fill="none"
              stroke={stroke}
              strokeWidth={SHAFT}
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
            <polygon
              points={`${end.x},${end.y} ${baseX + px * HEAD_HALF},${baseY + py * HEAD_HALF} ${baseX - px * HEAD_HALF},${baseY - py * HEAD_HALF}`}
              fill={stroke}
            />
          </g>
        )
      })}
    </svg>
  )
}
