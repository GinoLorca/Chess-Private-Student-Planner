import type { MoveGlyph, SolutionMove } from '../types/domain'

/**
 * The move symbols, in Lichess Study's order and colours, with the PGN NAG
 * each one is ($1 = !, $3 = !!), so a study's symbols come in with it.
 */
export const GLYPHS: { glyph: MoveGlyph; name: string; color: string; nag: number }[] = [
  { glyph: '!!', name: 'Brilliant move', color: '#168226', nag: 3 },
  { glyph: '!', name: 'Good move', color: '#22ac38', nag: 1 },
  { glyph: '!?', name: 'Interesting move', color: '#ea45d8', nag: 5 },
  { glyph: '?!', name: 'Dubious move', color: '#56b4e9', nag: 6 },
  { glyph: '?', name: 'Mistake', color: '#e69f00', nag: 2 },
  { glyph: '??', name: 'Blunder', color: '#df5353', nag: 4 },
]

export const isGlyph = (v: unknown): v is MoveGlyph => GLYPHS.some((g) => g.glyph === v)

export const glyphInfo = (glyph: MoveGlyph) => GLYPHS.find((g) => g.glyph === glyph)!

/** The symbol a PGN NAG ("$3", or 3) stands for, if it's one of the six. */
export const glyphOfNag = (nag: string | number) => GLYPHS.find((g) => g.nag === Number(String(nag).replace('$', '')))?.glyph

/** "f5" with its symbol: "f5!!". */
export const sanWithGlyph = (move: Pick<SolutionMove, 'san' | 'glyph'>) => move.san + (move.glyph ?? '')

/** A move's own marks, and its symbol, empty when it has none. */
export const marksOf = (move: SolutionMove | undefined) => ({ arrows: move?.arrows ?? [], highlights: move?.highlights ?? [] })

/** The move with the given marks, the empty lists left off so a move without marks stays as it was. */
export function withMarks(move: SolutionMove, marks: Partial<Pick<SolutionMove, 'arrows' | 'highlights' | 'glyph'>>): SolutionMove {
  const next: SolutionMove = { ...move, ...marks }
  if (!next.arrows?.length) delete next.arrows
  if (!next.highlights?.length) delete next.highlights
  if (!next.glyph) delete next.glyph
  return next
}

/** What a move carries besides its SAN and position: its comment, marks and symbol, to keep when the move is played again elsewhere. */
export function moveExtras(move: SolutionMove): Partial<SolutionMove> {
  return {
    ...(move.comment ? { comment: move.comment } : {}),
    ...(move.arrows?.length ? { arrows: move.arrows } : {}),
    ...(move.highlights?.length ? { highlights: move.highlights } : {}),
    ...(move.glyph ? { glyph: move.glyph } : {}),
  }
}
