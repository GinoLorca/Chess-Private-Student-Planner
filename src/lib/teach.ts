import type { LessonSection, Puzzle, Student } from '../types/domain'
import * as api from './data'
import type { PuzzlePatch } from './data'

// ---------------------------------------------------------------------------
// Teach: lessons for anyone, built from the students' positions. A position
// sent there is a copy with the student taken out: its wording talks about
// the position only (White, Black, the pieces and moves, never a person),
// links to the student's own games stay behind, and its red/yellow/green dot
// starts over. The student's original is never touched.
// ---------------------------------------------------------------------------

export const isTeach = (s: Pick<Student, 'kind'> | null | undefined) => s?.kind === 'teach'

/** One piece of a position's wording, as the review shows it. */
export interface TeachText {
  /** 'label', 'quiz_prompt', 'summary', 'coach_notes' or 'comment:<ply index>'. */
  key: string
  /** What the coach calls it. */
  label: string
  text: string
}

/** Every piece of wording a position carries. */
export function teachTexts(p: Puzzle): TeachText[] {
  const out: TeachText[] = [
    { key: 'label', label: 'Label', text: p.label },
    { key: 'quiz_prompt', label: 'Question', text: p.quiz_prompt },
    { key: 'summary', label: 'Explanation', text: p.summary },
    { key: 'coach_notes', label: 'My notes', text: p.coach_notes ?? '' },
  ]
  p.solution.forEach((m, i) => {
    if (m.comment) out.push({ key: `comment:${i}`, label: `Note on ${m.san}`, text: m.comment })
  })
  return out.filter((t) => t.text.trim())
}

