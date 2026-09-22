import { useEffect } from 'react'

/**
 * Presentation-clicker keys, the same set the ICN Chess Club Planner uses:
 * every common Bluetooth clicker sends Page Down / Page Up, and some send
 * the arrow keys or space instead. One button walks forward, one back,
 * and the clicker's "blank" or escape key leaves the view.
 */
export const CLICKER_NEXT = ['ArrowRight', 'ArrowDown', 'PageDown', ' ']
export const CLICKER_PREV = ['ArrowLeft', 'ArrowUp', 'PageUp']

export function useClicker({ next, prev, exit }: { next: () => void; prev: () => void; exit?: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Typing in a field must never turn the page.
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (CLICKER_NEXT.includes(e.key)) {
        e.preventDefault()
        next()
      } else if (CLICKER_PREV.includes(e.key)) {
        e.preventDefault()
        prev()
      } else if (e.key === 'Escape' && exit) {
        exit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, exit])
}
