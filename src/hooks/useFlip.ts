import { useCallback, useEffect } from 'react'
import { isTextTarget } from '../lib/clicker'
import { useResumeState } from '../lib/resume'

/**
 * Which way up the board is: the Flip button, or X on a keyboard from
 * anywhere on the page (not while typing). With a resume key it comes back
 * as it was when the app is reopened onto this screen.
 */
export function useFlip(resumeKey: string | null = null): [boolean, () => void] {
  const [flipped, setFlipped] = useResumeState(resumeKey, false)
  const toggle = useCallback(() => setFlipped((f) => !f), [setFlipped])
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
