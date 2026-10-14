import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { noteRoute, restoredSnapshot } from '../lib/resume'

/**
 * Keeps the note of which screen is showing (see src/lib/resume.ts), and on
 * a launch that came back to a screen, scrolls it back to where it was once
 * its content has drawn. Renders nothing.
 */
export function ResumeTracker() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    noteRoute(pathname + search)
  }, [pathname, search])

  useEffect(() => {
    const saved = restoredSnapshot()
    if (!saved || saved.scroll <= 0) return
    const target = saved.scroll
    const until = performance.now() + 4000
    let frame = 0
    const stop = () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('wheel', stop)
      window.removeEventListener('keydown', stop)
    }
    // The screen fills in from the saved data a moment after it opens: wait
    // until it's tall enough, and never fight a coach who's already scrolling.
    const tryScroll = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight
      if (room >= target || performance.now() > until) {
        if (room > 0) window.scrollTo(0, Math.min(target, room))
        stop()
        return
      }
      frame = requestAnimationFrame(tryScroll)
    }
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('keydown', stop)
    frame = requestAnimationFrame(tryScroll)
    return stop
  }, [])
  return null
}
