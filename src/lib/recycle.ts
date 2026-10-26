import type { LessonSection, Puzzle } from '../types/domain'
import * as api from './data'
import type { PuzzlePatch } from './data'
import { findPersonMentions, personNames, teachTexts } from './teach'

// ---------------------------------------------------------------------------
// Recycle one position: a copy of it in another lesson, of this folder,
// another student's or (from Teach) another Teach folder. Everything comes
// along as it is (answer, comments, each move's marks, arrows, explanation,
// levels, source); only its red/yellow/green dot starts over. The original
// stays where it is. A whole lesson is recycled from the lesson's own menu.
// ---------------------------------------------------------------------------

/** Where a recycled position lands: a folder, one of its lessons (or a new one), and a section of it. */
export interface RecycleDestination {
  studentId: string
  lesson: { id: string; number: number } | { new: true }
  section: { id: string; title: string } | { title: string }
}

export interface RecycleResult {
  studentId: string
  lessonId: string
  lessonNumber: number
  sectionId: string
  puzzle: Puzzle
}

/** The copy: the position as it is, its dot back to "not given yet". */
export function recyclePatch(p: Puzzle): PuzzlePatch {
  return {
    label: p.label,
    starting_fen: p.starting_fen,
    side_to_move: p.side_to_move,
    arrows: p.arrows,
    highlights: p.highlights,
    quiz_prompt: p.quiz_prompt,
    summary: p.summary,
    solution: p.solution,
    reference_url: p.reference_url,
    reference_label: p.reference_label,
    source: p.source ?? null,
    ...(p.themes ? { themes: p.themes } : {}),
    ...(p.done !== undefined ? { done: p.done } : {}),
    // Columns later migrations add are only sent when the database has them.
    ...(p.status ? { status: 'planned' as const } : {}),
    ...(p.coach_notes !== undefined ? { coach_notes: p.coach_notes } : {}),
    ...(p.levels ? { levels: p.levels } : {}),
  }
}

export async function recyclePosition(p: Puzzle, to: RecycleDestination): Promise<RecycleResult> {
  let lessonId: string
  let lessonNumber: number
  let sectionId: string
  if ('id' in to.lesson) {
    lessonId = to.lesson.id
    lessonNumber = to.lesson.number
    sectionId = 'id' in to.section ? to.section.id : (await api.createSection(lessonId, to.section.title)).id
  } else {
    const plan = await api.createLessonPlan(to.studentId, { sections: [to.section.title || 'Positions'] })
    lessonId = plan.id
    lessonNumber = plan.number
    sectionId = ((await api.listSections(plan.id)) as LessonSection[])[0].id
  }
  const puzzle = await api.createPuzzle(sectionId, recyclePatch(p))
  return { studentId: to.studentId, lessonId, lessonNumber, sectionId, puzzle }
}

/** The words in a position that name the student it came from ("Jojo", "Liu"), to check before it's taught to someone else. */
export function namesMentioned(p: Puzzle, studentName: string): string[] {
  const names = personNames(studentName)
  const found = teachTexts(p).flatMap((t) => findPersonMentions(t.text, names).map((m) => m.word))
  return [...new Set(found)]
}

// Where the last one went, so a run of positions goes in one tap each ("Again").
const LAST_KEY = 'recycle-last'
export interface LastRecycle {
  studentId: string
  lessonId: string
  sectionId: string
}
export function lastRecycleDestination(): LastRecycle | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null') as Partial<LastRecycle> | null
    return v && typeof v.studentId === 'string' && typeof v.lessonId === 'string' && typeof v.sectionId === 'string'
      ? { studentId: v.studentId, lessonId: v.lessonId, sectionId: v.sectionId }
      : null
  } catch {
    return null
  }
}
export function rememberRecycleDestination(last: LastRecycle) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(last))
  } catch {
    // a convenience only
  }
}
