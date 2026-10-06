import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react'
import type { BoardArrow, BoardHighlight } from '../../types/domain'
import { HIGHLIGHT_ALPHA, PENS, currentPen } from '../../lib/pens'
import { DRAG_THRESHOLD, isSecondaryButton, squareAtPoint } from './pointer'

/** How long a finger rests on a square before the press turns into drawing. */
const HOLD_MS = 350

export interface RightClickDraw {
  /**
   * Handles the drawing gestures; returns true when it took the event. A
   * left press only clears (and returns false) so the board's own left-click
   * behaviour still runs; a touch returns false too, and only becomes a
   * drawing if the finger rests.
   */
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => boolean
  onContextMenu: (e: ReactMouseEvent) => void
  /** The saved arrows plus the one being dragged out. */
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
  /** The square a drag started on, to show as selected. */
  from: string | null
  /** The current (or last) press turned into drawing: the board's own gesture should stand down. */
  claimed: () => boolean
  /** A touch drawing is under way, for hosts that must pause a swipe meanwhile. */
  drawing: boolean
}

interface Options {
  boardRef: RefObject<HTMLDivElement | null>
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
  /**
   * Where drawings are saved. Without these the board keeps its own sketch,
   * drawn over the arrows it was given and wiped when resetKey changes.
   */
  onArrowsChange?: (arrows: BoardArrow[]) => void
  onHighlightsChange?: (highlights: BoardHighlight[]) => void
  resetKey?: string
  /** A touch press just turned into drawing: drop any selection the press made. */
  onHold?: () => void
  /**
   * A plain left click wipes the marks (the Repertoire Lab gesture). On by
   * default only for a sketch; marks saved with a position are taken off
   * one at a time instead, never by a click meant for the board.
   */
  clearOnClick?: boolean
  enabled?: boolean
}

/**
 * The Repertoire Lab gesture on any board: right-drag draws an arrow,
 * right-click a square highlights it, the same again removes it, and a plain
 * left click wipes a sketch (see clearOnClick). Hold Z / R / F / C while dragging for
 * green / red / blue / yellow; green with nothing held. A trackpad
 * two-finger tap counts as the right button.
 *
 * On a touch screen a finger resting on a square takes the right button's
 * place: rest, then drag for an arrow, or rest and lift to highlight. With
 * no keys to pick a colour, drawing the same mark again steps it through
 * the pens and then removes it. Quick taps and drags stay the board's own.
 */