/** The words of a student's name worth looking for: 'Joseph "Jojo" Liu' gives Joseph, Jojo and Liu. */
export function personNames(name: string): string[] {
  const words = name
    .split(/[\s"“”'‘’()[\],.]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
  return [...new Set(words)]
}

// Words that point at a person rather than at the position. "I" and "us" are
// matched as written (so "US Open" isn't); the rest whatever their case.
const PERSON_WORDS = [
  'you', 'your', 'yours', 'yourself', "you're", "you've", "you'll", "you'd",
  'he', "he's", 'him', 'his', 'himself', 'she', "she's", 'her', 'hers', 'herself',
  'me', 'my', 'mine', 'myself', 'we', 'our', 'ours', 'ourselves',
  'student', "student's", 'students', 'opponent', "opponent's", 'opponents',
]
const EXACT_WORDS = ['I', "I'm", "I've", "I'd", "I'll", 'us', 'Us']

export interface Mention {
  start: number
  end: number
  word: string
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Straight and curly apostrophes alike.
const apos = (s: string) => escape(s).replace(/'/g, "['’]")

/** Every word in the text that points at a person: the student's names, pronouns, "student", "opponent". */
export function findPersonMentions(text: string, names: string[]): Mention[] {
  const out: Mention[] = []
  const scan = (re: RegExp) => {
    for (const m of text.matchAll(re)) out.push({ start: m.index!, end: m.index! + m[0].length, word: m[0] })
  }
  const loose = [...PERSON_WORDS, ...names.flatMap((n) => [n, `${n}'s`])]
  // Longest first, so "your" wins over "you" and "Jojo's" over "Jojo".
  const alt = (words: string[]) => [...words].sort((a, b) => b.length - a.length).map(apos).join('|')
  scan(new RegExp(`(?<![\\w'’])(?:${alt(loose)})(?![\\w'’])`, 'gi'))
  scan(new RegExp(`(?<![\\w'’])(?:${alt(EXACT_WORDS)})(?![\\w'’])`, 'g'))
  out.sort((a, b) => a.start - b.start)
  // Overlaps (a name that is also a pronoun): keep the first, longest.
  return out.filter((m, i) => i === 0 || m.start >= out[i - 1].end)
}

// Verbs that take an s once "you" becomes White or Black: "you play" -> "White plays".
const VERBS = new Map(
  ['play', 'need', 'want', 'get', 'see', 'take', 'win', 'lose', 'move', 'think', 'find', 'keep', 'give', 'trade', 'threaten',
    'attack', 'defend', 'capture', 'castle', 'sacrifice', 'force', 'mate', 'make', 'spot', 'notice', 'look', 'start', 'end',
    'answer', 'respond', 'reply', 'continue', 'drop', 'hang', 'blunder', 'grab', 'calculate', 'try', 'run', 'stop'].map((v) => [v, v.endsWith('y') && !/[aeiou]y$/.test(v) ? `${v.slice(0, -1)}ies` : `${v}s`]),
)
;['go', 'miss', 'push', 'catch', 'fix', 'watch', 'match', 'reach'].forEach((v) => VERBS.set(v, `${v}es`))
VERBS.set('have', 'has')

/**
 * The same text about the position alone, worked out on this device: "you"
 * and the student become the side to move, he/she/opponent the other side.
 * Rougher than the AI's rewrite (it is the stand-in when that isn't
 * reachable), so the review always shows it before anything is saved.
 */
export function positionOnlyLocal(text: string, sideToMove: 'w' | 'b', names: string[]): string {
  const me = sideToMove === 'w' ? 'White' : 'Black'
  const other = sideToMove === 'w' ? 'Black' : 'White'
  // He and she are the student when the text names them ("Jojo missed it: he
  // played Qb3"), and otherwise the other player ("is it safe for him?").
  const named = names.some((n) => new RegExp(`\\b${escape(n)}\\b`, 'i').test(text))
  const them = named ? me : other
  let s = text
  const rule = (re: RegExp, to: string | ((...m: string[]) => string)) => {
    s = s.replace(re, to as (substring: string, ...args: string[]) => string)
  }
  const cap = (w: string, like: string) => (like[0] === like[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w)
  const A = "['’]"
  // A whole name ("Joseph Liu", "Jojo") is one mention of the solver.
  if (names.length) {
    const n = [...names].sort((a, b) => b.length - a.length).map(escape).join('|')
    rule(new RegExp(`\\b(?:${n})(?:\\s+(?:${n}))*${A}s\\b`, 'gi'), `${me}'s`)
    rule(new RegExp(`\\b(?:${n})(?:\\s+(?:${n}))*\\b`, 'gi'), me)
  }
  rule(/\b(the|your|his|her|their)\s+opponent's\b/gi, `${other}'s`)
  rule(/\b(the|your|his|her|their)\s+opponent\b/gi, other)
  rule(/\bopponent's\b/gi, `${other}'s`)
  rule(/\bopponent\b/gi, other)
  rule(/\bthe\s+student's\b/gi, `${me}'s`)
  rule(/\bthe\s+student\b/gi, me)
  // Questions: "What do you play?" -> "What does White play?"
  rule(/\b(do|does)\s+you\b/gi, (_m, aux) => `${cap('does', aux)} ${me}`)
  rule(/\b(are)\s+you\b/gi, (_m, aux) => `${cap('is', aux)} ${me}`)
  rule(/\b(have)\s+you\b/gi, (_m, aux) => `${cap('has', aux)} ${me}`)
  rule(/\b(can|could|would|should|will|must|might)\s+you\b/gi, (_m, aux) => `${aux} ${me}`)
  rule(new RegExp(`\\byou${A}re\\b|\\byou\\s+are\\b`, 'gi'), `${me} is`)
  rule(new RegExp(`\\byou${A}ve\\b|\\byou\\s+have\\b`, 'gi'), `${me} has`)
  rule(new RegExp(`\\byou${A}ll\\b`, 'gi'), `${me} will`)
  rule(new RegExp(`\\byou${A}d\\b`, 'gi'), `${me} would`)
  rule(/\byou\s+([a-z]+)\b/gi, (m, verb) => (VERBS.has(verb.toLowerCase()) ? `${me} ${VERBS.get(verb.toLowerCase())}` : m))
  rule(/\byours\b/gi, `${me}'s`)
  rule(/\byour\b/gi, `${me}'s`)
  rule(/\byourself\b/gi, me)
  rule(/\byou\b/gi, me)
  rule(/\bour\b/gi, `${me}'s`)
  rule(/\bwe\b/gi, me)
  rule(/\bus\b/g, me)
  rule(new RegExp(`\\b(he|she)${A}s\\b`, 'gi'), `${them} is`)
  rule(/\b(he|she)\b/gi, them)
  rule(/\b(him|himself|herself)\b/gi, them)
  rule(/\b(his|hers)\b/gi, `${them}'s`)
  // "her bishop" is hers; "attack her" is her.
  rule(/\bher(?=\s+[a-z])/gi, `${them}'s`)
  rule(/\bher\b/gi, them)
  rule(/\bstudents?\b/gi, me)
  return s
}

/** A title or theme with the student's name taken out: "Jojo's endgames" -> "Endgames". */
export function withoutNames(text: string, names: string[]): string {
  if (!names.length || !text) return text
  const n = [...names].sort((a, b) => b.length - a.length).map(escape).join('|')
  const out = text
    .replace(new RegExp(`\\b(?:${n})(?:\\s+(?:${n}))*(?:['’]s)?\\b`, 'gi'), '')
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—:·,|]+|[\s\-–—:·,|]+$/g, '')
    .trim()
  return out ? out[0].toUpperCase() + out.slice(1) : out
}

// ---------------------------------------------------------------------------
// The copy
// ---------------------------------------------------------------------------

/** A link to one of the student's own games (a Lichess or Chess.com game), not a course or puzzle. */
export function isOwnGameLink(url: string | null | undefined): boolean {
  if (!url) return false
  if (/chess\.com\/(game|live|daily|analysis\/game)\//i.test(url)) return true
  const m = /lichess\.org\/([A-Za-z0-9]{8,12})(?:[/#?]|$)/i.exec(url)
  return Boolean(m && !/^(training|study|practice|analysis|editor|broadcast|tournament|swiss)$/i.test(m[1]))
}

/** The copy that goes to Teach: the position, its answer and wording (as reviewed), less the student. */
export function teachPatch(p: Puzzle, texts: Record<string, string>): PuzzlePatch {
  const ownGame = p.source?.kind === 'lichess_game' || p.source?.kind === 'chesscom_game' || isOwnGameLink(p.reference_url) || isOwnGameLink(p.source?.url)
  const text = (key: string, fallback: string) => texts[key] ?? fallback
  return {
    label: text('label', p.label),
    starting_fen: p.starting_fen,
    side_to_move: p.side_to_move,
    arrows: p.arrows,
    highlights: p.highlights,
    quiz_prompt: text('quiz_prompt', p.quiz_prompt),
    summary: text('summary', p.summary),
    solution: p.solution.map((m, i) => (m.comment ? { ...m, comment: text(`comment:${i}`, m.comment) } : m)),
    reference_url: ownGame ? null : p.reference_url,
    reference_label: ownGame ? null : p.reference_label,
    source: ownGame ? null : (p.source ?? null),
    ...(p.themes ? { themes: p.themes } : {}),
    ...(p.done !== undefined ? { done: p.done } : {}),
    // Columns later migrations add are only sent when the database has them.
    ...(p.status ? { status: 'planned' as const } : {}),
    ...(p.coach_notes !== undefined ? { coach_notes: text('coach_notes', p.coach_notes) } : {}),
  }
}

/**
 * Where a sent position lands: a lesson in one of the Teach folders (the
 * first one, "Teach", is made when there are none), and a section of it.
 * The lesson and the section may each be new.
 */
export interface TeachDestination {
  /** A Teach folder's id; none: the first Teach folder, made if need be. */
  folderId?: string
  lesson: { id: string } | { title: string; theme?: string }
  section: { id: string } | { title: string }
}

export interface TeachResult {
  folderId: string
  lessonId: string
  sectionId: string
}

async function folderFor(folderId?: string): Promise<string> {
  return folderId ?? (await api.ensureTeachFolder()).id
}

/** Positions into a Teach lesson, in order, after the ones already there. */
export async function sendPositionsToTeach(to: TeachDestination, patches: PuzzlePatch[]): Promise<TeachResult> {
  const folderId = await folderFor(to.folderId)
  let lessonId: string
  let sectionId: string
  if ('id' in to.lesson) {
    lessonId = to.lesson.id
    sectionId = 'id' in to.section ? to.section.id : (await api.createSection(lessonId, to.section.title)).id
  } else {
    const title = 'title' in to.section ? to.section.title : 'Positions'
    const plan = await api.createLessonPlan(folderId, { title: to.lesson.title, theme: to.lesson.theme ?? '', sections: [title] })
    lessonId = plan.id
    sectionId = ((await api.listSections(plan.id)) as LessonSection[])[0].id
  }
  for (const patch of patches) await api.createPuzzle(sectionId, patch)
  return { folderId, lessonId, sectionId }
}

/** A whole lesson into a Teach folder as a new lesson: its sections and positions, its wording reviewed. */
export async function sendLessonToTeach(
  folderId: string | undefined,
  lesson: { title: string; theme: string },
  sections: { title: string; patches: PuzzlePatch[] }[],
): Promise<TeachResult> {
  const folder = await folderFor(folderId)
  const plan = await api.createLessonPlan(folder, { title: lesson.title, theme: lesson.theme, sections: sections.map((s) => s.title) })
  const created = ((await api.listSections(plan.id)) as LessonSection[]).sort((a, b) => a.sort_order - b.sort_order)
  for (const [i, section] of sections.entries()) {
    for (const patch of section.patches) await api.createPuzzle(created[i].id, patch)
  }
  return { folderId: folder, lessonId: plan.id, sectionId: created[0]?.id ?? '' }
}

// Where the last position went, so a run of them lands together.
const LAST_KEY = 'teach-last'
export interface LastTeach {
  folderId: string
  lessonId: string
  sectionId: string
}
export function lastTeachDestination(): LastTeach | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as Partial<LastTeach> | null
    return v && typeof v.folderId === 'string' && typeof v.lessonId === 'string' && typeof v.sectionId === 'string'
      ? { folderId: v.folderId, lessonId: v.lessonId, sectionId: v.sectionId }
      : null
  } catch {
    return null
  }
}
export function rememberTeachDestination(last: LastTeach) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(last))
  } catch {
    // a convenience only
  }
}
