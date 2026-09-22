import { useCallback, useEffect, useState } from 'react'
import { isTextTarget, isToggleKey, isToggleMouse, loadToggle } from '../lib/clicker'

/**
 * Hidden / shown for the explanation on a board page, flipped by the eye
 * button or by the clicker's taught third button (see src/lib/clicker.ts).
 * Starts shown, since the coach opens these pages to read.
 */
export function useHideToggle(): [boolean, () => void] {
  const [hidden, setHidden] = useState(false)
  const toggle = useCallback(() => setHidden((h) => !h), [])
  useEffect(() => {
    const custom = loadToggle()
    const onKey = (e: KeyboardEvent) => {
      if (isTextTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (isToggleKey(e, custom)) {
        // Swallow it on the way down and up: F5 would reload the page and
        // Shift+F5 opens a browser panel otherwise.
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'keydown' && !e.repeat) toggle()
      }
    }
    // A clicker whose extra button reports as a mouse button (never the
    // left one, and never the right one that draws arrows).
    const onMouse = (e: MouseEvent) => {
      if (isToggleMouse(e, custom)) {
        e.preventDefault()
        if (e.type === 'mousedown') toggle()
      }
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKey, true)
    window.addEventListener('mousedown', onMouse)
    window.addEventListener('mouseup', onMouse)
    window.addEventListener('auxclick', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keyup', onKey, true)
      window.removeEventListener('mousedown', onMouse)
      window.removeEventListener('mouseup', onMouse)
      window.removeEventListener('auxclick', onMouse)
    }
  }, [toggle])
  return [hidden, toggle]
}
