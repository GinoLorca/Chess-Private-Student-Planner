import { createHash } from 'node:crypto'

/**
 * The paid lessons, as a small JSON file another app of the coach's can read (api/paid-export.js
 * writes it). Only what that app needs: per paid lesson, when it was marked paid, the fee recorded
 * then and the lesson's date, and per student the first name (the nickname, when the name has one in
 * quotes). Never an address, a code, a note or a full name.
 *
 * {
 *   "format": "income/1",
 *   "what": "Lesson",
 *   "writtenAt": "<ISO time>",
 *   "owner": "<a hash of the coach's account id: the file is never written for anyone else>",
 *   "payers": [{ "id": "<student id>", "name": "Sam" }],
 *   "items": [{ "id": "<payment id>", "payer": "<student id>", "cents": 6000, "day": "2026-11-13", "at": "<ISO time marked paid>" }]
 * }
 */

export const FORMAT = 'income/1'
const WHAT = 'Lesson'
const NAME_MAX = 60

/** 'Joseph "Jo" Smith' → 'Jo'; 'Sam Smith' → 'Sam'. */
export function firstName(name) {
  const text = String(name ?? '').trim()
  const quoted = /["“”]([^"“”]{1,40})["“”]/.exec(text)?.[1]?.trim()
  const first = quoted || text.split(/\s+/)[0] || 'Student'
  return first.slice(0, NAME_MAX)
}

/** Who may write the file: a one-way stand-in for the coach's account id. */
export function ownerOf(userId) {
  return createHash('sha256').update(`paid-export:${userId}`).digest('hex').slice(0, 32)
}

/**
 * @param {{ id: string, student_id: string, lesson_date: string, amount: number|string|null, created_at: string }[]} payments
 * @param {{ id: string, name: string }[]} students
 * @param {string} owner
 * @param {string} writtenAt
 */
export function paidDoc(payments, students, owner, writtenAt) {
  const names = new Map(students.map((s) => [s.id, firstName(s.name)]))
  const items = []
  for (const p of payments) {
    const cents = Math.round(Number(p.amount) * 100)
    const at = new Date(p.created_at)
    if (p.amount == null || !Number.isFinite(cents) || cents < 1 || !names.has(p.student_id)) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.lesson_date)) || Number.isNaN(at.getTime())) continue
    items.push({ id: p.id, payer: p.student_id, cents, day: p.lesson_date, at: at.toISOString() })
  }
  items.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1))
  const used = new Set(items.map((i) => i.payer))
  const payers = [...used].sort().map((id) => ({ id, name: names.get(id) }))
  return { format: FORMAT, what: WHAT, writtenAt, owner, payers, items }
}

/** Whether two files say the same thing (the time each was written aside). */
export function sameDoc(a, b) {
  const strip = (d) => JSON.stringify({ format: d?.format, what: d?.what, owner: d?.owner, payers: d?.payers, items: d?.items })
  return strip(a) === strip(b)
}
