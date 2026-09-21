import { useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import type { BoardArrow, BoardHighlight } from '../../types/domain'
import { HIGHLIGHT_ALPHA, currentPen } from '../../lib/pens'
import { DRAG_THRESHOLD, isSecondaryButton, squareAtPoint } from './pointer'

export interface RightClickDraw {
  /**
   * Handles the drawing gestures; returns true when it took the event. A
   * left press only clears (and returns false) so the board's own left-click
   * behaviour still runs.
   */
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => boolean
  onContextMenu: (e: ReactMouseEvent) => void
  /** The saved arrows plus the one being dragged out. */
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
  /** The square a drag started on, to show as selected. */
  from: string | null
}

interface Options {
  boardRef: RefObject<HTMLDivElement | null>
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
  onArrowsChange: (arrows: BoardArrow[]) => void
  onHighlightsChange: (highlights: BoardHighlight[]) => void
  enabled?: boolean
}

/**
 * The Repertoire Lab gesture on any board: right-drag draws an arrow,
 * right-click a square highlights it, the same again removes it, and a plain
 * left click wipes everything drawn. Hold Z / R / F / C while dragging for
 * green / red / blue / yellow; green with nothing held. A trackpad
 * two-finger tap counts as the right button.
 */
export function useRightClickDraw({ boardRef, arrows, highlights, onArrowsChange, onHighlightsChange, enabled = true }: Options): RightClickDraw {
  const [preview, setPreview] = useState<BoardArrow | null>(null)
  const [from, setFrom] = useState<string | null>(null)

  function toggleHighlight(square: string, pen: string) {
    const color = pen + HIGHLIGHT_ALPHA
    const existing = highlights.find((h) => h.square === square)
    if (existing && existing.color === color) onHighlightsChange(highlights.filter((h) => h.square !== square))
    else if (existing) onHighlightsChange(highlights.map((h) => (h.square === square ? { ...h, color } : h)))
    else onHighlightsChange([...highlights, { square, color }])
  }

  function toggleArrow(start: string, end: string, pen: string) {
    const i = arrows.findIndex((a) => a.startSquare === start && a.endSquare === end)
    if (i >= 0 && arrows[i].color === pen) onArrowsChange(arrows.filter((_, j) => j !== i))
    else if (i >= 0) onArrowsChange(arrows.map((a, j) => (j === i ? { ...a, color: pen } : a)))
    else onArrowsChange([...arrows, { startSquare: start, endSquare: end, color: pen }])
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>): boolean {
    if (!enabled) return false
    if (e.pointerType === 'mouse' && e.button === 0) {
      // A plain left click wipes this position's marks; the board's own
      // left-click handling carries on as usual.
      if (arrows.length) onArrowsChange([])
      if (highlights.length) onHighlightsChange([])
      return false
    }
    if (!isSecondaryButton(e)) return false
    const start = squareAtPoint(e.clientX, e.clientY, boardRef.current)
    if (!start) return false
    e.preventDefault()
    e.stopPropagation()
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

  return {
    onPointerDown,
    onContextMenu: (e) => e.preventDefault(),
    arrows: preview ? [...arrows, preview] : arrows,
    highlights,
    from,
  }
}
