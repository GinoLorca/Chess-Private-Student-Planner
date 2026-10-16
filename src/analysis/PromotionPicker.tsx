import { useEffect } from 'react'
import { squareCell } from './legalMoves'
import { pieceSet, useThemePieces } from './pieces'
import type { Palette } from './palette'

// Queen first — nearest the pawn's own square, since that's what almost every
// promotion actually wants — then the underpromotion options.
const OPTIONS = [
  { code: 'Q', title: 'Queen' },
  { code: 'N', title: 'Knight' },
  { code: 'R', title: 'Rook' },
  { code: 'B', title: 'Bishop' },
]

/**
 * Repertoire Lab's promotion picker (src/components/PromotionPicker.jsx
 * there): a small column of piece choices anchored to the square a pawn just
 * reached, drawn toward the centre of the board so it stays on the board
 * whichever way it faces, with a scrim behind it so a tap anywhere else
 * cancels and leaves the pawn where it was.
 */
export function PromotionPicker({
  square,
  color,
  boardWidth,
  orientation,
  palette,
  onPick,
  onCancel,
}: {
  square: string
  color: 'w' | 'b'
  boardWidth: number
  orientation: 'white' | 'black'
  palette: Palette
  onPick: (piece: 'q' | 'r' | 'b' | 'n') => void
  onCancel: () => void
}) {
  const themed = useThemePieces()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  if (!square || !boardWidth) return null
  const pieces = themed ?? pieceSet(palette.pieceLight, palette.pieceDark)
  const size = boardWidth / 8
  const cell = squareCell(square, orientation)
  const growingDown = cell.y === 0
  const ordered = growingDown ? OPTIONS : [...OPTIONS].reverse()

  return (
    <>
      <div className="promotion-scrim" onClick={onCancel} />
      <div className="promotion-picker" style={{ left: cell.x * size, top: (growingDown ? cell.y : cell.y - 3) * size, width: size }}>
        {ordered.map(({ code, title }, i) => (
          <button
            key={code}
            type="button"
            className="promotion-option"
            style={{ width: size, height: size, background: i % 2 === 0 ? palette.boardLight : palette.boardDark }}
            title={title}
            onClick={() => onPick(code.toLowerCase() as 'q' | 'r' | 'b' | 'n')}
          >
            {pieces[`${color}${code}`]?.({ squareWidth: size * 0.86 })}
          </button>
        ))}
      </div>
    </>
  )
}
