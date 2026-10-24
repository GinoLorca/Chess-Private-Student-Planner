import type { LevelId, Puzzle, PuzzleLevel, PuzzleLevels } from '../types/domain'
import { parsePlacement } from './fen'

// ---------------------------------------------------------------------------
// De-Construct: a position taught in three steps. Beginner and Intermediate
// are the same idea with fewer pieces (made by taking pieces off, so what's
// left stands on the same squares at every level); Advanced is the position
// itself. They're kept on the position (puzzles.levels), so lessons don't
// fill up with copies and the levels travel with it (to Teach, recycled).
// ---------------------------------------------------------------------------

export type LevelKey = LevelId | 'advanced'

export const LEVELS: { key: LevelKey; name: string; blurb: string }[] = [
  { key: 'beginner', name: 'Beginner', blurb: 'The idea alone, with the fewest pieces' },
  { key: 'intermediate', name: 'Intermediate', blurb: 'Some of the pieces back: the same idea, more to see past' },
  { key: 'advanced', name: 'Advanced', blurb: 'The position itself' },
]

export const levelName = (key: LevelKey) => LEVELS.find((l) => l.key === key)?.name ?? key

export function hasLevels(p: Pick<Puzzle, 'levels'>): boolean {
  return Boolean(p.levels?.beginner || p.levels?.intermediate)
}

/** The id a level goes by on screen: the position's, with the level after a ~. Never saved. */
export const levelPuzzleId = (puzzleId: string, key: LevelId) => `${puzzleId}~${key}`
export const isLevelPuzzleId = (id: string) => id.includes('~')

/** A level as a position of its own, for the boards, editor and Present that show positions. */
export function levelPuzzle(p: Puzzle, key: LevelKey): Puzzle {
  if (key === 'advanced') return p
  const level = p.levels?.[key]
  if (!level) return p
  return {
    ...p,
    id: levelPuzzleId(p.id, key),
    starting_fen: level.starting_fen,
    side_to_move: level.side_to_move,
    label: level.label,
    quiz_prompt: level.quiz_prompt,
    summary: level.summary,
    solution: level.solution,
    arrows: level.arrows,
    highlights: level.highlights,
    coach_notes: undefined,
    levels: null,
  }
}

/** The run to teach: whichever easier versions it has, then the position itself. */
export function levelRun(p: Puzzle): { key: LevelKey; name: string; puzzle: Puzzle }[] {
  return LEVELS.filter((l) => l.key === 'advanced' || p.levels?.[l.key as LevelId]).map((l) => ({ key: l.key, name: l.name, puzzle: levelPuzzle(p, l.key) }))
}

/** What the editor's patches change on a level (the rest of a position's fields aren't a level's). */
export function levelFromPatch(level: PuzzleLevel, patch: Partial<PuzzleLevel> & Record<string, unknown>): PuzzleLevel {
  const keys = ['starting_fen', 'side_to_move', 'label', 'quiz_prompt', 'summary', 'solution', 'arrows', 'highlights'] as const
  const next = { ...level }
  for (const k of keys) if (patch[k] !== undefined) (next as Record<string, unknown>)[k] = patch[k]
  return { ...next, made: { ...level.made, by: 'coach' } }
}

export function withLevel(levels: PuzzleLevels | null | undefined, key: LevelId, level: PuzzleLevel | null): PuzzleLevels | null {
  const next: PuzzleLevels = { ...(levels ?? {}) }
  if (level) next[key] = level
  else delete next[key]
  return next.beginner || next.intermediate ? next : null
}

export function pieceCount(fen: string): number {
  return Object.keys(parsePlacement(fen)).length
}

/** Squares holding the same piece in both positions: the core a harder level shares with an easier one. */
export function sharedSquares(a: string, b: string): string[] {
  const pa = parsePlacement(a)
  const pb = parsePlacement(b)
  return Object.keys(pb).filter((sq) => pa[sq] === pb[sq])
}

/** Squares whose piece wasn't there one level down: what a level adds. */
export function addedSquares(easier: string, harder: string): string[] {
  const pa = parsePlacement(easier)
  const pb = parsePlacement(harder)
  return Object.keys(pb).filter((sq) => pa[sq] !== pb[sq])
}
