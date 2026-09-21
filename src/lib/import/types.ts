import type { BoardArrow, BoardHighlight, PuzzleSource, SolutionMove } from '../../types/domain'

/** What every importer produces: enough to fill a puzzle in one shot. */
export interface ImportedPosition {
  fen: string
  side: 'w' | 'b'
  solution: SolutionMove[]
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
  label: string
  quizPrompt?: string
  summary?: string
  referenceUrl?: string
  referenceLabel?: string
  source: PuzzleSource
  themes?: string[]
}

/** One move of an imported game, with anything the source annotated on it. */
export interface ImportedMove {
  ply: number
  san: string
  /** Position after the move. */
  fen: string
  /** Position before the move. */
  fenBefore: string
  comment?: string
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
}

export interface ImportedGame {
  headers: Record<string, string>
  startFen: string
  /** Annotations attached to the starting position itself (a study's first comment). */
  startArrows: BoardArrow[]
  startHighlights: BoardHighlight[]
  startComment?: string
  moves: ImportedMove[]
  referenceUrl?: string
  referenceLabel?: string
  source: PuzzleSource
}

export type DetectedInput =
  | { kind: 'lichess_puzzle'; id: string; url: string }
  | { kind: 'lichess_study'; studyId: string; chapterId?: string; url: string }
  | { kind: 'lichess_game'; id: string; url: string }
  | { kind: 'chesscom_game'; url: string; id: string }
  | { kind: 'fen'; fen: string }
  | { kind: 'pgn'; pgn: string }
  | { kind: 'unknown' }
