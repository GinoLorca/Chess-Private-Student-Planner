import { useRef, useState } from 'react'
import clsx from 'clsx'
import type { BoardArrow, BoardHighlight, MoveGlyph } from '../../types/domain'
import { Board } from '../board/Board'
import { squareAtPoint, DRAG_THRESHOLD } from '../board/pointer'
import { DEFAULT_PEN, HIGHLIGHT_ALPHA, PENS, heldPen } from '../../lib/pens'
import { SEQ_COLORS, STRATEGIC, nextSeq, recolor, useArrowProfile } from '../../lib/arrowProfiles'
import { Button } from '../ui/Button'
import type { Orientation } from '../../lib/fen'

interface AnnotateBoardProps {
  fen: string
  orientation?: Orientation
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
  onArrowsChange: (arrows: BoardArrow[]) => void
  onHighlightsChange: (highlights: BoardHighlight[]) => void
  /** On a move of the answer: the move's squares and its symbol. */
  lastMove?: { from: string; to: string } | null
  glyph?: { square: string; glyph: MoveGlyph } | null
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
  lastMove,
  glyph,
}: AnnotateBoardProps) {
  // Settings → Arrow colors, on this device. With a profile on, the Auto pen
  // (its colours) is picked to start with; a pen still draws in its own.
  const profile = useArrowProfile()
  const [picked, setPicked] = useState<number | null>(null)
  const penIndex = picked ?? (profile === 'default' ? 0 : -1)
  const [preview, setPreview] = useState<BoardArrow | null>(null)
  const [from, setFrom] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const hasMarks = arrows.length > 0 || highlights.length > 0
  type By = { color: string; auto: BoardArrow['auto'] }
  const auto: By = { color: DEFAULT_PEN.value, auto: profile === 'default' ? false : profile }
  const selected: By = penIndex < 0 || !PENS[penIndex] ? auto : { color: PENS[penIndex].value, auto: false }

  function clearAll() {
    if (highlights.length) onHighlightsChange([])
    if (arrows.length) onArrowsChange([])
  }

  /** Both lists after a change, the profile's colours worked out again; each sent on only if it changed. */
  function setMarks(nextArrows: BoardArrow[], nextHighlights: BoardHighlight[]) {
    const r = recolor(profile, fen, nextArrows, nextHighlights)
    if (JSON.stringify(r.arrows) !== JSON.stringify(arrows)) onArrowsChange(r.arrows)
    if (JSON.stringify(r.highlights) !== JSON.stringify(highlights)) onHighlightsChange(r.highlights)
  }
  const same = (existing: { color: string; auto?: BoardArrow['auto'] }, by: By, color: string) => (by.auto ? existing.auto === by.auto : existing.color === color)

  function toggleHighlight(square: string, by = selected) {
    const color = by.color + HIGHLIGHT_ALPHA
    const existing = highlights.find((h) => h.square === square)
    const mark: BoardHighlight = { square, color, auto: by.auto, seq: nextSeq(arrows, highlights) }
    if (existing && same(existing, by, color)) setMarks(arrows, highlights.filter((h) => h.square !== square))
    else if (existing) setMarks(arrows, highlights.map((h) => (h.square === square ? mark : h)))
    else setMarks(arrows, [...highlights, mark])
  }

  function toggleArrow(start: string, end: string, by = selected) {
    const i = arrows.findIndex((a) => a.startSquare === start && a.endSquare === end)
    const arrow: BoardArrow = { startSquare: start, endSquare: end, color: by.color, auto: by.auto, seq: nextSeq(arrows, highlights) }
    if (i >= 0 && same(arrows[i], by, by.color)) setMarks(arrows.filter((_, j) => j !== i), highlights)
    else if (i >= 0) setMarks(arrows.map((a, j) => (j === i ? arrow : a)), highlights)
    else setMarks([...arrows, arrow], highlights)
  }

  /** The arrow being dragged out, in the colour it will take. */
  function previewArrow(start: string, end: string, by: By): BoardArrow {
    const arrow: BoardArrow = { startSquare: start, endSquare: end, color: by.color, auto: by.auto, seq: nextSeq(arrows, highlights) }
    if (!by.auto) return arrow
    const others = arrows.filter((a) => !(a.startSquare === start && a.endSquare === end))
    return recolor(profile, fen, [...others, arrow], highlights).arrows.at(-1) ?? arrow
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
    // The right button: a held pen key, else the profile. Touch and the left button: the pen picked below.
    const penFor = (): By => {
      if (!(e.pointerType === 'mouse' && e.button === 2)) return selected
      const held = heldPen()
      return held ? { color: held.value, auto: false } : auto
    }
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
        setPreview(sq === start ? null : previewArrow(start, sq, penFor()))
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
          {profile !== 'default' && (
            <button
              onClick={() => setPicked(-1)}
              aria-label={`Auto: the ${profile === 'sequential' ? 'Sequential' : 'Strategic'} colours`}
              aria-pressed={penIndex === -1}
              title={profile === 'sequential' ? 'Auto: each arrow the next colour' : 'Auto: White green, Black blue, captures red and yellow'}
              className={clsx(
                'inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink transition',
                penIndex === -1 ? 'bg-surface-2 ring-2 ring-ink' : 'hover:bg-surface-2',
              )}
            >
              <span className="flex -space-x-1">
                {(profile === 'sequential' ? SEQ_COLORS.slice(0, 4) : [STRATEGIC.w, STRATEGIC.b, STRATEGIC.wx, STRATEGIC.bx]).map((c) => (
                  <span key={c} className="block h-3.5 w-3.5 rounded-full ring-1 ring-surface" style={{ background: c }} />
                ))}
              </span>
              Auto
            </button>
          )}
          {PENS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setPicked(i)}
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
      <div className="mx-auto w-full max-w-[644px] pointer-fine:max-w-[560px]">
        <Board
          ref={boardRef}
          fen={fen}
          orientation={orientation}
          arrows={preview ? [...arrows, preview] : arrows}
          highlights={highlights}
          lastMove={lastMove}
          glyph={glyph}
          selected={from}
          interactive
          onPointerDown={onPointerDown}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  )
}
