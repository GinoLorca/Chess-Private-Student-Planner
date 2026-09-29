import { useEffect, useRef, useState } from 'react'
import { reminderLessonEnd } from '../../lib/schedule'
import { useReminders, useScheduleChanges, useScheduleMissing, useScheduleMutations, useScheduleSlots } from '../../lib/queries'

/**
 * A reminder about a lesson (moved, extra, cancelled) has done its job once
 * that lesson is over: the moment it ends, the reminder is ticked off, so
 * the bell and the open list only hold what's still ahead. Mounted once for
 * the whole app; renders nothing.
 */
export function ReminderSweep() {
  const missing = useScheduleMissing()
  const ready = Boolean(missing.data && missing.data.length === 0)
  const reminders = useReminders(ready)
  const changes = useScheduleChanges(ready)
  const slots = useScheduleSlots(ready)
  const { updateReminder } = useScheduleMutations()
  const [now, setNow] = useState(() => Date.now())
  const swept = useRef(new Set<string>())

  const open = (reminders.data ?? [])
    .filter((r) => !r.done)
    .map((r) => ({ r, end: reminderLessonEnd(r, changes.data ?? [], slots.data ?? []) }))
    .filter((x): x is { r: (typeof x)['r']; end: number } => x.end !== null)
  const ended = open.filter((x) => x.end <= now)
  const nextEnd = Math.min(...open.filter((x) => x.end > now).map((x) => x.end))

  useEffect(() => {
    for (const { r } of ended) {
      // Once per reminder, while its save is on the way.
      if (swept.current.has(r.id)) continue
      swept.current.add(r.id)
      updateReminder.mutate({ id: r.id, patch: { done: true } })
    }
  })

  // Look again the moment the next lesson ends; timers can't wait past ~24 days.
  useEffect(() => {
    if (!Number.isFinite(nextEnd)) return
    const t = window.setTimeout(() => setNow(Date.now()), Math.min(Math.max(0, nextEnd - Date.now()) + 50, 2 ** 31 - 1))
    return () => window.clearTimeout(t)
  }, [nextEnd])
  // An iPad pauses timers in the background: catch up on return.
  useEffect(() => {
    const refresh = () => document.visibilityState === 'visible' && setNow(Date.now())
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  return null
}
