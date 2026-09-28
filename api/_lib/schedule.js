/**
 * The schedule, as the agent needs it: which lessons fall on which days
 * (regular slots plus that week's cancellations, moves and one-offs), as
 * real moments in the coach's time zone, with the address and door codes.
 *
 * Mirrors src/lib/schedule.ts, which the app uses; the app stores dates as
 * "YYYY-MM-DD" and times as local wall-clock "HH:MM" with no zone, so the
 * zone comes from here: COACH_TIMEZONE on the server, or the caller's own.
 *
 * Plain JavaScript on purpose: Vercel runs it as-is, with nothing to compile.
 *
 * @typedef {{ id: string, student_id: string, weekday: number, start_time: string, duration_min: number }} Slot
 * @typedef {{ id: string, slot_id: string | null, student_id: string, kind: 'cancelled' | 'moved' | 'extra',
 *   original_date: string | null, new_date: string | null, new_time: string | null, duration_min: number | null, note: string }} Change
 * @typedef {{ student_id: string, address: string, door_code: string, bathroom_code: string, bathroom_note: string, notes: string }} Place
 * @typedef {{ id: string, name: string }} Student
 */

export const DEFAULT_TIMEZONE = 'America/New_York'

const pad = (/** @type {number} */ n) => String(n).padStart(2, '0')

/** @param {string} tz */
export function checkTimezone(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * The wall-clock parts of a moment in a zone.
 * @param {Date} d @param {string} tz
 */
function partsIn(d, tz) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second }
}

/** Minutes the zone is ahead of UTC at that moment (-240 for New York in summer). @param {Date} d @param {string} tz */
function offsetMinutes(d, tz) {
  const p = partsIn(d, tz)
  return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - d.getTime()) / 60000)
}

/**
 * The moment a local date and time happen in a zone.
 * @param {string} date "YYYY-MM-DD" @param {string} time "HH:MM" @param {string} tz
 */
export function zonedMoment(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const naive = Date.UTC(y, m - 1, d, h, mi)
  let t = naive - offsetMinutes(new Date(naive), tz) * 60000
  // Once more, in case the guess landed across a clock change.
  t = naive - offsetMinutes(new Date(t), tz) * 60000
  return new Date(t)
}

/** ISO 8601 with the zone's offset: "2026-09-29T17:30:00-04:00". @param {Date} d @param {string} tz */
export function isoInZone(d, tz) {
  const p = partsIn(d, tz)
  const off = offsetMinutes(d, tz)
  const sign = off < 0 ? '-' : '+'
  const a = Math.abs(off)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`
}

/** Today's date in the zone. @param {Date} now @param {string} tz */
export function todayIn(now, tz) {
  const p = partsIn(now, tz)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}

/** @param {string} date @param {number} n */
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** 0 = Sunday … 6 = Saturday. @param {string} date */
export function weekdayOf(date) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "16:30" → "4:30 PM". @param {string} time */
export function fmtTime(time) {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
}

/** "Tue, Sep 29". @param {string} date */
export function fmtDay(date) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
}

/** @param {string} time @param {number} n */
function addMinutes(time, n) {
  const [h, m] = time.split(':').map(Number)
  const t = (((h * 60 + m + n) % 1440) + 1440) % 1440
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`
}

