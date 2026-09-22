import { useEffect } from 'react'
import { isTextTarget } from '../lib/clicker'

/**
 * Presentation-clicker keys, the same set the ICN Chess Club Planner uses:
 * every common Bluetooth clicker sends Page Down / Page Up, and some send
 * the arrow keys or space instead. One button walks forward, one back,
 * and the clicker's "blank" or escape key leaves the view.
 *
 * With `hold`, both buttons do double duty: a short press steps (on
 * release), holding either for `holdMs` fires `hold` instead, which the
 * pages use to hide and show the answer. Key repeat while holding is
 * ignored, so a long press is one action. (Many clickers don't hold the
 * key on a long press but send F5 / Shift+F5 instead; useHideToggle
 * catches those.)
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
    let pending: (() => void) | null = null
    const onDown = (e: KeyboardEvent) => {
      // Typing in a field must never turn the page.
      if (isTextTarget(e.target)) return
      const action = CLICKER_NEXT.includes(e.key) ? next : CLICKER_PREV.includes(e.key) ? prev : null
      if (action) {
        e.preventDefault()
        if (!hold) {
          if (!e.repeat) action()
          return
        }
        if (e.repeat) return
        clear()
        pending = action
        timer = window.setTimeout(() => {
          timer = null
          pending = null
          hold()
        }, holdMs)
      } else if (e.key === 'Escape' && exit) {
        exit()
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (!hold || !(CLICKER_NEXT.includes(e.key) || CLICKER_PREV.includes(e.key))) return
      // Released before the hold fired: an ordinary press.
      if (timer !== null && pending) {
        const action = pending
        clear()
        pending = null
        action()
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
