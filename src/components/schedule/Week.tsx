import clsx from 'clsx'
import { useRef, type ReactNode } from 'react'
import type { Student, StudentPlace } from '../../types/domain'
import { addMinutes, clashes, fmtDay, fmtTime, isOn, parseDate, shortName, weekDates, whereLabel, type Occurrence } from '../../lib/schedule'
import { Check, MapPin, Plus } from '../ui/Icons'
import { fmtMoney } from '../../lib/earnings'

/**
 * The week at a glance. On an iPad in landscape it's seven columns, Monday
 * to Sunday; narrower, one row per day. Changes read at a glance: a
 * cancelled lesson is struck through, a moved one leaves a dashed gap where
 * it was and turns up, marked, where it went; a day with two lessons says so.
 */
export function WeekView({
  start,
  occurrences,
  students,
  places,
  today,
  fees,
  paid,
  onOpen,
  onMenu,
  onAdd,
}: {
  start: string
  occurrences: Occurrence[]
  students: Map<string, Student>
  places: Map<string, StudentPlace>
  today: string
  /** Each lesson's fee by key, when earnings show; null for a student with no rate. */
  fees?: Map<string, number | null>
  /** Each lesson's payment state, when paid lessons are tracked. */
  paid?: Map<string, 'paid' | 'due' | 'open' | null>
  onOpen: (o: Occurrence) => void
  /** Right-click or long-press: the quick menu (reschedule, cancel…). */
  onMenu: (o: Occurrence) => void
  /** The day's +: a lesson on that day only, for anyone (an extra this week, a make-up). */
  onAdd?: (date: string) => void
}) {
  const clash = clashes(occurrences)
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-7 lg:gap-2">
      {weekDates(start).map((date) => {
        const list = occurrences.filter((o) => o.date === date && students.has(o.studentId))
        const on = list.filter(isOn).length
        const isToday = date === today
        const past = date < today
        const d = parseDate(date)
        return (
          <section
            key={date}
            aria-label={fmtDay(date, { weekday: 'long' })}
            className={clsx(
              'flex gap-3 rounded-2xl border bg-surface p-2.5 shadow-card lg:block lg:min-h-[190px]',
              isToday ? 'border-accent ring-2 ring-accent/25' : 'border-line',
              past && !isToday && 'opacity-75',
            )}
          >
            <header className="w-[58px] shrink-0 pt-1 lg:mb-2 lg:flex lg:w-auto lg:items-baseline lg:justify-between lg:gap-1 lg:px-1 lg:pt-0.5">
              <p className={clsx('text-[11px] font-bold tracking-[0.12em] uppercase', isToday ? 'text-accent-strong' : 'text-ink-3')}>
                {d.toLocaleDateString('en-US', { weekday: 'short' })}
                <span className={clsx('ml-1 text-[20px] tracking-normal lg:ml-1.5', isToday ? 'text-accent-strong' : 'text-ink')}>{d.getDate()}</span>
              </p>
              <div className="mt-1 flex flex-col gap-1 lg:mt-0 lg:items-end">
                {isToday && <span className="text-[10.5px] font-bold tracking-[0.1em] text-accent-strong uppercase">Today</span>}
                {on >= 2 && (
                  <span className="w-fit rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-warn">{on} lessons</span>
                )}
                {onAdd && (
                  <button
                    type="button"
                    onClick={() => onAdd(date)}
                    aria-label={`Add a lesson on ${fmtDay(date, { weekday: 'long' })}`}
                    title="Add a lesson this day"
                    className="grid h-8 w-8 place-items-center rounded-full text-ink-3 transition hover:bg-surface-2 hover:text-accent-strong active:scale-90 lg:-my-1 lg:h-7 lg:w-7"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
            </header>
            <div className="flex min-w-0 flex-1 flex-wrap gap-2 lg:flex-col">
              {list.length === 0 ? (
                <p className="self-center py-2 text-[13px] text-ink-3 lg:px-1">No lessons</p>
              ) : (
                list.map((o) => (
                  <LessonChip
                    key={o.key}
                    occurrence={o}
                    student={students.get(o.studentId)!}
                    place={places.get(o.studentId)}
                    clash={clash.has(o.key)}
                    fee={fees?.get(o.key)}
                    pay={paid?.get(o.key) ?? null}
                    onOpen={() => onOpen(o)}
                    onMenu={() => onMenu(o)}
                  />
                ))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function LessonChip({
  occurrence: o,
  student,
  place,
  clash,
  fee,
  pay,
  onOpen,
  onMenu,
}: {
  occurrence: Occurrence
  student: Student
  place?: StudentPlace
  clash: boolean
  fee?: number | null
  pay?: 'paid' | 'due' | 'open' | null
  onOpen: () => void
  onMenu: () => void
}) {
  // A finger held still for half a second opens the quick menu; moving it
  // (scrolling the week) or lifting it sooner is an ordinary tap or scroll.
  const timer = useRef<number | null>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const held = useRef(false)
  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  const off = !isOn(o)
  let badge: ReactNode = null
  if (o.state === 'cancelled') badge = <Badge tone="danger">Cancelled</Badge>
  else if (o.state === 'moved-away' && o.change?.new_date)
    badge = <Badge tone="muted">Moved to {whereLabel(o.change.new_date, o.change.new_time ?? o.time, o.date)}</Badge>
  else if (o.state === 'moved-here' && o.change?.original_date && o.slot)
    badge = <Badge tone="accent">Moved from {whereLabel(o.change.original_date, o.slot.start_time, o.date)}</Badge>
  else if (o.state === 'extra') badge = <Badge tone="accent">One-off</Badge>
  const where = place?.address.split(/[,\n]/)[0]?.trim()
  return (
    <button
      type="button"
      onClick={(e) => {
        // The lift after a long press isn't a tap.
        if (held.current) {
          held.current = false
          e.preventDefault()
          return
        }
        onOpen()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        if (held.current) return
        onMenu()
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return
        held.current = false
        origin.current = { x: e.clientX, y: e.clientY }
        stop()
        timer.current = window.setTimeout(() => {
          held.current = true
          navigator.vibrate?.(12)
          onMenu()
        }, 500)
      }}
      onPointerMove={(e) => {
        const o = origin.current
        if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 10) stop()
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
      title="Tap for details · right-click or hold to reschedule or cancel"
      aria-label={`${student.name}, ${fmtTime(o.time)}${o.state === 'regular' ? '' : `, ${o.state.replace('-', ' ')}`}`}
      className={clsx(
        'relative w-full min-w-0 rounded-xl border py-2 pr-2.5 pl-4 text-left transition active:scale-[0.98] sm:w-[calc(50%-4px)] lg:w-full',
        o.state === 'moved-away' ? 'border-dashed border-line-strong bg-transparent' : 'bg-surface-2',
        o.state === 'moved-here' || o.state === 'extra' ? 'border-accent/60' : o.state !== 'moved-away' && 'border-line',
        o.state === 'cancelled' && 'bg-danger-soft/40',
      )}
    >
      <span
        className={clsx('absolute inset-y-2 left-1.5 w-1.5 rounded-full', off && 'opacity-40')}
        style={{ background: student.color }}
      />
      <p className={clsx('flex flex-wrap gap-x-1 text-[13px] font-bold tabular-nums', off ? 'text-ink-3' : 'text-ink')}>
        <span className="whitespace-nowrap">{fmtTime(o.time)}</span>
        <span className="font-medium whitespace-nowrap text-ink-3">– {fmtTime(addMinutes(o.time, o.duration))}</span>
      </p>
      <p className="flex items-baseline justify-between gap-1.5">
        <span className={clsx('truncate text-[15px] leading-tight font-semibold', off ? 'text-ink-3 line-through decoration-2' : 'text-ink')} title={student.name}>
          {shortName(student.name)}
        </span>
        {fee != null && o.state !== 'moved-away' && (
          <span
            title={pay === 'paid' ? 'Paid' : pay === 'due' ? 'Taught, not paid yet' : undefined}
            className={clsx(
              'inline-flex shrink-0 items-center gap-0.5 rounded-md text-[12.5px] font-bold tabular-nums',
              o.state === 'cancelled' && 'text-ink-3 line-through',
              o.state !== 'cancelled' && pay === 'paid' && 'bg-accent px-1 text-accent-ink',
              o.state !== 'cancelled' && pay === 'due' && 'bg-warn-soft px-1 text-warn',
              o.state !== 'cancelled' && pay !== 'paid' && pay !== 'due' && 'text-accent-strong',
            )}
          >
            {pay === 'paid' && <Check size={12} strokeWidth={3} />}
            {fmtMoney(fee)}
          </span>
        )}
      </p>
      {badge && <div className="mt-1">{badge}</div>}
      {clash && (
        <div className="mt-1">
          <Badge tone="warn">Overlaps</Badge>
        </div>
      )}
      {where && !off && (
        <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-ink-3">
          <MapPin size={12} className="shrink-0" />
          <span className="truncate">{where}</span>
        </p>
      )}
    </button>
  )
}

export function Badge({ tone, children }: { tone: 'danger' | 'muted' | 'accent' | 'warn'; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-block max-w-full rounded-md px-1.5 py-0.5 align-middle text-[11px] leading-tight font-bold',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'muted' && 'bg-surface-2 text-ink-2',
        tone === 'accent' && 'bg-accent-soft text-accent-strong',
        tone === 'warn' && 'bg-warn-soft text-warn',
      )}
    >
      {children}
    </span>
  )
}