/** A lesson's length in words: "1 h 25 min", "40 min". @param {number} min */
export function fmtMinutes(min) {
  const a = Math.abs(Math.round(min))
  if (a < 60) return `${a} min`
  if (a >= 24 * 60) {
    const d = Math.floor(a / 1440)
    const h = Math.floor((a % 1440) / 60)
    return `${d} ${d === 1 ? 'day' : 'days'}${h ? ` ${h} h` : ''}`
  }
  const h = Math.floor(a / 60)
  const m = a % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** @param {string} address */
export function mapsUrl(address) {
  return `https://maps.apple.com/?q=${encodeURIComponent(address.trim())}`
}

/** Directions from wherever the phone is to the address. @param {string} address */
export function directionsUrl(address) {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(address.trim())}`
}

/**
 * Every lesson from `from` to `to` (inclusive), in order: the regular ones,
 * the ones cancelled or moved away (so an agent knows not to go), and the
 * ones moved in or added.
 *
 * @param {{ from: string, to: string, tz: string, now: Date, slots: Slot[], changes: Change[], places: Place[], students: Student[] }} a
 */
export function lessonsBetween({ from, to, tz, now, slots, changes, places, students }) {
  const name = new Map(students.map((s) => [s.id, s.name]))
  const placeOf = new Map(places.map((p) => [p.student_id, p]))
  /** @type {any[]} */
  const out = []

  /**
   * @param {{ studentId: string, date: string, time: string, duration: number, status: string, slot: Slot | null, change: Change | null }} o
   */
  const push = (o) => {
    if (!name.has(o.studentId)) return
    const start = zonedMoment(o.date, o.time, tz)
    const end = new Date(start.getTime() + o.duration * 60000)
    const place = placeOf.get(o.studentId)
    const until = Math.round((start.getTime() - now.getTime()) / 60000)
    /** @type {string | null} */
    let change = null
    if (o.change?.kind === 'cancelled') change = 'cancelled this week'
    else if (o.status === 'moved_away' && o.change?.new_date)
      change = `moved to ${fmtDay(o.change.new_date)} at ${fmtTime(o.change.new_time ?? o.time)}, this week only`
    else if (o.change?.kind === 'moved' && o.change.original_date && o.slot)
      change = `moved here from ${fmtDay(o.change.original_date)} at ${fmtTime(o.slot.start_time)}, this week only`
    else if (o.change?.kind === 'extra') change = 'one-off lesson'
    out.push({
      student: name.get(o.studentId),
      student_id: o.studentId,
      status: o.status,
      date: o.date,
      weekday: WEEKDAY_NAMES[weekdayOf(o.date)],
      start: isoInZone(start, tz),
      end: isoInZone(end, tz),
      time: `${fmtTime(o.time)} – ${fmtTime(addMinutes(o.time, o.duration))}`,
      duration_min: o.duration,
      minutes_until_start: until,
      in_progress: o.status === 'on' && start <= now && now < end,
      change,
      reason: o.change?.note || null,
      place: place
        ? {
            address: place.address || null,
            maps_url: place.address ? mapsUrl(place.address) : null,
            directions_url: place.address ? directionsUrl(place.address) : null,
            door_code: place.door_code || null,
            bathroom_code: place.bathroom_code || null,
            bathroom: place.bathroom_note || null,
            notes: place.notes || null,
          }
        : null,
    })
  }

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const wd = weekdayOf(date)
    for (const slot of slots) {
      if (slot.weekday !== wd) continue
      const change = changes.find((c) => c.slot_id === slot.id && c.original_date === date && c.kind !== 'extra') ?? null
      push({
        studentId: slot.student_id,
        date,
        time: slot.start_time,
        duration: slot.duration_min,
        status: !change ? 'on' : change.kind === 'cancelled' ? 'cancelled' : 'moved_away',
        slot,
        change,
      })
    }
  }
  for (const change of changes) {
    if (change.kind === 'cancelled' || !change.new_date || change.new_date < from || change.new_date > to) continue
    const slot = change.slot_id ? (slots.find((s) => s.id === change.slot_id) ?? null) : null
    if (change.kind === 'moved' && !slot) continue
    push({
      studentId: change.student_id,
      date: change.new_date,
      time: change.new_time ?? slot?.start_time ?? '00:00',
      duration: change.duration_min ?? slot?.duration_min ?? 60,
      status: 'on',
      slot,
      change,
    })
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}

/**
 * When to set off: the lesson's start, less the travel time and a few
 * minutes to settle in. With no travel time given, only arrive_by is known.
 *
 * @param {any} lesson one of lessonsBetween's lessons
 * @param {{ now: Date, tz: string, travelMinutes?: number | null, bufferMinutes: number }} o
 */
export function departure(lesson, { now, tz, travelMinutes, bufferMinutes }) {
  const start = new Date(lesson.start).getTime()
  const arriveBy = new Date(start - bufferMinutes * 60000)
  /** @type {Record<string, unknown>} */
  const out = { arrive_by: isoInZone(arriveBy, tz), buffer_min: bufferMinutes }
  if (typeof travelMinutes === 'number' && travelMinutes >= 0) {
    const leaveBy = new Date(arriveBy.getTime() - travelMinutes * 60000)
    const untilLeave = Math.round((leaveBy.getTime() - now.getTime()) / 60000)
    out.travel_min = travelMinutes
    out.leave_by = isoInZone(leaveBy, tz)
    out.minutes_until_leave = untilLeave
    out.should_leave_now = untilLeave <= 0
  }
  return out
}

/**
 * One sentence an agent can say as-is.
 * @param {any} lesson @param {Record<string, any>} dep @param {string} today @param {any} [current] a lesson under way
 */
export function sayNext(lesson, dep, today, current = null) {
  const when = lesson.date === today ? 'today' : lesson.date === addDays(today, 1) ? 'tomorrow' : `on ${fmtDay(lesson.date)}`
  const starts = lesson.time.split(' – ')[0]
  const wait = lesson.in_progress
    ? 'in progress now'
    : lesson.minutes_until_start >= 0
      ? `in ${fmtMinutes(lesson.minutes_until_start)}`
      : `started ${fmtMinutes(lesson.minutes_until_start)} ago`
  const where = lesson.place?.address ? ` at ${lesson.place.address}` : ''
  const moved = lesson.change && lesson.status === 'on' ? ` (${lesson.change})` : ''
  let leave = ''
  if (typeof dep.minutes_until_leave === 'number') {
    leave = dep.should_leave_now
      ? dep.minutes_until_leave < -2
        ? ` Leave now: you're ${fmtMinutes(dep.minutes_until_leave)} behind.`
        : ' Time to leave now.'
      : ` Leave in ${fmtMinutes(dep.minutes_until_leave)}.`
  }
  const codes = [lesson.place?.door_code && `Door code ${lesson.place.door_code}.`, lesson.place?.bathroom_code && `Bathroom code ${lesson.place.bathroom_code}${lesson.place.bathroom ? ` (${lesson.place.bathroom})` : ''}.`]
    .filter(Boolean)
    .join(' ')
  const now = current ? `Teaching ${current.student} until ${current.time.split(' – ')[1]}. Next: ` : ''
  return `${now}${lesson.student}, ${when} at ${starts} (${wait})${where}${moved}.${leave}${codes ? ` ${codes}` : ''}`
}
