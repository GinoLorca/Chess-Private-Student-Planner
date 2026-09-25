import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { Refresh } from './Icons'

/**
 * Pull the page down from the top to refresh: it stretches with resistance,
 * a badge grows in as you pull, and past the line a release slingshots the
 * page back with a bounce while every query refetches and the service
 * worker checks for a newer build (which then installs and reloads on its
 * own). Works with a finger or a mouse; never starts on a board, the
 * Rolodex, a button or a field, since those own their own drags.
 */
const THRESHOLD = 72
const MAX_PULL = 150
const RESISTANCE = 0.55
const OWN_DRAG = 'input, textarea, select, button, a, [data-swipe-own], [data-no-pull], [role="listbox"], .touch-none'

type Phase = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'done'

export function PullToRefresh({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const y = useMotionValue(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const phaseRef = useRef<Phase>('idle')
  const set = (p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }

  useEffect(() => {
    let startY = 0
    let active = false
    let pulling = false

    const begin = (target: EventTarget | null, clientY: number): boolean => {
      if (phaseRef.current === 'refreshing' || phaseRef.current === 'done') return false
      if (window.scrollY > 0) return false
      if (target instanceof Element && target.closest(OWN_DRAG)) return false
      active = true
      pulling = false
      startY = clientY
      return true
    }
    const move = (clientY: number): boolean => {
      if (!active) return false
      const dy = clientY - startY
      if (!pulling) {
        if (dy < -4 || window.scrollY > 0) {
          active = false
          return false
        }
        if (dy < 10) return false
        pulling = true
      }
      const pull = Math.max(0, Math.min(MAX_PULL, dy * RESISTANCE))
      y.set(pull)
      set(pull >= THRESHOLD ? 'armed' : 'pulling')
      return true
    }
    const end = () => {
      if (!active) return
      active = false
      if (!pulling) return
      pulling = false
      if (y.get() >= THRESHOLD) void refresh()
      else {
        set('idle')
        animate(y, 0, { type: 'spring', stiffness: 420, damping: 30 })
      }
    }

    const refresh = async () => {
      set('refreshing')
      animate(y, THRESHOLD, { type: 'spring', stiffness: 300, damping: 28 })
      const started = Date.now()
      try {
        await Promise.all([qc.invalidateQueries(), checkForUpdate()])
      } catch {
        // Offline or a failed refetch: the page still springs back.
      }
      await new Promise((r) => setTimeout(r, Math.max(0, 650 - (Date.now() - started))))
      set('done')
      // The slingshot: a lively spring shoots past the rest position and settles.
      await animate(y, 0, { type: 'spring', stiffness: 560, damping: 13, velocity: -1400 })
      set('idle')
    }

    const onTouchStart = (e: TouchEvent) => begin(e.target, e.touches[0].clientY)
    const onTouchMove = (e: TouchEvent) => {
      if (move(e.touches[0].clientY)) e.preventDefault()
    }
    const onMouseDown = (e: MouseEvent) => {
      // Claiming the press stops the drag from selecting text on the way down.
      if (e.button === 0 && begin(e.target, e.clientY)) e.preventDefault()
    }
    const onMouseMove = (e: MouseEvent) => {
      if (move(e.clientY)) e.preventDefault()
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', end)
    window.addEventListener('touchcancel', end)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', end)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', end)
      window.removeEventListener('touchcancel', end)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', end)
    }
  }, [qc, y])

  // The badge: grows in over the first part of the pull, sits below the top bar.
  const badgeScale = useTransform(y, [0, THRESHOLD], [0.4, 1])
  const badgeOpacity = useTransform(y, [0, 24, THRESHOLD], [0, 0.6, 1])
  const badgeY = useTransform(y, (v) => Math.min(v, THRESHOLD) - 8)
  const arrowRotate = useTransform(y, [0, THRESHOLD], [0, 180])
  const label =
    phase === 'armed' ? 'Release to refresh' : phase === 'refreshing' ? 'Refreshing…' : phase === 'done' ? 'Up to date' : 'Pull to refresh'

  return (
    <>
      <motion.div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-safe"
        style={{ y: badgeY, opacity: badgeOpacity }}
      >
        <motion.div
          className="mt-3 flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-ink shadow-float"
          style={{ scale: badgeScale }}
        >
          <motion.span
            className={phase === 'refreshing' ? 'animate-spin' : undefined}
            style={phase === 'refreshing' || phase === 'done' ? undefined : { rotate: arrowRotate }}
          >
            <Refresh size={16} />
          </motion.span>
          {label}
        </motion.div>
      </motion.div>
      <motion.div style={{ y }}>{children}</motion.div>
    </>
  )
}

/** Ask the service worker for a newer build; with auto-update on, a new one installs and reloads by itself. */
async function checkForUpdate() {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return
  await reg.update()
  reg.waiting?.postMessage({ type: 'SKIP_WAITING' })
}
