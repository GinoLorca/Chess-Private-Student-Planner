import { useRef, type PointerEvent } from 'react'

/**
 * Photos-style paging: a sideways swipe anywhere on the screen turns the
 * page. Returns pointer handlers to spread on the screen's root element.
 *
 * A swipe is a mostly-horizontal move of at least `distance` pixels with the
 * primary pointer. Taps still click, vertical scrolls still scroll, and a
 * gesture that starts inside an element marked `data-swipe-own` (the board,
 * which drags on its own) is left to that element.
 */
export function useSwipeNav(onSwipe: (dir: 1 | -1) => void, distance = 70) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null)

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    if ((e.target as Element).closest('[data-swipe-own], input, textarea, select')) return
    start.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: PointerEvent) => {
    const s = start.current
    start.current = null
    if (!s || s.id !== e.pointerId) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) >= distance && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1)
  }
  const onPointerCancel = () => {
    start.current = null
  }
  return { onPointerDown, onPointerUp, onPointerCancel }
}
