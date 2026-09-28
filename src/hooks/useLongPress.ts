import { useRef, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'

/**
 * Right-click with a mouse, or press and hold with a finger, to open a menu.
 * The hold is half a second; moving the finger (a scroll) or lifting it
 * sooner is an ordinary tap or scroll. The lift after a hold is swallowed so
 * it doesn't also open whatever was held (a card's link), and iOS's own
 * link preview and text selection are kept out of the way.
 *
 * Spread `bind` on the element and add `onClickCapture` to swallow that lift.
 */
export function useLongPress(onMenu: () => void, ms = 500) {
  const timer = useRef<number | null>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const held = useRef(false)
  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  const style: CSSProperties = { WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }
  return {
    bind: {
      onContextMenu: (e: MouseEvent) => {
        e.preventDefault()
        if (held.current) return
        onMenu()
      },
      onPointerDown: (e: PointerEvent) => {
        if (e.pointerType === 'mouse') return
        held.current = false
        origin.current = { x: e.clientX, y: e.clientY }
        stop()
        timer.current = window.setTimeout(() => {
          held.current = true
          navigator.vibrate?.(12)
          onMenu()
        }, ms)
      },
      onPointerMove: (e: PointerEvent) => {
        const o = origin.current
        if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 10) stop()
      },
      onPointerUp: stop,
      onPointerCancel: stop,
      onPointerLeave: stop,
      style,
    },
    /** The click that ends a hold isn't a tap: stop it before a link or button inside sees it. */
    onClickCapture: (e: MouseEvent) => {
      if (!held.current) return
      held.current = false
      e.preventDefault()
      e.stopPropagation()
    },
  }
}
