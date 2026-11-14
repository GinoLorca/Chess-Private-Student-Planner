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
 *   "from": "<ISO time: lessons marked paid before it are not listed (the reader keeps what it had)>",
 *   "owner": "<a hash of the coach's account id: the file is never written for anyone else>",
 *   "payers": [{ "id": "<student id>", "name": "Sam" }],
 *   "items": [{ "id": "<payment id>", "payer": "<student id>", "cents": 6000, "day": "2026-11-13", "at": "<ISO time marked paid>" }]
 * }
 */

export const FORMAT = 'income/1'
/** The file lists the lessons marked paid in this many days before it was written. */
export const KEEP_DAYS = 400
/** The reader's limits; the file is kept inside them by moving `from` later. */
export const MAX_ITEMS = 5000
export const MAX_PAYERS = 500
/** The reader refuses a file over 1,000,000 bytes; this leaves a margin. */
export const MAX_BYTES = 900_000
/** The largest fee the reader takes, in cents ($1,000,000.00). */
export const MAX_CENTS = 100_000_000
const ID = /^[A-Za-z0-9_.:-]{1,80}$/
const WHAT = 'Lesson'
const NAME_MAX = 60
const DAY_MS = 86_400_000

/** A calendar date that exists: '2026-02-30' does not. */
function isRealDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s))
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

/** The file as it is written: compact, one line. */
export function serialize(doc) {
  return `${JSON.stringify(doc)}\n`
}

/** 'Joseph "Jo" Smith' → 'Jo'; 'Sam Smith' → 'Sam'. Never ends in half of an emoji. */
export function firstName(name) {
  const text = String(name ?? '').trim()
  const quoted = /["“”]([^"“”]{1,40})["“”]/.exec(text)?.[1]?.trim()
  const first = quoted || text.split(/\s+/)[0] || 'Student'
  return first.slice(0, NAME_MAX).replace(/[\ud800-\udbff]$/, '') || 'Student'
}

/** Who may write the file: a one-way stand-in for the coach's account id. */
export function ownerOf(userId) {
  return createHash('sha256').update(`paid-export:${userId}`).digest('hex').slice(0, 32)
}

/** The floor for a file written at `nowMs`: midnight UTC, KEEP_DAYS before. */
export function floorFor(nowMs) {
  const d = new Date(nowMs - KEEP_DAYS * DAY_MS)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * @param {{ id: string, student_id: string, lesson_date: string, amount: number|string|null, created_at: string }[]} payments
 * @param {{ id: string, name: string }[]} students
 * @param {string} owner
 * @param {string} writtenAt
 * @param {string} from  lessons marked before this are left out
 */
export function paidDoc(payments, students, owner, writtenAt, from) {
  const names = new Map(students.map((s) => [s.id, firstName(s.name)]))
  let items = []
  for (const p of payments) {
    const cents = Math.round(Number(p.amount) * 100)
    const at = new Date(p.created_at)
    // only what the reader can take: anything else is left out rather than spoil the whole file
    if (p.amount == null || !Number.isFinite(cents) || cents < 1 || cents > MAX_CENTS || !names.has(p.student_id)) continue
    if (!ID.test(String(p.id)) || !ID.test(String(p.student_id))) continue
    if (!isRealDate(p.lesson_date) || Number.isNaN(at.getTime())) continue
    const iso = at.toISOString()
    if (iso < from) continue
    items.push({ id: p.id, payer: p.student_id, cents, day: p.lesson_date, at: iso })
  }
  items.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1))
  // Inside the reader's limits: the oldest lessons go first, and the floor moves up to the oldest kept.
  let floor = from
  const payersOf = (list) => new Set(list.map((i) => i.payer))
  const build = () => ({
    format: FORMAT,
    what: WHAT,
    writtenAt,
    from: floor,
    owner,
    payers: [...payersOf(items)].sort().map((id) => ({ id, name: names.get(id) })),
    items,
  })
  const cutTo = (cut) => {
    // never split lessons marked at the same instant: all of them stay, or all go with the cut
    while (cut < items.length && items[cut].at === items[cut - 1].at) cut++
    items = items.slice(cut)
    floor = items.length ? items[0].at : writtenAt
  }
  while (items.length > MAX_ITEMS || payersOf(items).size > MAX_PAYERS) cutTo(Math.max(1, items.length - MAX_ITEMS))
  let doc = build()
  while (items.length && Buffer.byteLength(serialize(doc), 'utf8') > MAX_BYTES) {
    cutTo(Math.max(1, Math.ceil(items.length / 20)))
    doc = build()
  }
  return doc
}

/**
 * Whether two files say the same thing, the time each was written and the floor aside: with the same
 * lessons listed, an older floor is still true (nothing between the two floors exists to list), so
 * the file is not written again only because a day passed.
 */
export function sameDoc(a, b) {
  const strip = (d) => JSON.stringify({ format: d?.format, what: d?.what, owner: d?.owner, payers: d?.payers, items: d?.items })
  return strip(a) === strip(b)
}
