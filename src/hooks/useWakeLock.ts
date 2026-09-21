import { useEffect } from 'react'

/**
 * Keep the screen on while a lesson view is open. An iPad that dims mid-puzzle
 * breaks the flow at the table; Safari supports this from iOS 16.4.
 */
export function useWakeLock(active = true) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        // Denied (low battery, not visible): nothing to do.
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) request()
    }

    request()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      lock?.release().catch(() => {})
    }
  }, [active])
}
