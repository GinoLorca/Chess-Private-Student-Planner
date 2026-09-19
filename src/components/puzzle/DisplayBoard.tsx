import { Chessboard } from 'react-chessboard'
import type { BoardArrow, BoardHighlight } from '../../types/domain'
import { usePieceSet } from '../../state/PieceSetContext'
import { ArrowOverlay } from './ArrowOverlay'

export function DisplayBoard({
  fen,
  arrows = [],
  highlights = [],
  boardOrientation = 'white',
  showNotation = true,
}: {
  fen: string
  arrows?: BoardArrow[]
  highlights?: BoardHighlight[]
  boardOrientation?: 'white' | 'black'
  showNotation?: boolean
}) {
  const { pieces } = usePieceSet()
  const squareStyles = Object.fromEntries(
    highlights.map((h) => [h.square, { backgroundColor: h.color, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.25)' }]),
  )

  const options = {
    id: 'display-board',
    position: fen,
    boardOrientation,
    allowDragging: false,
    allowDrawingArrows: false,
    squareStyles,
    pieces,
    showNotation,
    darkSquareStyle: { backgroundColor: 'var(--color-board-dark)', boxShadow: 'inset 0 0 0 1.5px var(--color-board-line)' },
    lightSquareStyle: { backgroundColor: 'var(--color-board-light)', boxShadow: 'inset 0 0 0 1.5px var(--color-board-line)' },
    darkSquareNotationStyle: { color: 'var(--color-board-coord)', fontWeight: 700 },
    lightSquareNotationStyle: { color: 'var(--color-board-coord)', fontWeight: 700 },
  }

  return (
    <div className="relative">
      <Chessboard options={options} />
      <ArrowOverlay arrows={arrows} orientation={boardOrientation} />
    </div>
  )
}
