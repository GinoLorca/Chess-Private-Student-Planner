import { useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import type { BoardArrow, BoardHighlight } from '../../types/domain'
import { PEN_COLORS, HIGHLIGHT_ALPHA } from '../../lib/import/pgn'
import { DRAG_THRESHOLD, isSecondaryButton, squareAtPoint } from './pointer'

export interface RightClickDraw {
  /** Handles a secondary-button press; returns true when it took the event. */
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
 * Lichess's right-button gesture on any board: right-drag draws an arrow,
 * right-click a square highlights it, the same again removes it. The pen
 * follows the modifier keys as on Lichess: plain green, Shift red, Alt blue,
 * Ctrl/Cmd yellow. A trackpad two-finger tap on the iPad counts as the right
 * button too. Left-button presses are left alone for whatever the board does.
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
    if (!enabled || !isSecondaryButton(e)) return false
    const start = squareAtPoint(e.clientX, e.clientY, boardRef.current)
    if (!start) return false
    e.preventDefault()
    e.stopPropagation()
    const pen = e.shiftKey ? PEN_COLORS.R : e.altKey ? PEN_COLORS.B : e.ctrlKey || e.metaKey ? PEN_COLORS.Y : PEN_COLORS.G
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
        setPreview(sq === start ? null : { startSquare: start, endSquare: sq, color: pen })
      }
    }
    const onUp = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      setPreview(null)
      setFrom(null)
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
