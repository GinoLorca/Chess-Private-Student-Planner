import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import type { Student } from '../../types/domain'
import { useReminders, useScheduleChanges, useScheduleMissing, useScheduleSlots } from '../../lib/queries'
import { fmtTime, isOn, shortName, todayIso, weekOccurrences, weekStart } from '../../lib/schedule'
import { Bell, Calendar, ChevronRight } from '../ui/Icons'

/**
 * Today's lessons in one line above the folders, with any moves or
 * cancellations marked, and the open reminders; it leads to the Schedule.
 * Stays out of the way until there's a schedule to show.
 */
export function TodayStrip({ students }: { students: Student[] }) {
  const missing = useScheduleMissing()
  const ready = Boolean(missing.data && missing.data.length === 0)
  const slots = useScheduleSlots(ready)
  const changes = useScheduleChanges(ready)
  const reminders = useReminders(ready)
  const today = todayIso()
  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])
  const list = useMemo(
    () => weekOccurrences(weekStart(today), slots.data ?? [], changes.data ?? []).filter((o) => o.date === today && byId.has(o.studentId)),
    [today, slots.data, changes.data, byId],
  )
  const open = (reminders.data ?? []).filter((r) => !r.done).length
  if (!ready || ((slots.data ?? []).length === 0 && open === 0)) return null
  return (
    <Link
      to="/schedule"
      className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card transition active:scale-[0.99]"
    >
      <Calendar size={20} className="shrink-0 text-accent-strong" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold tracking-[0.12em] text-ink-3 uppercase">Today</p>
        {list.length === 0 ? (
          <p className="text-[15px] text-ink-2">No lessons today</p>
        ) : (
          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[15px]">
            {list.map((o) => {
              const s = byId.get(o.studentId)!
              return (
                <span key={o.key} className={clsx('whitespace-nowrap', isOn(o) ? 'text-ink' : 'text-ink-3 line-through')}>
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle ring-1 ring-black/10" style={{ background: s.color }} />
                  <span className="font-semibold">{shortName(s.name)}</span> {fmtTime(o.time)}
                  {o.state === 'moved-here' && <span className="ml-1 text-[12px] font-bold text-accent-strong no-underline">moved here</span>}
                  {o.state === 'extra' && <span className="ml-1 text-[12px] font-bold text-accent-strong">one-off</span>}
                </span>
              )
            })}
          </p>
        )}
      </div>
      {open > 0 && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[12px] font-bold text-accent-ink">
          <Bell size={13} /> {open}
        </span>
      )}
      <ChevronRight size={18} className="shrink-0 text-ink-3" />
    </Link>
  )
}
