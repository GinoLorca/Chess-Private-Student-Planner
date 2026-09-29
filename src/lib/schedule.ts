import type { Reminder, ScheduleChange, ScheduleSlot, StudentPlace } from '../types/domain'

/**
 * The schedule's arithmetic, kept free of React and the database so it can be
 * checked on its own. Dates are local calendar days as "YYYY-MM-DD" and times
 * are local wall-clock "HH:MM": a 4:30 lesson is at 4:30 wherever the iPad is,
 * with no time zone to drift.
 */

// ---------------------------------------------------------------------------
// dates and times
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local midnight of a "YYYY-MM-DD" day. */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayIso(): string {
  return isoDate(new Date())
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(s: string): number {
  return parseDate(s).getDay()
}

/** The Monday that starts the week holding this day. */
export function weekStart(s: string): string {
  return addDays(s, -((weekdayOf(s) + 6) % 7))
}

export function weekDates(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** The weekdays in the order the week is shown: Monday first. */
export const WEEKDAYS: { value: number; short: string; long: string }[] = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
]

export const weekdayName = (n: number, form: 'short' | 'long' = 'long') => WEEKDAYS.find((w) => w.value === n)?.[form] ?? ''

/** "16:30" → minutes after midnight. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function addMinutes(time: string, n: number): string {
  const t = (((minutesOf(time) + n) % 1440) + 1440) % 1440
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`
}

/** "16:30" → "4:30 PM". */
export function fmtTime(time: string): string {
  const t = minutesOf(time)
  const h = Math.floor(t / 60)
  const m = t % 60
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
}

/** "2026-09-29" → "Tue, Sep 29". */
export function fmtDay(s: string, opts: { weekday?: 'short' | 'long' } = {}): string {
  return parseDate(s).toLocaleDateString('en-US', { weekday: opts.weekday ?? 'short', month: 'short', day: 'numeric' })
}

/** "Sep 28 – Oct 4". */
export function fmtWeekRange(start: string): string {
  const a = parseDate(start)
  const b = parseDate(addDays(start, 6))
  const md = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return a.getMonth() === b.getMonth() ? `${md(a)} – ${b.getDate()}` : `${md(a)} – ${md(b)}`
}

/** How a week reads relative to today: "This week", "Next week", "Last week", or its dates. */
export function weekLabel(start: string, today = todayIso()): string {
  const diff = Math.round((parseDate(start).getTime() - parseDate(weekStart(today)).getTime()) / (7 * 86400000))
  if (diff === 0) return 'This week'
  if (diff === 1) return 'Next week'
  if (diff === -1) return 'Last week'
  return `Week of ${fmtWeekRange(start)}`
}

/** A local date and wall-clock time as a real moment. */
export function localDateTime(date: string, time: string): Date {
  const d = parseDate(date)
  const t = minutesOf(time)
  d.setHours(Math.floor(t / 60), t % 60, 0, 0)
  return d
}

// ---------------------------------------------------------------------------
// the week, with its changes
// ---------------------------------------------------------------------------

/**
 * One lesson in a given week, as it stands after that week's changes:
 * - regular:     the usual lesson, as usual
 * - cancelled:   the usual lesson, called off this week
 * - moved-away:  the usual lesson's spot, empty this week because it moved
 * - moved-here:  that lesson in its new spot (maybe in another week)
 * - extra:       a one-off lesson with no regular slot
 */
export type OccurrenceState = 'regular' | 'cancelled' | 'moved-away' | 'moved-here' | 'extra'

export interface Occurrence {
  key: string
  date: string
  time: string
  duration: number
  studentId: string
  state: OccurrenceState
  slot: ScheduleSlot | null
  change: ScheduleChange | null
}

/** Taking place (as opposed to called off, or moved elsewhere). */
export const isOn = (o: Occurrence) => o.state === 'regular' || o.state === 'moved-here' || o.state === 'extra'

/** Every lesson in the week that starts on `start` (a Monday), sorted by day and time. */
export function weekOccurrences(start: string, slots: ScheduleSlot[], changes: ScheduleChange[]): Occurrence[] {
  const days = new Set(weekDates(start))
  const out: Occurrence[] = []
  for (const slot of slots) {
    const date = addDays(start, (slot.weekday + 6) % 7)
    const change = changes.find((c) => c.slot_id === slot.id && c.original_date === date && c.kind !== 'extra') ?? null
    out.push({
      key: `${slot.id}:${date}`,
      date,
      time: slot.start_time,
      duration: slot.duration_min,
      studentId: slot.student_id,
      state: !change ? 'regular' : change.kind === 'cancelled' ? 'cancelled' : 'moved-away',
      slot,
      change,
    })
  }
  for (const change of changes) {
    if (change.kind === 'cancelled' || !change.new_date || !days.has(change.new_date)) continue
    const slot = change.slot_id ? (slots.find((s) => s.id === change.slot_id) ?? null) : null
    // A move whose regular slot has since been deleted has nothing to move.
    if (change.kind === 'moved' && !slot) continue
    out.push({
      key: `${change.id}:new`,
      date: change.new_date,
      time: change.new_time ?? slot?.start_time ?? '00:00',
      duration: change.duration_min ?? slot?.duration_min ?? 60,
      studentId: change.student_id,
      state: change.kind === 'moved' ? 'moved-here' : 'extra',
      slot,
      change,
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
}

/** Keys of lessons that overlap another lesson that's on the same day. */
export function clashes(list: Occurrence[]): Set<string> {
  const on = list.filter(isOn)
  const hit = new Set<string>()
  for (let i = 0; i < on.length; i++)
    for (let j = i + 1; j < on.length; j++) {
      const a = on[i], b = on[j]
      if (a.date !== b.date) continue
      const a0 = minutesOf(a.time), b0 = minutesOf(b.time)
      if (a0 < b0 + b.duration && b0 < a0 + a.duration) {
        hit.add(a.key)
        hit.add(b.key)
      }
    }
  return hit
}

/** Where a moved lesson went, or came from: "Thu 4:30 PM" within the same week, the date beyond it. */
export function whereLabel(date: string, time: string, sameWeekAs: string): string {
  const day = weekStart(date) === weekStart(sameWeekAs) ? parseDate(date).toLocaleDateString('en-US', { weekday: 'short' }) : fmtDay(date)
  return `${day} ${fmtTime(time)}`
}

// ---------------------------------------------------------------------------
// reminders
// ---------------------------------------------------------------------------

/** What a student is called in a tight spot: the nickname in quotes, else the first name. */
export function shortName(name: string): string {
  const nick = /["“](.+?)["”]/.exec(name)?.[1]
  if (nick) return nick
  return name.trim().split(/\s+/)[0] || name
}

export type NewReminder = Pick<Reminder, 'title' | 'notes' | 'due_at' | 'student_id'>

/** The first of these moments still ahead of now, or null when they're all past. */
function firstAhead(moments: Date[], now: Date): string | null {
  const next = moments.find((m) => m.getTime() > now.getTime())
  return next ? next.toISOString() : null
}

const when = (date: string, time: string) => `${fmtDay(date)} at ${fmtTime(time)}`

/** A lesson reminder's alert: the night before, at 9:27 PM. */
export const ALERT_TIME = '21:27'
export const nightBefore = (date: string) => localDateTime(addDays(date, -1), ALERT_TIME)

/**
 * A reminder for one lesson as it stands, to send to Apple Reminders: who,
 * when, where and the codes to get in. Its alert is the night before at
 * 9:27 PM; once that's past, an hour before the lesson, then its start.
 */
export function lessonReminder(
  o: Pick<Occurrence, 'date' | 'time' | 'duration' | 'studentId'>,
  studentName: string,
  place?: Pick<StudentPlace, 'address' | 'door_code' | 'bathroom_code' | 'bathroom_note' | 'extra_codes'> | null,
  now = new Date(),
): NewReminder {
  const start = localDateTime(o.date, o.time)
  const codes = [
    place?.door_code && `Door ${place.door_code}`,
    place?.bathroom_code && `Bathroom ${place.bathroom_code}${place.bathroom_note ? ` (${place.bathroom_note})` : ''}`,
    ...(place?.extra_codes ?? []).filter((c) => c.code).map((c) => `${c.label || 'Code'} ${c.code}`),
  ].filter(Boolean)
  return {
    student_id: o.studentId,
    title: `Lesson: ${shortName(studentName)}, ${when(o.date, o.time)}`,
    notes: [
      `${fmtTime(o.time)} – ${fmtTime(addMinutes(o.time, o.duration))}`,
      place?.address && `At ${place.address.replace(/\s*\n\s*/g, ', ')}`,
      codes.length > 0 && `Codes: ${codes.join(' · ')}`,
    ]
      .filter(Boolean)
      .join('\n'),
    due_at: firstAhead([nightBefore(o.date), new Date(start.getTime() - 60 * 60000), start], now),
  }
}

/**
 * The reminder a change writes, due the night before the lesson at 9:27 PM
 * (for a cancellation, the lesson that's off, so the free slot isn't
 * forgotten). Once that's past it falls back to the morning of a
 * cancelled lesson or an hour before a moved or extra one, then its start,
 * then no due date.
 */
export function reminderFor(
  change: Pick<ScheduleChange, 'kind' | 'original_date' | 'new_date' | 'new_time' | 'note' | 'student_id'>,
  studentName: string,
  slot: Pick<ScheduleSlot, 'start_time'> | null,
  now = new Date(),
): NewReminder {
  const nick = shortName(studentName)
  const note = change.note.trim()
  if (change.kind === 'cancelled') {
    const date = change.original_date!
    const time = slot?.start_time ?? '09:00'
    return {
      student_id: change.student_id,
      title: `Cancelled: ${nick}'s lesson, ${when(date, time)}`,
      notes: [note && `Reason: ${note}`, `The ${fmtTime(time)} slot on ${fmtDay(date, { weekday: 'long' })} is free.`].filter(Boolean).join('\n'),
      due_at: firstAhead([nightBefore(date), localDateTime(date, '09:00'), localDateTime(date, time)], now),
    }
  }
  const date = change.new_date!
  const time = change.new_time ?? slot?.start_time ?? '09:00'
  const start = localDateTime(date, time)
  const hourBefore = new Date(start.getTime() - 60 * 60000)
  if (change.kind === 'moved') {
    const from = change.original_date && slot ? when(change.original_date, slot.start_time) : null
    return {
      student_id: change.student_id,
      title: `Rescheduled: ${nick}'s lesson, now ${when(date, time)}`,
      notes: [from && `Moved from ${from}.`, note && `Reason: ${note}`, 'This week only; the regular time stays the same.'].filter(Boolean).join('\n'),
      due_at: firstAhead([nightBefore(date), hourBefore, start], now),
    }
  }
  return {
    student_id: change.student_id,
    title: `Extra lesson: ${nick}, ${when(date, time)}`,
    notes: [note && `Note: ${note}`, 'One-off lesson.'].filter(Boolean).join('\n'),
    due_at: firstAhead([nightBefore(date), hourBefore, start], now),
  }
}

/** "Due Tue, Sep 29 at 3:30 PM", or "" with no due date. */
export function fmtDue(dueAt: string | null): string {
  if (!dueAt) return ''
  const d = new Date(dueAt)
  return `${fmtDay(isoDate(d))} at ${fmtTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`
}

/** The one line that goes to Apple Reminders through the share sheet: it becomes the reminder's title. */
export function reminderShareText(r: Pick<Reminder, 'title' | 'notes'>): string {
  const reason = /^(?:Reason|Note): (.+)$/m.exec(r.notes)?.[1]
  return reason ? `${r.title} (${reason})` : r.title
}

/**
 * A Shortcuts link that runs the coach's "Add Lesson Reminder" shortcut with
 * the reminder as JSON, so it arrives in Apple Reminders with its due date.
 * The due date is spelled out ("September 29, 2026 at 3:30 PM"), which
 * Shortcuts' Get Dates action reads reliably.
 */
export function shortcutUrl(r: Pick<Reminder, 'title' | 'notes' | 'due_at'>, shortcutName: string): string {
  let due = ''
  if (r.due_at) {
    const d = new Date(r.due_at)
    const month = d.toLocaleDateString('en-US', { month: 'long' })
    due = `${month} ${d.getDate()}, ${d.getFullYear()} at ${fmtTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`
  }
  const payload = JSON.stringify({ title: r.title, notes: r.notes, due })
  return `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}&input=text&text=${encodeURIComponent(payload)}`
}

const SHORTCUT_KEY = 'reminders-shortcut'
export const DEFAULT_SHORTCUT_NAME = 'Add Lesson Reminder'

/** The shortcut the coach built for due dates, or "" to use the share sheet. Per device. */
export function loadShortcutName(): string {
  try {
    return localStorage.getItem(SHORTCUT_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveShortcutName(name: string) {
  try {
    if (name.trim()) localStorage.setItem(SHORTCUT_KEY, name.trim())
    else localStorage.removeItem(SHORTCUT_KEY)
  } catch {
    // Private browsing: the share sheet still works.
  }
}

export type TravelMode = 'transit' | 'walking' | 'driving'

/**
 * Directions from wherever the device is to the address, opening straight
 * onto the route and its ETA: Apple Maps (the Maps app on an iPad or
 * iPhone) or Google Maps.
 */
export function directionsUrl(address: string, mode: TravelMode, provider: 'apple' | 'google' = 'apple'): string {
  const to = encodeURIComponent(address.trim())
  if (provider === 'google') return `https://www.google.com/maps/dir/?api=1&destination=${to}&travelmode=${mode}`
  const flag = mode === 'transit' ? 'r' : mode === 'walking' ? 'w' : 'd'
  return `https://maps.apple.com/?daddr=${to}&dirflg=${flag}`
}

/** Apple Maps for an address; opens the Maps app on an iPad or iPhone. */
export function mapsUrl(address: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(address.trim())}`
}

/**
 * When the lesson a schedule reminder is about ends, as a timestamp: the
 * new day and time for a move or an extra, the regular time for a
 * cancellation. Null when the reminder isn't tied to a lesson.
 */
export function reminderLessonEnd(reminder: Reminder, changes: ScheduleChange[], slots: ScheduleSlot[]): number | null {
  const change = reminder.change_id ? changes.find((c) => c.id === reminder.change_id) : undefined
  if (!change) return null
  const slot = change.slot_id ? slots.find((x) => x.id === change.slot_id) : undefined
  const date = change.kind === 'cancelled' ? change.original_date : change.new_date
  const time = change.kind === 'cancelled' ? slot?.start_time : (change.new_time ?? slot?.start_time)
  const minutes = (change.kind === 'cancelled' ? null : change.duration_min) ?? slot?.duration_min ?? 60
  if (!date || !time) return null
  return localDateTime(date, time).getTime() + minutes * 60000
}
