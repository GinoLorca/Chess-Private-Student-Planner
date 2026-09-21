import { useRef, useState } from 'react'
import clsx from 'clsx'
import type { BoardArrow, BoardHighlight } from '../../types/domain'
import { Board } from '../board/Board'
import { squareAtPoint, DRAG_THRESHOLD } from '../board/pointer'
import { HIGHLIGHT_ALPHA, PENS, currentPen, penHint } from '../../lib/pens'
import { Button } from '../ui/Button'
import type { Orientation } from '../../lib/fen'

interface AnnotateBoardProps {
  fen: string
  orientation?: Orientation
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
  onArrowsChange: (arrows: BoardArrow[]) => void
  onHighlightsChange: (highlights: BoardHighlight[]) => void
}

/**
 * The touch-friendly pen: drag from square to square for an arrow, tap a
 * square to highlight it, in the selected pen. Repeating either removes it.
 * On a mouse it's the Repertoire Lab gesture too: right-drag draws, a held
 * Z / R / F / C picks the colour for that arrow, and a plain left click on
 * an empty square clears everything.
 */
export function AnnotateBoard({
  fen,
  orientation = 'white',
  arrows,
  highlights,
  onArrowsChange,
  onHighlightsChange,
}: AnnotateBoardProps) {
  const [penIndex, setPenIndex] = useState(0)
  const [preview, setPreview] = useState<BoardArrow | null>(null)
  const [from, setFrom] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const selectedPen = PENS[penIndex]
  const hasMarks = arrows.length > 0 || highlights.length > 0

  function clearAll() {
    if (highlights.length) onHighlightsChange([])
    if (arrows.length) onArrowsChange([])
  }

  function toggleHighlight(square: string, pen = selectedPen) {
    const color = pen.value + HIGHLIGHT_ALPHA
    const existing = highlights.find((h) => h.square === square)
    if (existing && existing.color === color) onHighlightsChange(highlights.filter((h) => h.square !== square))
    else if (existing) onHighlightsChange(highlights.map((h) => (h.square === square ? { ...h, color } : h)))
    else onHighlightsChange([...highlights, { square, color }])
  }

  function toggleArrow(start: string, end: string, pen = selectedPen) {
    const i = arrows.findIndex((a) => a.startSquare === start && a.endSquare === end)
    if (i >= 0 && arrows[i].color === pen.value) onArrowsChange(arrows.filter((_, j) => j !== i))
    else if (i >= 0) onArrowsChange(arrows.map((a, j) => (j === i ? { ...a, color: pen.value } : a)))
    else onArrowsChange([...arrows, { startSquare: start, endSquare: end, color: pen.value }])
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return
    const start = squareAtPoint(e.clientX, e.clientY, boardRef.current)
    if (!start) return
    // Mouse: a plain left click wipes the marks; the right button draws with a
    // held pen key (or green). Touch: the selected pen, and tapping draws.
    const mouseLeft = e.pointerType === 'mouse' && e.button === 0
    if (mouseLeft && hasMarks) {
      clearAll()
      return
    }
    const penFor = () => (e.pointerType === 'mouse' && e.button === 2 ? currentPen() : selectedPen)
    e.preventDefault()
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false
    let last = start
    setFrom(start)

    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return
      dragging = true
      const sq = squareAtPoint(ev.clientX, ev.clientY, boardRef.current)
      if (sq && sq !== last) {
        last = sq
        setPreview(sq === start ? null : { startSquare: start, endSquare: sq, color: penFor().value })
      }
    }
    const onUp = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      setPreview(null)
      setFrom(null)
      const end = squareAtPoint(ev.clientX, ev.clientY, boardRef.current) ?? last
      if (!dragging || end === start) toggleHighlight(start, penFor())
      else toggleArrow(start, end, penFor())
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {PENS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setPenIndex(i)}
              aria-label={p.name}
              aria-pressed={penIndex === i}
              className={clsx(
                'grid h-11 w-11 place-items-center rounded-full transition',
                penIndex === i ? 'bg-surface-2 ring-2 ring-ink' : 'hover:bg-surface-2',
              )}
            >
              <span className="block h-6 w-6 rounded-full" style={{ background: p.value }} />
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {highlights.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => onHighlightsChange([])}>
            Clear highlights
          </Button>
        )}
        {arrows.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => onArrowsChange([])}>
            Clear arrows
          </Button>
        )}
      </div>
      <p className="text-[13px] text-ink-3">
        Drag between squares for an arrow, tap a square to highlight it; the same again removes it. With a mouse:
        right-drag draws, hold {penHint()}, left-click clears.
      </p>
      <div className="mx-auto w-full max-w-[560px]">
        <Board
          ref={boardRef}
          fen={fen}
          orientation={orientation}
          arrows={preview ? [...arrows, preview] : arrows}
          highlights={highlights}
          selected={from}
          interactive
          onPointerDown={onPointerDown}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  )
}
