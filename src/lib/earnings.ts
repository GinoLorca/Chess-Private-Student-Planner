import { useSyncExternalStore } from 'react'
import type { ScheduleChange, ScheduleSlot } from '../types/domain'
import { addDays, isOn, localDateTime, weekOccurrences, weekStart, type Occurrence } from './schedule'

/**
 * What the lessons come to: each lesson's fee is its student's hourly rate
 * times its length. A cancelled lesson earns nothing (it's counted apart,
 * as what it would have been); a moved one counts on the day it happens.
 */

/** "$1,240" for whole dollars, "$67.50" otherwise. */
export function fmtMoney(n: number): string {
  const cents = Math.round(n * 100) % 100 !== 0
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })
}

/** "$60/h". */
export function fmtRate(rate: number): string {
  return `${fmtMoney(rate)}/h`
}

/** "5 h 15 min", "45 min". */
export function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** One lesson's fee, or null when the student has no rate yet. */
export function lessonFee(o: Pick<Occurrence, 'duration'>, rate: number | null | undefined): number | null {
  return rate == null ? null : round2((rate * o.duration) / 60)
}

/**
 * The name a lesson's payment is filed under: its regular slot and the date
 * it was due (unchanged by moving it), or the one-off's own change id.
 */
export function payKey(o: Occurrence): string | null {
  if (o.slot) return `${o.slot.id}:${o.change?.original_date ?? o.date}`
  if (o.change) return `extra:${o.change.id}`
  return null
}

/** Whether a lesson can be marked paid: it's on (not cancelled, not the gap a move left). */
export const payable = (o: Occurrence) => isOn(o) && payKey(o) !== null

/** When a lesson ends, as epoch ms. */
export const lessonEnd = (o: Occurrence) => localDateTime(o.date, o.time).getTime() + o.duration * 60000

/** The month a week belongs to: the one its Thursday falls in (so a week straddling two months goes to the one holding most of it). */
export function monthOfWeek(start: string): string {
  return addDays(start, 3).slice(0, 7)
}

/** "September", or "September 2027" outside the current year. */
export function fmtMonth(month: string, today: string): string {
  const [y, m] = month.split('-').map(Number)
  const name = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })
  return String(y) === today.slice(0, 4) ? name : `${name} ${y}`
}

/** Every lesson in a calendar month ("YYYY-MM"), with the changes applied. */
export function monthOccurrences(month: string, slots: ScheduleSlot[], changes: ScheduleChange[]): Occurrence[] {
  const first = `${month}-01`
  const out: Occurrence[] = []
  for (let w = weekStart(first); w.slice(0, 7) <= month; w = addDays(w, 7)) {
    for (const o of weekOccurrences(w, slots, changes)) if (o.date.startsWith(month)) out.push(o)
  }
  return out
}

export interface StudentShare {
  studentId: string
  lessons: number
  amount: number
}

export interface Tally {
  /** Lessons taking place. */
  lessons: number
  minutes: number
  /** What they come to, for the lessons with a rate. */
  total: number
  /** The part already taught (lessons that have ended). */
  earned: number
  /** Students with lessons here but no rate set. */
  unpriced: string[]
  /** Marked paid (at the amount recorded then). */
  paid: number
  /** Taught but not marked paid. */
  owed: number
  /** Who owes it, largest first. */
  owedBy: StudentShare[]
  /** Cancelled lessons and what they would have come to. */
  cancelled: { lessons: number; amount: number }
  /** Largest first. */
  byStudent: StudentShare[]
}

export function tally(
  list: Occurrence[],
  rates: Map<string, number | null | undefined>,
  now: Date,
  /** Paid lessons: key → amount recorded (null when there was no rate then). */
  payments: Map<string, number | null> = new Map(),
): Tally {
  const t: Tally = { lessons: 0, minutes: 0, total: 0, earned: 0, paid: 0, owed: 0, owedBy: [], unpriced: [], cancelled: { lessons: 0, amount: 0 }, byStudent: [] }
  const shares = new Map<string, StudentShare>()
  const owing = new Map<string, StudentShare>()
  const unpriced = new Set<string>()
  for (const o of list) {
    const fee = lessonFee(o, rates.get(o.studentId))
    if (o.state === 'cancelled') {
      t.cancelled.lessons++
      t.cancelled.amount += fee ?? 0
      continue
    }
    if (!isOn(o)) continue
    t.lessons++
    t.minutes += o.duration
    const key = payKey(o)
    const isPaid = key !== null && payments.has(key)
    if (isPaid) t.paid += payments.get(key!) ?? fee ?? 0
    if (fee == null) {
      unpriced.add(o.studentId)
      continue
    }
    t.total += fee
    if (lessonEnd(o) <= now.getTime()) {
      t.earned += fee
      if (!isPaid) {
        t.owed += fee
        const d = owing.get(o.studentId) ?? { studentId: o.studentId, lessons: 0, amount: 0 }
        d.lessons++
        d.amount += fee
        owing.set(o.studentId, d)
      }
    }
    const share = shares.get(o.studentId) ?? { studentId: o.studentId, lessons: 0, amount: 0 }
    share.lessons++
    share.amount += fee
    shares.set(o.studentId, share)
  }
  t.total = round2(t.total)
  t.earned = round2(t.earned)
  t.paid = round2(t.paid)
  t.owed = round2(t.owed)
  t.owedBy = [...owing.values()].map((d) => ({ ...d, amount: round2(d.amount) })).sort((a, b) => b.amount - a.amount)
  t.cancelled.amount = round2(t.cancelled.amount)
  t.unpriced = [...unpriced]
  t.byStudent = [...shares.values()].map((s) => ({ ...s, amount: round2(s.amount) })).sort((a, b) => b.amount - a.amount)
  return t
}

// ---------------------------------------------------------------------------
// Settings → Schedule: whether money shows at all. Per device, so the iPad
// that's shown to parents can keep it hidden.
// ---------------------------------------------------------------------------

const KEY = 'show-earnings'
const EVENT = 'show-earnings-change'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

export function setShowEarnings(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    // Private browsing: it holds for this visit only.
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Whether rates, fees and totals show on the Schedule. */
export function useShowEarnings(): boolean {
  return useSyncExternalStore(subscribe, read, () => true)
}
