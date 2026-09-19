import { useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { BoardArrow, BoardHighlight } from '../../types/domain'
import { usePieceSet } from '../../state/PieceSetContext'
import { ArrowOverlay } from './ArrowOverlay'

// Same four pens as Repertoire Lab's analysis board (green/red/blue/yellow),
// so a coach's color coding means the same thing across both tools.
const PENS = [
  { id: 'green', name: 'Green', value: '#2ecc71' },
  { id: 'red', name: 'Red', value: '#e5534b' },
  { id: 'blue', name: 'Blue', value: '#3b9cff' },
  { id: 'yellow', name: 'Yellow', value: '#e8b339' },
]

function squareFromPoint(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y)
  return el?.closest?.('[data-square]')?.getAttribute('data-square') ?? null
}

export function AnnotateBoard({
  fen,
  arrows,
  highlights,
  onArrowsChange,
  onHighlightsChange,
}: {
  fen: string
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
  onArrowsChange: (arrows: BoardArrow[]) => void
  onHighlightsChange: (highlights: BoardHighlight[]) => void
}) {
  const [penIndex, setPenIndex] = useState(0)
  const [dragFrom, setDragFrom] = useState<string | null>(null)
  const [dragTo, setDragTo] = useState<string | null>(null)
  const pen = PENS[penIndex]
  const { pieces } = usePieceSet()

  function toggleHighlight(square: string) {
    const fillColor = `${pen.value}66`
    const existing = highlights.find((h) => h.square === square)
    if (existing && existing.color === fillColor) {
      onHighlightsChange(highlights.filter((h) => h.square !== square))
    } else if (existing) {
      onHighlightsChange(highlights.map((h) => (h.square === square ? { ...h, color: fillColor } : h)))
    } else {
      onHighlightsChange([...highlights, { square, color: fillColor }])
    }
  }

  function toggleArrow(from: string, to: string) {
    const existingIndex = arrows.findIndex((a) => a.startSquare === from && a.endSquare === to)
    if (existingIndex >= 0) {
      onArrowsChange(arrows.filter((_, i) => i !== existingIndex))
    } else {
      onArrowsChange([...arrows, { startSquare: from, endSquare: to, color: pen.value }])
    }
  }

  // Right-click-drag on a mouse (Repertoire Lab's own gesture), or press-drag
  // on touch/pen, which has no right button. A drag that lands back on its
  // own start square toggles a highlight instead of an arrow.
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 2) return
    const square = squareFromPoint(e.clientX, e.clientY)
    if (!square) return
    e.preventDefault()
    setDragFrom(square)
    setDragTo(square)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragFrom) return
    const square = squareFromPoint(e.clientX, e.clientY)
    if (square && square !== dragTo) setDragTo(square)
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragFrom) return
    const to = squareFromPoint(e.clientX, e.clientY) ?? dragTo
    const from = dragFrom
    setDragFrom(null)
    setDragTo(null)
    if (!to) return
    if (to === from) toggleHighlight(from)
    else toggleArrow(from, to)
  }

  const livePreview: BoardArrow[] =
    dragFrom && dragTo && dragTo !== dragFrom ? [{ startSquare: dragFrom, endSquare: dragTo, color: pen.value }] : []

  const squareStyles: Record<string, React.CSSProperties> = Object.fromEntries(
    highlights.map((h) => [h.square, { backgroundColor: h.color, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.25)' }]),
  )
  if (dragFrom) {
    squareStyles[dragFrom] = { ...(squareStyles[dragFrom] || {}), boxShadow: `inset 0 0 0 3px ${pen.value}` }
  }

  const options = {
    id: 'annotate-board',
    position: fen,
    boardOrientation: 'white' as const,
    allowDragging: false,
    allowDrawingArrows: false,
    squareStyles,
    pieces,
    darkSquareStyle: { backgroundColor: 'var(--color-board-dark)', boxShadow: 'inset 0 0 0 1.5px var(--color-board-line)' },
    lightSquareStyle: { backgroundColor: 'var(--color-board-light)', boxShadow: 'inset 0 0 0 1.5px var(--color-board-line)' },
    darkSquareNotationStyle: { color: 'var(--color-board-coord)', fontWeight: 700 },
    lightSquareNotationStyle: { color: 'var(--color-board-coord)', fontWeight: 700 },
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {PENS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setPenIndex(i)}
              title={p.name}
              aria-label={p.name}
              className="grid h-6 w-6 place-items-center rounded-full transition"
              style={{ boxShadow: penIndex === i ? `0 0 0 2px var(--color-ink-950), 0 0 0 3.5px ${p.value}` : 'none' }}
            >
              <span className="block h-4 w-4 rounded-full" style={{ backgroundColor: p.value }} />
            </button>
          ))}
        </div>
        {highlights.length > 0 && (
          <button onClick={() => onHighlightsChange([])} className="text-xs text-ink-400 hover:text-red-400">
            clear highlights
          </button>
        )}
        {arrows.length > 0 && (
          <button onClick={() => onArrowsChange([])} className="text-xs text-ink-400 hover:text-red-400">
            clear arrows
          </button>
        )}
      </div>
      <p className="text-xs text-ink-400">
        Right-click and drag to draw an arrow (drag on a touchscreen). Drag back onto the same square to toggle a
        highlight instead. Repeat the same arrow or highlight to remove it.
      </p>
      <div
        className="relative mx-auto max-w-md touch-none select-none"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setDragFrom(null)
          setDragTo(null)
        }}
      >
        <Chessboard options={options} />
        <ArrowOverlay arrows={[...arrows, ...livePreview]} orientation="white" />
      </div>
    </div>
  )
}
