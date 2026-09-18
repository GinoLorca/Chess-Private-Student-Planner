import { Chessboard } from 'react-chessboard'
import type { Arrow } from 'react-chessboard'
import type { BoardArrow, BoardHighlight } from '../../types/domain'

export function DisplayBoard({
  fen,
  arrows = [],
  highlights = [],
  boardOrientation = 'white',
}: {
  fen: string
  arrows?: BoardArrow[]
  highlights?: BoardHighlight[]
  boardOrientation?: 'white' | 'black'
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
    darkSquareStyle: { backgroundColor: 'var(--color-board-dark)' },
    lightSquareStyle: { backgroundColor: 'var(--color-board-light)' },
  }

  return <Chessboard options={options} />
}
