export type FolderKind = 'misc' | 'game_review' | 'invoices' | 'lesson_plan' | 'student_notes'

export const FOLDER_KINDS: { kind: FolderKind; label: string }[] = [
  { kind: 'lesson_plan', label: 'Lesson Plan' },
  { kind: 'invoices', label: 'Invoices' },
  { kind: 'game_review', label: 'Game Review' },
  { kind: 'student_notes', label: 'Student Notes' },
  { kind: 'misc', label: 'MISC' },
]

export interface Student {
  id: string
  user_id: string
  name: string
  color: string
  /** A school badge: a built-in /logos path or a small data URL. */
  logo?: string | null
  /** USCF member number; the live rating is looked up from it. */
  uscf_id?: string | null
  sort_order: number
  created_at: string
}

export type LessonStatus = 'planned' | 'in_progress' | 'taught'

export const LESSON_STATUS: { value: LessonStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'taught', label: 'Taught' },
]

export interface LessonPlan {
  id: string
  student_id: string
  number: number
  title: string
  agenda: string[]
  /** Multi-week theme block this lesson belongs to, e.g. "Endgames — October". */
  theme?: string
  status?: LessonStatus
  /** ISO date (yyyy-mm-dd) the lesson was marked taught. */
  taught_on?: string | null
  created_at: string
  updated_at: string
}

/** A saved lesson shape: what a new lesson starts from. */
export interface LessonTemplate {
  id: string
  user_id: string
  name: string
  theme: string
  sections: string[]
  agenda: string[]
  created_at: string
}

/** What a new lesson is created with — copied from last time, a template, or nothing. */
export interface NewLessonInit {
  title?: string
  theme?: string
  agenda?: string[]
  sections?: string[]
}

/** The coach's own recurring choices, most-used first, for tap-to-pick chips. */
export interface LessonHistory {
  sections: string[]
  themes: string[]
  agenda: string[]
}

export interface LessonSection {
  id: string
  lesson_plan_id: string
  title: string
  sort_order: number
}

export interface BoardArrow {
  startSquare: string
  endSquare: string
  color: string
}

export interface BoardHighlight {
  square: string
  color: string
}

export interface SolutionMove {
  san: string
  fen: string
  comment?: string
}

export type PuzzleSourceKind =
  | 'lichess_puzzle'
  | 'lichess_study'
  | 'lichess_game'
  | 'chesscom_game'
  | 'pgn'
  | 'fen'
  | 'screenshot'
  | 'manual'

export interface PuzzleSource {
  kind: PuzzleSourceKind
  url?: string
  id?: string
  /** For games: the ply the puzzle starts from. */
  ply?: number
  /** Lichess puzzle rating, when known. */
  rating?: number
}

export interface Puzzle {
  id: string
  section_id: string
  sort_order: number
  label: string
  starting_fen: string
  side_to_move: 'w' | 'b'
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
  quiz_prompt: string
  summary: string
  solution: SolutionMove[]
  reference_url: string | null
  reference_label: string | null
  source?: PuzzleSource | null
  themes?: string[]
  /** Annotated and saved in the workbench. */
  done?: boolean
}

export interface CustomBoard {
  light: string
  dark: string
}

export interface UserSettings {
  user_id: string
  /** A built-in id, or 'custom:<id>' for an imported set. */
  piece_set: string
  lichess_username?: string
  chesscom_username?: string
  board_theme?: string
  custom_board?: CustomBoard | null
  /** 'folder' or a Chess Arcade skin id. */
  skin?: string
  updated_at: string
}

/** Twelve images keyed wK, wQ, wR, wB, wN, wP, bK, bQ, bR, bB, bN, bP — data URLs. */
export type PieceImages = Record<string, string>

export interface CustomPieceSet {
  id: string
  user_id: string
  name: string
  images: PieceImages
  created_at: string
}

export interface Note {
  id: string
  student_id: string
  folder_kind: Exclude<FolderKind, 'lesson_plan'>
  title: string
  body: string
  amount: number | null
  created_at: string
  updated_at: string
}
