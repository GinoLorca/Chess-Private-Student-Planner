import { Chessboard } from 'react-chessboard'
import type { Arrow } from 'react-chessboard'
import type { BoardArrow, BoardHighlight } from '../../types/domain'
import { chessPieceSet } from '../../lib/chessPieces'

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
  const squareStyles = Object.fromEntries(
    highlights.map((h) => [h.square, { backgroundColor: h.color, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.25)' }]),
  )

  const options = {
    id: 'display-board',
    position: fen,
    boardOrientation,
    allowDragging: false,
    allowDrawingArrows: false,
    arrows: arrows as Arrow[],
    squareStyles,
    pieces: chessPieceSet,
    showNotation,
    darkSquareStyle: { backgroundColor: 'var(--color-board-dark)', boxShadow: 'inset 0 0 0 1.5px var(--color-board-line)' },
    lightSquareStyle: { backgroundColor: 'var(--color-board-light)', boxShadow: 'inset 0 0 0 1.5px var(--color-board-line)' },
    darkSquareNotationStyle: { color: 'var(--color-board-coord)', fontWeight: 700 },
    lightSquareNotationStyle: { color: 'var(--color-board-coord)', fontWeight: 700 },
  }

  return <Chessboard options={options} />
}
