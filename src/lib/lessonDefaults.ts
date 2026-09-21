import type { LessonHistory } from '../types/domain'

/**
 * Built-in options shown after the coach's own history, so a first lesson
 * still starts with a tap. History always wins the top of the list.
 */
export const BUILTIN_SECTIONS = [
  'Defend and Protect',
  'Detect the Weakness',
  'Can I Take It?',
  'Back Rank',
  'Checkmate Patterns',
  'Endgame Technique',
  'Opening Review',
  'Game Review',
]

export const BUILTIN_AGENDA = [
  'Review last homework',
  'Warm-up puzzles',
  'Game review',
  'New theme',
  'Play it out',
  'Assign homework',
]

export function sectionOptions(history: LessonHistory | undefined): string[] {
  return merge(history?.sections ?? [], BUILTIN_SECTIONS)
}

export function agendaOptions(history: LessonHistory | undefined): string[] {
  return merge(history?.agenda ?? [], BUILTIN_AGENDA)
}

export function themeOptions(history: LessonHistory | undefined): string[] {
  return history?.themes ?? []
}

function merge(first: string[], then: string[]): string[] {
  const seen = new Set(first.map((v) => v.toLowerCase()))
  return [...first, ...then.filter((v) => !seen.has(v.toLowerCase()))]
}
