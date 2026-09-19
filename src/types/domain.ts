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
  sort_order: number
  created_at: string
}

export interface LessonPlan {
  id: string
  student_id: string
  number: number
  title: string
  agenda: string[]
  created_at: string
  updated_at: string
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
}

export interface UserSettings {
  user_id: string
  piece_set: 'classic' | 'arcade' | 'wavy'
  updated_at: string
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
