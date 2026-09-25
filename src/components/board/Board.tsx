import { memo, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react'
import clsx from 'clsx'
import type { BoardArrow, BoardHighlight } from '../../types/domain'
import { FILES, cellToSquare, isLightSquare, parsePlacement, type Orientation } from '../../lib/fen'
import { usePieceSet } from '../../state/PieceSetContext'
import { Arrows } from './Arrows'

export interface BoardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  ref?: Ref<HTMLDivElement>
  fen: string
  orientation?: Orientation
  arrows?: BoardArrow[]
  highlights?: BoardHighlight[]
  /** Squares of the most recent move, tinted the way lichess does it. */
  lastMove?: { from: string; to: string } | null
  selected?: string | null
  coordinates?: boolean
  /** Squares whose piece should be hidden (e.g. the piece currently being dragged). */
  hiddenSquares?: string[]
  /** Interactive boards block scrolling gestures so a drag doesn't pan the page. */
  interactive?: boolean
  /** Extra layer rendered above pieces but below arrows (drop targets, ghosts…). */
  overlay?: ReactNode
}

/**
 * The one board used everywhere: thumbnails, the coach view, the editor. It is
 * a plain 8x8 grid of squares with an SVG arrow layer sharing the same box, so
 * every layer lines up by construction. Pieces come from the coach's chosen set.
 */
export const Board = memo(function Board({
  fen,
  orientation = 'white',
  arrows = [],
  highlights = [],
  lastMove = null,
  selected = null,
  coordinates = true,
  hiddenSquares,
  interactive = false,
  overlay,
  className,
  style,
  ...rest
}: BoardProps) {
  const { pieces } = usePieceSet()
  const placement = parsePlacement(fen)
  const highlightBySquare = new Map(highlights.map((h) => [h.square, h.color]))
  const hidden = new Set(hiddenSquares ?? [])

  const cells: ReactNode[] = []
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const square = cellToSquare(x, y, orientation)
      const light = isLightSquare(square)
      const code = placement[square]
      const Piece = code ? pieces[code] : null
      const highlight = highlightBySquare.get(square)
      const isLast = lastMove && (lastMove.from === square || lastMove.to === square)
      const showFile = coordinates && y === 7
      const showRank = coordinates && x === 0
      const coordColor = light ? 'var(--board-coord-on-light)' : 'var(--board-coord-on-dark)'
      cells.push(
        <div
          key={square}
          data-square={square}
          className={clsx('board-sq relative', light ? 'light' : 'dark')}
          // Each square draws half the line; neighbours meet to make one stroke.
          style={{ boxShadow: 'inset 0 0 0 0.14cqw var(--board-line)' }}
        >
          {isLast && <div className="absolute inset-0" style={{ background: 'var(--board-last-move)' }} />}
          {highlight && <div className="absolute inset-0" style={{ background: highlight }} />}
          {selected === square && (
            <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 0.35em var(--board-select)' }} />
          )}
          {Piece && !hidden.has(square) && (
            <div className="board-piece absolute inset-[6%]">
              <Piece />
            </div>
          )}
          {showRank && (
            <span
              className="pointer-events-none absolute top-[3%] left-[6%] text-[2.6cqw] leading-none font-bold"
              style={{ color: coordColor }}
            >
              {square[1]}
            </span>
          )}
          {showFile && (
            <span
              className="pointer-events-none absolute right-[7%] bottom-[3%] text-[2.6cqw] leading-none font-bold"
              style={{ color: coordColor }}
            >
              {square[0]}
            </span>
          )}
        </div>,
      )
    }
  }

  // A container so coordinate labels can size themselves in cqw — a fixed
  // fraction of the board's width, whatever size the board is rendered at.
  const boardStyle: CSSProperties = {
    containerType: 'inline-size',
    border: 'max(1px, 0.55cqw) solid var(--board-line)',
    ...style,
  }

  return (
    <div
      {...rest}
      data-no-pull
      className={clsx(
        'relative grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-sm shadow-card select-none',
        interactive && 'touch-none',
        className,
      )}
      style={boardStyle}
    >
      {cells}
      {overlay}
      <Arrows arrows={arrows} orientation={orientation} />
    </div>
  )
})

export { FILES }
