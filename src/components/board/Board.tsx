import { memo, type ComponentType, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react'
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

  // Each square is its own memoised component, so a render (a drag, a new
  // arrow, a selection) only repaints the squares whose content changed; the
  // pieces' drawings aren't rebuilt on every pointer move.
  const cells: ReactNode[] = []
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const square = cellToSquare(x, y, orientation)
      const code = placement[square]
      cells.push(
        <Square
          key={square}
          square={square}
          Piece={code && !hidden.has(square) ? pieces[code] : null}
          highlight={highlightBySquare.get(square)}
          last={Boolean(lastMove && (lastMove.from === square || lastMove.to === square))}
          selected={selected === square}
          file={coordinates && y === 7}
          rank={coordinates && x === 0}
        />,
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
        'relative grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-sm shadow-card select-none [-webkit-touch-callout:none]',
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

const Square = memo(function Square({
  square,
  Piece,
  highlight,
  last,
  selected,
  file,
  rank,
}: {
  square: string
  Piece: ComponentType | null
  highlight?: string
  last: boolean
  selected: boolean
  /** Show the file letter / rank number in this square's corner. */
  file: boolean
  rank: boolean
}) {
  const light = isLightSquare(square)
  const coordColor = light ? 'var(--board-coord-on-light)' : 'var(--board-coord-on-dark)'
  return (
    <div
      data-square={square}
      className={clsx('board-sq relative', light ? 'light' : 'dark')}
      // Each square draws half the line; neighbours meet to make one stroke.
      style={SQUARE_LINE}
    >
      {last && <div className="absolute inset-0" style={LAST_MOVE} />}
      {highlight && <div className="absolute inset-0" style={{ background: highlight }} />}
      {selected && <div className="absolute inset-0" style={SELECTED} />}
      {Piece && (
        <div className="board-piece absolute inset-[6%]">
          <Piece />
        </div>
      )}
      {rank && (
        <span className="pointer-events-none absolute top-[3%] left-[6%] text-[2.6cqw] leading-none font-bold" style={{ color: coordColor }}>
          {square[1]}
        </span>
      )}
      {file && (
        <span className="pointer-events-none absolute right-[7%] bottom-[3%] text-[2.6cqw] leading-none font-bold" style={{ color: coordColor }}>
          {square[0]}
        </span>
      )}
    </div>
  )
})

const SQUARE_LINE: CSSProperties = { boxShadow: 'inset 0 0 0 0.14cqw var(--board-line)' }
const LAST_MOVE: CSSProperties = { background: 'var(--board-last-move)' }
const SELECTED: CSSProperties = { boxShadow: 'inset 0 0 0 0.35em var(--board-select)' }
