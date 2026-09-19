import { supabase } from './supabase'
import type {
  BoardArrow,
  BoardHighlight,
  FolderKind,
  LessonPlan,
  LessonSection,
  Note,
  Puzzle,
  SolutionMove,
  Student,
} from '../types/domain'

// ---------------------------------------------------------------------------
// students
// ---------------------------------------------------------------------------

export async function listStudents(): Promise<Student[]> {
  const { data, error } = await supabase.from('students').select('*').order('sort_order', { ascending: true })
  if (error) throw error
  return data as Student[]
}

export async function createStudent(name: string, color: string): Promise<Student> {
  const { data: existing } = await supabase
    .from('students')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('students')
    .insert({ name, color, sort_order: nextOrder, user_id: userData.user?.id })
    .select()
    .single()
  if (error) throw error
  return data as Student
}

export async function updateStudent(id: string, patch: Partial<Pick<Student, 'name' | 'color' | 'sort_order'>>) {
  const { error } = await supabase.from('students').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteStudent(id: string) {
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// folder counts
// ---------------------------------------------------------------------------

export async function getFolderCounts(studentId: string): Promise<Record<FolderKind, number>> {
  const [lessonPlans, misc, gameReview, invoices, studentNotes] = await Promise.all([
    supabase.from('lesson_plans').select('id', { count: 'exact', head: true }).eq('student_id', studentId),
    supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('folder_kind', 'misc'),
    supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('folder_kind', 'game_review'),
    supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('folder_kind', 'invoices'),
    supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('folder_kind', 'student_notes'),
  ])
  return {
    lesson_plan: lessonPlans.count ?? 0,
    misc: misc.count ?? 0,
    game_review: gameReview.count ?? 0,
    invoices: invoices.count ?? 0,
    student_notes: studentNotes.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// lesson plans
// ---------------------------------------------------------------------------

export async function listLessonPlans(studentId: string): Promise<LessonPlan[]> {
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('student_id', studentId)
    .order('number', { ascending: false })
  if (error) throw error
  return data as LessonPlan[]
}

export async function getLessonPlan(id: string): Promise<LessonPlan> {
  const { data, error } = await supabase.from('lesson_plans').select('*').eq('id', id).single()
  if (error) throw error
  return data as LessonPlan
}

export async function createLessonPlan(studentId: string, title: string): Promise<LessonPlan> {
  const { data: existing } = await supabase
    .from('lesson_plans')
    .select('number')
    .eq('student_id', studentId)
    .order('number', { ascending: false })
    .limit(1)
  const nextNumber = existing && existing.length > 0 ? existing[0].number + 1 : 1
  const { data, error } = await supabase
    .from('lesson_plans')
    .insert({ student_id: studentId, number: nextNumber, title, agenda: [] })
    .select()
    .single()
  if (error) throw error
  return data as LessonPlan
}

export async function updateLessonPlan(id: string, patch: Partial<Pick<LessonPlan, 'title' | 'agenda'>>) {
  const { error } = await supabase.from('lesson_plans').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteLessonPlan(id: string) {
  const { error } = await supabase.from('lesson_plans').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// lesson sections
// ---------------------------------------------------------------------------

export async function listSections(lessonPlanId: string): Promise<LessonSection[]> {
  const { data, error } = await supabase
    .from('lesson_sections')
    .select('*')
    .eq('lesson_plan_id', lessonPlanId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data as LessonSection[]
}

export async function createSection(lessonPlanId: string, title: string): Promise<LessonSection> {
  const { data: existing } = await supabase
    .from('lesson_sections')
    .select('sort_order')
    .eq('lesson_plan_id', lessonPlanId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0
  const { data, error } = await supabase
    .from('lesson_sections')
    .insert({ lesson_plan_id: lessonPlanId, title, sort_order: nextOrder })
    .select()
    .single()
  if (error) throw error
  return data as LessonSection
}

export async function updateSection(id: string, patch: Partial<Pick<LessonSection, 'title' | 'sort_order'>>) {
  const { error } = await supabase.from('lesson_sections').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteSection(id: string) {
  const { error } = await supabase.from('lesson_sections').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// puzzles
// ---------------------------------------------------------------------------

/** All puzzle ids across every section of a lesson plan — used for a plan-wide progress count. */
export async function listAllPuzzleIds(lessonPlanId: string): Promise<string[]> {
  const sections = await listSections(lessonPlanId)
  const perSection = await Promise.all(
    sections.map(async (section) => {
      const { data, error } = await supabase.from('puzzles').select('id').eq('section_id', section.id)
      if (error) throw error
      return (data ?? []).map((row) => row.id as string)
    }),
  )
  return perSection.flat()
}

export async function listPuzzles(sectionId: string): Promise<Puzzle[]> {
  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('section_id', sectionId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data as Puzzle[]
}

export async function getPuzzle(id: string): Promise<Puzzle> {
  const { data, error } = await supabase.from('puzzles').select('*').eq('id', id).single()
  if (error) throw error
  return data as Puzzle
}

export async function createPuzzle(sectionId: string): Promise<Puzzle> {
  const { data: existing } = await supabase
    .from('puzzles')
    .select('sort_order')
    .eq('section_id', sectionId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0
  const { data, error } = await supabase
    .from('puzzles')
    .insert({
      section_id: sectionId,
      sort_order: nextOrder,
      label: `#${nextOrder + 1}`,
      starting_fen: 'start',
      side_to_move: 'w',
      arrows: [],
      highlights: [],
      quiz_prompt: '',
      summary: '',
      solution: [],
    })
    .select()
    .single()
  if (error) throw error
  return data as Puzzle
}

export interface PuzzlePatch {
  label?: string
  starting_fen?: string
  side_to_move?: 'w' | 'b'
  arrows?: BoardArrow[]
  highlights?: BoardHighlight[]
  quiz_prompt?: string
  summary?: string
  solution?: SolutionMove[]
  reference_url?: string | null
  reference_label?: string | null
  sort_order?: number
}

export async function updatePuzzle(id: string, patch: PuzzlePatch) {
  const { error } = await supabase.from('puzzles').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletePuzzle(id: string) {
  const { error } = await supabase.from('puzzles').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// notes
// ---------------------------------------------------------------------------

export async function listNotes(studentId: string, folderKind: Note['folder_kind']): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('student_id', studentId)
    .eq('folder_kind', folderKind)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Note[]
}

export async function createNote(studentId: string, folderKind: Note['folder_kind']): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({ student_id: studentId, folder_kind: folderKind, title: 'Untitled', body: '' })
    .select()
    .single()
  if (error) throw error
  return data as Note
}

export async function updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'amount'>>) {
  const { error } = await supabase.from('notes').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw error
}
