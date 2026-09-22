import { useEffect } from 'react'
import { isTextTarget } from '../lib/clicker'

/**
 * Presentation-clicker keys, the same set the ICN Chess Club Planner uses:
 * every common Bluetooth clicker sends Page Down / Page Up, and some send
 * the arrow keys or space instead. One button walks forward, one back,
 * and the clicker's "blank" or escape key leaves the view.
 *
 * With `hold`, the forward button does double duty: a short press steps
 * (on release), and holding it for `holdMs` fires `hold` instead, which
 * the pages use to hide and show the answer. Clickers report a held button
 * two ways, and both count as one hold:
 *  - the key stays down and the OS repeats it (`e.repeat`), or
 *  - the clicker fires quick separate press / release pairs; a release
 *    followed by the same key again within `GAP_MS` is the same hold.
 * (Some clickers send F5 / Shift+F5 for a long press instead of holding
 * anything; useHideToggle catches those.)
 */
export const CLICKER_NEXT = ['ArrowRight', 'ArrowDown', 'PageDown', ' ']
export const CLICKER_PREV = ['ArrowLeft', 'ArrowUp', 'PageUp']

/** How long the forward button is held before it counts as a hold. */
export const HOLD_MS = 550
/** A release followed by the same key within this is one continuous hold. */
export const GAP_MS = 150

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
    // The forward button's press in progress, when `hold` is on.
    let press: { key: string; holdFired: boolean; holdTimer: number | null; releaseTimer: number | null } | null = null
    const stop = (id: number | null) => {
      if (id !== null) window.clearTimeout(id)
    }
    const finish = () => {
      if (!press) return
      stop(press.holdTimer)
      stop(press.releaseTimer)
      const fired = press.holdFired
      press = null
      if (!fired) next()
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
        if (press && press.key === e.key) {
          // Still held: an OS repeat, or the next press of a quick burst.
          stop(press.releaseTimer)
          press.releaseTimer = null
          return
        }
        if (press) finish()
        const started = { key: e.key, holdFired: false, holdTimer: null as number | null, releaseTimer: null as number | null }
        press = started
        started.holdTimer = window.setTimeout(() => {
          if (press !== started) return
          started.holdTimer = null
          started.holdFired = true
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
      if (!press || press.key !== e.key) return
      // Wait a beat: a burst clicker sends the same key again straight away.
      stop(press.releaseTimer)
      press.releaseTimer = window.setTimeout(finish, GAP_MS)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      if (press) {
        stop(press.holdTimer)
        stop(press.releaseTimer)
        press = null
      }
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [next, prev, exit, hold, holdMs])
}
