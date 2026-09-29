import { useCallback, useEffect, useState } from 'react'
import { isTextTarget } from '../lib/clicker'

/**
 * Which way up the board is: the Flip button, or X on a keyboard from
 * anywhere on the page (not while typing).
 */
export function useFlip(): [boolean, () => void] {
  const [flipped, setFlipped] = useState(false)
  const toggle = useCallback(() => setFlipped((f) => !f), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'x' || e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTextTarget(e.target)) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])
  return [flipped, toggle]
}

/** The other side's view. */
export const opposite = (o: 'white' | 'black') => (o === 'white' ? 'black' : 'white')
