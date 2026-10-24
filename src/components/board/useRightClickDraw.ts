import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react'
import type { BoardArrow, BoardHighlight } from '../../types/domain'
import { DEFAULT_PEN, HIGHLIGHT_ALPHA, PENS, currentPen, heldPen } from '../../lib/pens'
import { nextSeq, recolor, useArrowProfile } from '../../lib/arrowProfiles'
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
  /** The position the marks are on, for the Strategic arrow colours; the resetKey (every board's FEN) when not given. */
  fen?: string
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
  fen,
}: Options): RightClickDraw {
  // Settings → Arrow colors, on this device: what colours a mark drawn with no pen key.
  const profile = useArrowProfile()
  const position = fen ?? resetKey
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
  /**
   * Both lists after a change, with the profile's colours worked out again
   * (taking an arrow off recolours the ones after it); each list is only
   * sent on if it changed.
   */
  function setMarks(nextArrows: BoardArrow[], nextHighlights: BoardHighlight[]) {
    const r = recolor(profile, position, nextArrows, nextHighlights)
    const arrowsChanged = JSON.stringify(r.arrows) !== JSON.stringify(marks.arrows)
    const highlightsChanged = JSON.stringify(r.highlights) !== JSON.stringify(marks.highlights)
    if (local) {
      if (arrowsChanged || highlightsChanged) setSketch({ key: resetKey, arrows: r.arrows, highlights: r.highlights })
      return
    }
    if (arrowsChanged) onArrowsChange?.(r.arrows)
    if (highlightsChanged) onHighlightsChange?.(r.highlights)
  }

  /** Who colours a mark drawn now: a held pen key, else the profile (Default: green). */
  function drawnBy(): { color: string; auto: BoardArrow['auto'] } {
    const held = heldPen()
    if (held) return { color: held.value, auto: false }
    return { color: DEFAULT_PEN.value, auto: profile === 'default' ? false : profile }
  }

  /** The arrow being dragged out, in the colour it will take. */
  function previewArrow(start: string, end: string): BoardArrow {
    const by = drawnBy()
    const arrow: BoardArrow = { startSquare: start, endSquare: end, color: by.color, auto: by.auto, seq: nextSeq(marks.arrows, marks.highlights) }
    if (!by.auto) return arrow
    const others = marks.arrows.filter((a) => !(a.startSquare === start && a.endSquare === end))
    return recolor(profile, position, [...others, arrow], marks.highlights).arrows.at(-1) ?? arrow
  }

  // A mark drawn again: in Default, or with a pen key, the same colour takes
  // it off (another colour repaints it); one the profile coloured comes off
  // when drawn again the same way, keyless.
  const sameMark = (existing: { color: string; auto?: BoardArrow['auto'] }, by: { color: string; auto: BoardArrow['auto'] }, color: string) =>
    by.auto ? existing.auto === by.auto : existing.color === color

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

  function toggleHighlight(square: string, pen: string, by = drawnBy()) {
    const color = pen + HIGHLIGHT_ALPHA
    const existing = marks.highlights.find((h) => h.square === square)
    const mark: BoardHighlight = { square, color, auto: by.auto, seq: nextSeq(marks.arrows, marks.highlights) }
    if (existing && sameMark(existing, by, color)) setMarks(marks.arrows, marks.highlights.filter((h) => h.square !== square))
    else if (existing) setMarks(marks.arrows, marks.highlights.map((h) => (h.square === square ? mark : h)))
    else setMarks(marks.arrows, [...marks.highlights, mark])
  }

  function toggleArrow(start: string, end: string, pen: string, by = drawnBy()) {
    const i = marks.arrows.findIndex((a) => a.startSquare === start && a.endSquare === end)
    const arrow: BoardArrow = { startSquare: start, endSquare: end, color: pen, auto: by.auto, seq: nextSeq(marks.arrows, marks.highlights) }
    if (i >= 0 && sameMark(marks.arrows[i], by, pen)) setMarks(marks.arrows.filter((_, j) => j !== i), marks.highlights)
    else if (i >= 0) setMarks(marks.arrows.map((a, j) => (j === i ? arrow : a)), marks.highlights)
    else setMarks([...marks.arrows, arrow], marks.highlights)
  }

  /** The pen after this one, or null after the last: drawing a mark again on touch. */
  function nextPen(color: string | undefined) {
    if (!color) return currentPen().value
    const i = PENS.findIndex((p) => color.toLowerCase().startsWith(p.value.toLowerCase()))
    return i >= 0 && i < PENS.length - 1 ? PENS[i + 1].value : null
  }

  function cycleHighlight(square: string) {
    // With a profile on there's no pen to step through: drawing again takes it off.
    if (profile !== 'default') return toggleHighlight(square, DEFAULT_PEN.value)
    const existing = marks.highlights.find((h) => h.square === square)
    const pen = nextPen(existing?.color)
    if (!pen) setHighlights(marks.highlights.filter((h) => h.square !== square))
    else toggleHighlight(square, pen)
  }

  function cycleArrow(start: string, end: string) {
    if (profile !== 'default') return toggleArrow(start, end, DEFAULT_PEN.value)
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
        setPreview(sq === start ? null : previewArrow(start, sq))
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
        setPreview(sq === start ? null : previewArrow(start, sq))
      }
    }
    const onUp = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      setPreview(null)
      setFrom(null)
      // The pen is read at release, so a key pressed mid-drag still counts.
      const by = drawnBy()
      const end = squareAtPoint(ev.clientX, ev.clientY, boardRef.current) ?? last
      if (!dragging || end === start) toggleHighlight(start, by.color, by)
      else toggleArrow(start, end, by.color, by)
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
