import fixtures from './fixtures.json'
import type { LessonBundle, LessonPlanPatch, PuzzlePatch, SettingsPatch } from '../api'
import { rankByUse } from '../rank'
import type {
  CustomPieceSet,
  FolderKind,
  LessonHistory,
  LessonPlan,
  LessonSection,
  LessonTemplate,
  NewLessonInit,
  Note,
  PieceImages,
  Puzzle,
  Student,
  UserSettings,
} from '../../types/domain'

/**
 * In-memory stand-in for the Supabase API, seeded with the real imported
 * lessons. Lets the app run with VITE_DEMO=1 and no backend — for trying it
 * out, for screenshots, and for the automated checks that run on every phase.
 * Edits persist in localStorage so a demo session behaves like the real thing.
 */
interface Store {
  students: Student[]
  plans: LessonPlan[]
  sections: LessonSection[]
  puzzles: Puzzle[]
  notes: Note[]
  settings: UserSettings | null
  pieceSets?: CustomPieceSet[]
  templates?: LessonTemplate[]
}

const KEY = 'lesson-planner-demo-store-v1'
const now = () => new Date().toISOString()
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`

function seed(): Store {
  const created = now()
  return {
    students: fixtures.students.map((s, i) => ({ ...s, user_id: 'demo', sort_order: i, created_at: created })),
    plans: fixtures.plans.map((p) => ({ ...p, status: 'taught' as const, created_at: created, updated_at: created })),
    sections: fixtures.sections,
    puzzles: fixtures.puzzles.map((p) => ({ ...p, side_to_move: p.side_to_move as 'w' | 'b' })),
    notes: [
      {
        id: 'note_1',
        student_id: 'stu_jojo',
        folder_kind: 'student_notes',
        title: 'Openings to revisit',
        body: 'Caro-Kann Advance: keep an eye on the light-squared bishop.',
        amount: null,
        created_at: created,
        updated_at: created,
      },
      {
        id: 'note_2',
        student_id: 'stu_jojo',
        folder_kind: 'invoices',
        title: 'September block (4 lessons)',
        body: 'Paid.',
        amount: 240,
        created_at: created,
        updated_at: created,
      },
    ],
    settings: null,
  }
}

// Initialised on first use, not at import, so a production build (no demo
// flag) can drop this whole module and its fixtures from the bundle.
let store: Store = null as unknown as Store
function db(): Store {
  if (store) return store
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return (store = JSON.parse(raw) as Store)
  } catch {
    // fall through to a fresh seed
  }
  return (store = seed())
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db()))
  } catch {
    // demo mode keeps working in memory
  }
}

const delay = () => new Promise<void>((r) => setTimeout(r, 40))

// students --------------------------------------------------------------------

export async function listStudents(): Promise<Student[]> {
  await delay()
  return [...db().students].sort((a, b) => a.sort_order - b.sort_order)
}

export async function createStudent(name: string, color: string): Promise<Student> {
  const student: Student = {
    id: uid('stu'),
    user_id: 'demo',
    name,
    color,
    sort_order: db().students.length,
    created_at: now(),
  }
  db().students.push(student)
  save()
  return student
}

export async function updateStudent(id: string, patch: Partial<Pick<Student, 'name' | 'color' | 'sort_order'>>) {
  db().students = db().students.map((s) => (s.id === id ? { ...s, ...patch } : s))
  save()
}

export async function deleteStudent(id: string) {
  const planIds = new Set(db().plans.filter((p) => p.student_id === id).map((p) => p.id))
  const sectionIds = new Set(db().sections.filter((s) => planIds.has(s.lesson_plan_id)).map((s) => s.id))
  db().students = db().students.filter((s) => s.id !== id)
  db().plans = db().plans.filter((p) => !planIds.has(p.id))
  db().sections = db().sections.filter((s) => !sectionIds.has(s.id))
  db().puzzles = db().puzzles.filter((p) => !sectionIds.has(p.section_id))
  db().notes = db().notes.filter((n) => n.student_id !== id)
  save()
}

export async function getFolderCounts(studentId: string): Promise<Record<FolderKind, number>> {
  await delay()
  const count = (kind: Note['folder_kind']) =>
    db().notes.filter((n) => n.student_id === studentId && n.folder_kind === kind).length
  return {
    lesson_plan: db().plans.filter((p) => p.student_id === studentId).length,
    misc: count('misc'),
    game_review: count('game_review'),
    invoices: count('invoices'),
    student_notes: count('student_notes'),
  }
}

// lesson plans ------------------------------------------------------------------

export async function listLessonPlans(studentId: string): Promise<LessonPlan[]> {
  await delay()
  return db().plans.filter((p) => p.student_id === studentId).sort((a, b) => b.number - a.number)
}

export async function getLessonPlan(id: string): Promise<LessonPlan> {
  const plan = db().plans.find((p) => p.id === id)
  if (!plan) throw new Error('Lesson plan not found')
  return plan
}

export async function createLessonPlan(studentId: string, init: NewLessonInit = {}): Promise<LessonPlan> {
  const numbers = db().plans.filter((p) => p.student_id === studentId).map((p) => p.number)
  const plan: LessonPlan = {
    id: uid('lp'),
    student_id: studentId,
    number: numbers.length ? Math.max(...numbers) + 1 : 1,
    title: init.title ?? '',
    theme: init.theme ?? '',
    agenda: init.agenda ?? [],
    status: 'planned',
    taught_on: null,
    created_at: now(),
    updated_at: now(),
  }
  db().plans.push(plan)
  ;(init.sections ?? []).forEach((title, i) =>
    db().sections.push({ id: uid('sec'), lesson_plan_id: plan.id, title, sort_order: i }),
  )
  save()
  return plan
}

export async function duplicateLessonPlan(planId: string): Promise<LessonPlan> {
  const source = await getLessonBundle(planId)
  const plan = await createLessonPlan(source.plan.student_id, {
    title: source.plan.title,
    theme: source.plan.theme,
    agenda: source.plan.agenda,
  })
  for (const section of source.sections) {
    const copy: LessonSection = { id: uid('sec'), lesson_plan_id: plan.id, title: section.title, sort_order: section.sort_order }
    db().sections.push(copy)
    for (const puzzle of source.puzzlesBySection[section.id] ?? []) {
      db().puzzles.push({ ...puzzle, id: uid('pz'), section_id: copy.id })
    }
  }
  save()
  return plan
}

export async function updateLessonPlan(id: string, patch: LessonPlanPatch) {
  db().plans = db().plans.map((p) => (p.id === id ? { ...p, ...patch, updated_at: now() } : p))
  save()
}

export async function getLessonHistory(): Promise<LessonHistory> {
  return {
    sections: rankByUse(db().sections.map((s) => s.title)),
    themes: rankByUse(db().plans.map((p) => p.theme ?? '')),
    agenda: rankByUse(db().plans.flatMap((p) => p.agenda)),
  }
}

export async function listLessonTemplates(): Promise<LessonTemplate[]> {
  return [...(db().templates ?? [])]
}

export async function createLessonTemplate(
  template: Pick<LessonTemplate, 'name' | 'theme' | 'sections' | 'agenda'>,
): Promise<LessonTemplate> {
  const created: LessonTemplate = { id: uid('tpl'), user_id: 'demo', created_at: now(), ...template }
  db().templates = [...(db().templates ?? []), created]
  save()
  return created
}

export async function deleteLessonTemplate(id: string) {
  db().templates = (db().templates ?? []).filter((t) => t.id !== id)
  save()
}

export async function deleteLessonPlan(id: string) {
  const sectionIds = new Set(db().sections.filter((s) => s.lesson_plan_id === id).map((s) => s.id))
  db().plans = db().plans.filter((p) => p.id !== id)
  db().sections = db().sections.filter((s) => !sectionIds.has(s.id))
  db().puzzles = db().puzzles.filter((p) => !sectionIds.has(p.section_id))
  save()
}

// sections ----------------------------------------------------------------------

export async function listSections(lessonPlanId: string): Promise<LessonSection[]> {
  return db().sections.filter((s) => s.lesson_plan_id === lessonPlanId).sort((a, b) => a.sort_order - b.sort_order)
}

export async function createSection(lessonPlanId: string, title: string): Promise<LessonSection> {
  const existing = await listSections(lessonPlanId)
  const section: LessonSection = { id: uid('sec'), lesson_plan_id: lessonPlanId, title, sort_order: existing.length }
  db().sections.push(section)
  save()
  return section
}

export async function updateSection(id: string, patch: Partial<Pick<LessonSection, 'title' | 'sort_order'>>) {
  db().sections = db().sections.map((s) => (s.id === id ? { ...s, ...patch } : s))
  save()
}

export async function deleteSection(id: string) {
  db().sections = db().sections.filter((s) => s.id !== id)
  db().puzzles = db().puzzles.filter((p) => p.section_id !== id)
  save()
}

// puzzles -----------------------------------------------------------------------

export async function listAllPuzzleIds(lessonPlanId: string): Promise<string[]> {
  const sectionIds = new Set((await listSections(lessonPlanId)).map((s) => s.id))
  return db().puzzles.filter((p) => sectionIds.has(p.section_id)).map((p) => p.id)
}

export async function getLessonBundle(lessonPlanId: string): Promise<LessonBundle> {
  await delay()
  const plan = await getLessonPlan(lessonPlanId)
  const sections = await listSections(lessonPlanId)
  const puzzlesBySection: Record<string, Puzzle[]> = {}
  for (const s of sections) puzzlesBySection[s.id] = await listPuzzles(s.id)
  return { plan, sections, puzzlesBySection }
}

export async function listPuzzles(sectionId: string): Promise<Puzzle[]> {
  return db().puzzles.filter((p) => p.section_id === sectionId).sort((a, b) => a.sort_order - b.sort_order)
}

export async function getPuzzle(id: string): Promise<Puzzle> {
  await delay()
  const puzzle = db().puzzles.find((p) => p.id === id)
  if (!puzzle) throw new Error('Puzzle not found')
  return puzzle
}

export async function createPuzzle(sectionId: string, initial: PuzzlePatch = {}): Promise<Puzzle> {
  const existing = await listPuzzles(sectionId)
  const puzzle: Puzzle = {
    id: uid('pz'),
    section_id: sectionId,
    sort_order: existing.length,
    label: `#${existing.length + 1}`,
    starting_fen: 'start',
    side_to_move: 'w',
    arrows: [],
    highlights: [],
    quiz_prompt: '',
    summary: '',
    solution: [],
    reference_url: null,
    reference_label: null,
    ...initial,
  }
  db().puzzles.push(puzzle)
  save()
  return puzzle
}

