import { useEffect } from 'react'
import { isTextTarget } from '../lib/clicker'

/**
 * Presentation-clicker keys, the same set the ICN Chess Club Planner uses:
 * every common Bluetooth clicker sends Page Down / Page Up, and some send
 * the arrow keys or space instead. One button walks forward, one back,
 * and the clicker's "blank" or escape key leaves the view.
 *
 * With `hold`, the forward button does double duty: a short press steps
 * (on release), holding it for `holdMs` fires `hold` instead, which the
 * pages use to hide and show the answer. Key repeat while holding is
 * ignored, so a long press is one action.
 */
export const CLICKER_NEXT = ['ArrowRight', 'ArrowDown', 'PageDown', ' ']
export const CLICKER_PREV = ['ArrowLeft', 'ArrowUp', 'PageUp']

/** How long the forward button is held before it counts as a hold. */
export const HOLD_MS = 550

export function useClicker({
  next,
  prev,
  exit,
  hold,
  holdMs = HOLD_MS,
}: {
  next: () => void
  prev: () => void
  exit?: () => void
  hold?: () => void
  holdMs?: number
}) {
  useEffect(() => {
    let timer: number | null = null
    const clear = () => {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
    }
    const onDown = (e: KeyboardEvent) => {
      // Typing in a field must never turn the page.
      if (isTextTarget(e.target)) return
      if (CLICKER_NEXT.includes(e.key)) {
        e.preventDefault()
        if (!hold) {
          if (!e.repeat) next()
          return
        }
        if (e.repeat) return
        clear()
        timer = window.setTimeout(() => {
          timer = null
          hold()
        }, holdMs)
      } else if (CLICKER_PREV.includes(e.key)) {
        e.preventDefault()
        if (!e.repeat) prev()
      } else if (e.key === 'Escape' && exit) {
        exit()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (!hold || !CLICKER_NEXT.includes(e.key)) return
      // Released before the hold fired: an ordinary press.
      if (timer !== null) {
        clear()
        next()
      }
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      clear()
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [next, prev, exit, hold, holdMs])
}