export function useRightClickDraw({
  boardRef,
  arrows,
  highlights,
  onArrowsChange,
  onHighlightsChange,
  resetKey = '',
  onHold,
  clearOnClick,
  enabled = true,
}: Options): RightClickDraw {
  const [preview, setPreview] = useState<BoardArrow | null>(null)
  const [from, setFrom] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const claimedRef = useRef(false)
  const holdingRef = useRef(false)

  // No save handlers: a sketch of the board's own, gone with the position.
  const local = !onArrowsChange
  const wipes = clearOnClick ?? local
  const [sketch, setSketch] = useState<{ key: string; arrows: BoardArrow[]; highlights: BoardHighlight[] }>({ key: resetKey, arrows: [], highlights: [] })
  const own = sketch.key === resetKey ? sketch : { key: resetKey, arrows: [], highlights: [] }
  const marks = local ? own : { arrows, highlights }
  const setArrows = (next: BoardArrow[]) => (local ? setSketch({ ...own, arrows: next }) : onArrowsChange?.(next))
  const setHighlights = (next: BoardHighlight[]) => (local ? setSketch({ ...own, highlights: next }) : onHighlightsChange?.(next))

  // Once a finger is drawing, the page mustn't scroll under it. Safari only
  // honours this from a listener that isn't passive, so it's added by hand.
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const stop = (e: TouchEvent) => {
      if (holdingRef.current) e.preventDefault()
    }
    el.addEventListener('touchmove', stop, { passive: false })
    return () => el.removeEventListener('touchmove', stop)
  }, [boardRef])

  function toggleHighlight(square: string, pen: string) {
    const color = pen + HIGHLIGHT_ALPHA
    const existing = marks.highlights.find((h) => h.square === square)
    if (existing && existing.color === color) setHighlights(marks.highlights.filter((h) => h.square !== square))
    else if (existing) setHighlights(marks.highlights.map((h) => (h.square === square ? { ...h, color } : h)))
    else setHighlights([...marks.highlights, { square, color }])
  }

  function toggleArrow(start: string, end: string, pen: string) {
    const i = marks.arrows.findIndex((a) => a.startSquare === start && a.endSquare === end)
    if (i >= 0 && marks.arrows[i].color === pen) setArrows(marks.arrows.filter((_, j) => j !== i))
    else if (i >= 0) setArrows(marks.arrows.map((a, j) => (j === i ? { ...a, color: pen } : a)))
    else setArrows([...marks.arrows, { startSquare: start, endSquare: end, color: pen }])
  }

  /** The pen after this one, or null after the last: drawing a mark again on touch. */
  function nextPen(color: string | undefined) {
    if (!color) return currentPen().value
    const i = PENS.findIndex((p) => color.toLowerCase().startsWith(p.value.toLowerCase()))
    return i >= 0 && i < PENS.length - 1 ? PENS[i + 1].value : null
  }

  function cycleHighlight(square: string) {
    const existing = marks.highlights.find((h) => h.square === square)
    const pen = nextPen(existing?.color)
    if (!pen) setHighlights(marks.highlights.filter((h) => h.square !== square))
    else toggleHighlight(square, pen)
  }

  function cycleArrow(start: string, end: string) {
    const existing = marks.arrows.find((a) => a.startSquare === start && a.endSquare === end)
    const pen = nextPen(existing?.color)
    if (!pen) setArrows(marks.arrows.filter((a) => a !== existing))
    else toggleArrow(start, end, pen)
  }

  /** A press that drew shouldn't also click the board (a step forward, say). */
  function swallowNextClick() {
    const el = boardRef.current
    if (!el) return
    const swallow = (ev: Event) => {
      ev.stopPropagation()
      ev.preventDefault()
    }
    el.addEventListener('click', swallow, { capture: true, once: true })
    window.setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 600)
  }

  function onTouchDown(e: ReactPointerEvent<HTMLDivElement>): boolean {
    const start = squareAtPoint(e.clientX, e.clientY, boardRef.current)
    if (!start) return false
    const target = e.currentTarget
    const id = e.pointerId
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false
    let last = start

    const timer = window.setTimeout(() => {
      holdingRef.current = true
      claimedRef.current = true
      setDrawing(true)
      setFrom(start)
      onHold?.()
      try {
        target.setPointerCapture(id)
      } catch {
        // the finger already lifted
      }
    }, HOLD_MS)

    const stop = () => {
      window.clearTimeout(timer)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return
      const far = Math.hypot(ev.clientX - startX, ev.clientY - startY) >= DRAG_THRESHOLD
      // Moving before the hold: a tap, a piece drag or a scroll, not ours.
      if (!holdingRef.current) {
        if (far) stop()
        return
      }
      if (!dragging && !far) return
      dragging = true
      const sq = squareAtPoint(ev.clientX, ev.clientY, boardRef.current)
      if (sq && sq !== last) {
        last = sq
        setPreview(sq === start ? null : { startSquare: start, endSquare: sq, color: currentPen().value })
      }
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return
      stop()
      if (!holdingRef.current) return
      holdingRef.current = false
      setDrawing(false)
      setPreview(null)
      setFrom(null)
      swallowNextClick()
      if (ev.type === 'pointercancel') return
      const end = squareAtPoint(ev.clientX, ev.clientY, boardRef.current) ?? last
      if (!dragging || end === start) cycleHighlight(start)
      else cycleArrow(start, end)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
    return false
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>): boolean {
    claimedRef.current = false
    if (!enabled) return false
    if (e.pointerType !== 'mouse') return e.isPrimary ? onTouchDown(e) : false
    if (e.button === 0) {
      // A plain left click wipes a sketch; the board's own left-click
      // handling carries on as usual.
      if (wipes && marks.arrows.length) setArrows([])
      if (wipes && marks.highlights.length) setHighlights([])
      return false
    }
    if (!isSecondaryButton(e)) return false
    const start = squareAtPoint(e.clientX, e.clientY, boardRef.current)
    if (!start) return false
    e.preventDefault()
    e.stopPropagation()
    claimedRef.current = true
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
        setPreview(sq === start ? null : { startSquare: start, endSquare: sq, color: currentPen().value })
      }
    }
    const onUp = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      setPreview(null)
      setFrom(null)
      // The pen is read at release, so a key pressed mid-drag still counts.
      const pen = currentPen().value
      const end = squareAtPoint(ev.clientX, ev.clientY, boardRef.current) ?? last
      if (!dragging || end === start) toggleHighlight(start, pen)
      else toggleArrow(start, end, pen)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
    return true
  }

  const shownArrows = local ? [...arrows, ...own.arrows] : arrows
  const shownHighlights = local ? [...highlights, ...own.highlights] : highlights
  return {
    onPointerDown,
    onContextMenu: (e) => e.preventDefault(),
    arrows: preview ? [...shownArrows, preview] : shownArrows,
    highlights: shownHighlights,
    from,
    claimed: () => claimedRef.current,
    drawing,
  }
}