export async function updatePuzzle(id: string, patch: PuzzlePatch) {
  db().puzzles = db().puzzles.map((p) => (p.id === id ? { ...p, ...patch } : p))
  save()
}

export async function deletePuzzle(id: string) {
  db().puzzles = db().puzzles.filter((p) => p.id !== id)
  save()
}

// notes -------------------------------------------------------------------------

export async function listNotes(studentId: string, folderKind: Note['folder_kind']): Promise<Note[]> {
  await delay()
  return db().notes
    .filter((n) => n.student_id === studentId && n.folder_kind === folderKind)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function createNote(studentId: string, folderKind: Note['folder_kind']): Promise<Note> {
  const note: Note = {
    id: uid('note'),
    student_id: studentId,
    folder_kind: folderKind,
    title: 'Untitled',
    body: '',
    amount: null,
    created_at: now(),
    updated_at: now(),
  }
  db().notes.push(note)
  save()
  return note
}

export async function updateNote(id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'amount'>>) {
  db().notes = db().notes.map((n) => (n.id === id ? { ...n, ...patch, updated_at: now() } : n))
  save()
}

export async function deleteNote(id: string) {
  db().notes = db().notes.filter((n) => n.id !== id)
  save()
}

// settings ----------------------------------------------------------------------

export async function getUserSettings(): Promise<UserSettings | null> {
  return db().settings
}

export async function updateUserSettings(patch: SettingsPatch) {
  db().settings = { user_id: 'demo', piece_set: 'classic', ...db().settings, ...patch, updated_at: now() }
  save()
}

// custom piece sets ---------------------------------------------------------------

export async function listCustomPieceSets(): Promise<CustomPieceSet[]> {
  return db().pieceSets ?? []
}

export async function createCustomPieceSet(name: string, images: PieceImages): Promise<CustomPieceSet> {
  const set: CustomPieceSet = { id: uid('set'), user_id: 'demo', name, images, created_at: now() }
  db().pieceSets = [...(db().pieceSets ?? []), set]
  save()
  return set
}

export async function deleteCustomPieceSet(id: string) {
  db().pieceSets = (db().pieceSets ?? []).filter((s) => s.id !== id)
  save()
}
