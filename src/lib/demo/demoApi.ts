import fixtures from './fixtures.json'
import { sortLibrary, type PaymentInput, type ChangeInput, type PlacePatch, type ReminderInput, type ReminderPatch, type SlotInput, type LessonBundle, type LessonPlanPatch, type LibraryEntry, type PuzzleLocation, type PuzzlePatch, type SettingsPatch, type UscfEvent, type UscfHistory, type UscfRating } from '../api'
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
  Reminder,
  ScheduleChange,
  ScheduleSlot,
  Student,
  StudentPlace,
  LessonPayment,
  UserSettings,
} from '../../types/domain'
import { addDays, reminderFor, todayIso, weekStart } from '../schedule'

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
  slots?: ScheduleSlot[]
  changes?: ScheduleChange[]
  reminders?: Reminder[]
  places?: StudentPlace[]
  payments?: LessonPayment[]
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

export { STUDENT_MIGRATION_COLUMNS } from '../api'

export async function missingStudentColumns(): Promise<string[]> {
  return []
}

/** Stand-in ratings for the demo's members, so the folders show something without the network. */
const DEMO_RATINGS: Record<string, Omit<UscfRating, 'id' | 'fetchedAt'>> = {
  '32473012': { name: 'JOSEPH LIU', regular: 1436, quick: 1390, blitz: 1402, expires: '2027-06-30' },
  '32653994': { name: 'PARKER DOWNING', regular: 812, quick: 790, blitz: null, expires: '2027-03-31' },
}

const DEMO_EVENTS: Record<string, UscfEvent[]> = {
  '32473012': [
    { date: '2026-06-14', eventId: '202606141234', name: '2026 SUMMER SCHOLASTIC OPEN', section: '3: U1500', points: 3.5, games: 4, before: 1405, after: 1436 },
    { date: '2026-03-02', eventId: '202603021111', name: 'MARSHALL SUNDAY G/45', section: '1: OPEN', points: 2, games: 4, before: 1362, after: 1405 },
    { date: '2025-12-07', eventId: '202512071234', name: 'NYC SCHOLASTIC CHAMPIONSHIP', section: '2: K-6 U1400', points: 4, games: 5, before: 1290, after: 1362 },
  ],
  '32653994': [
    { date: '2026-05-17', eventId: '202605171234', name: 'CHELSEA CHESSMATES SPRING OPEN', section: '4: U900', points: 3, games: 4, before: 760, after: 812 },
    { date: '2026-02-08', eventId: '202602081234', name: 'PS 11 WINTER RATED', section: '2: U1000', points: 1.5, games: 4, before: null, after: 760 },
  ],
}

export async function getUscfHistory(id: string): Promise<UscfHistory> {
  const rating = await getUscfRating(id)
  return { ...rating, events: DEMO_EVENTS[id] ?? [] }
}

export async function getUscfRating(id: string): Promise<UscfRating> {
  await delay()
  const known = DEMO_RATINGS[id]
  if (!known) throw new Error('No member with that ID on the USCF page')
  return { id, ...known, fetchedAt: now() }
}

export async function updateStudent(id: string, patch: Partial<Pick<Student, 'name' | 'color' | 'logo' | 'uscf_id' | 'sort_order'>>) {
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
  // The database cascades a student's schedule away with them; so does the demo.
  const store = db()
  if (store.slots) {
    store.slots = store.slots.filter((s) => s.student_id !== id)
    store.changes = (store.changes ?? []).filter((c) => c.student_id !== id)
    store.reminders = (store.reminders ?? []).filter((r) => r.student_id !== id)
    store.places = (store.places ?? []).filter((p) => p.student_id !== id)
  }
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

export async function createLessonFromPositions(studentId: string, positions: PuzzlePatch[]): Promise<LessonPlan> {
  const plan = await createLessonPlan(studentId, { sections: ['Positions'] })
  const section = db().sections.find((s) => s.lesson_plan_id === plan.id)!
  for (const p of positions) await createPuzzle(section.id, p)
  return plan
}

export async function duplicateLessonPlan(planId: string, studentId?: string): Promise<LessonPlan> {
  const source = await getLessonBundle(planId)
  const plan = await createLessonPlan(studentId ?? source.plan.student_id, {
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

export async function locatePuzzle(puzzleId: string): Promise<PuzzleLocation | null> {
  const puzzle = db().puzzles.find((p) => p.id === puzzleId)
  const section = puzzle && db().sections.find((s) => s.id === puzzle.section_id)
  const plan = section && db().plans.find((p) => p.id === section.lesson_plan_id)
  return plan ? { studentId: plan.student_id, lessonPlanId: plan.id } : null
}

export async function listLibrary(): Promise<LibraryEntry[]> {
  await delay()
  const entries: LibraryEntry[] = []
  for (const puzzle of db().puzzles) {
    const section = db().sections.find((s) => s.id === puzzle.section_id)
    const plan = section && db().plans.find((p) => p.id === section.lesson_plan_id)
    const student = plan && db().students.find((s) => s.id === plan.student_id)
    if (!section || !plan || !student) continue
    entries.push({
      puzzle,
      studentId: student.id,
      studentName: student.name,
      studentColor: student.color,
      lessonPlanId: plan.id,
      lessonNumber: plan.number,
      lessonTitle: plan.title,
      sectionTitle: section.title,
      sectionOrder: section.sort_order,
    })
  }
  return sortLibrary(entries)
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

// Shared with the real API; the data layer expects the same surface from both.
export { sortLibrary }

// schedule ----------------------------------------------------------------------

/**
 * A believable week for the demo: Jojo on Tuesdays, Parker on Thursdays, and
 * this week Parker's lesson moved to Tuesday, so Tuesday holds two.
 */
function seedSchedule(store: Store) {
  if (store.slots) return
  const created = now()
  const mon = weekStart(todayIso())
  store.slots = [
    { id: 'slot_jojo', user_id: 'demo', student_id: 'stu_jojo', weekday: 2, start_time: '16:00', duration_min: 60, created_at: created },
    { id: 'slot_parker', user_id: 'demo', student_id: 'stu_parker', weekday: 4, start_time: '16:30', duration_min: 60, created_at: created },
    { id: 'slot_aria', user_id: 'demo', student_id: 'stu_aria', weekday: 1, start_time: '15:45', duration_min: 45, created_at: created },
  ]
  const moved: ScheduleChange = {
    id: 'chg_parker',
    user_id: 'demo',
    slot_id: 'slot_parker',
    student_id: 'stu_parker',
    kind: 'moved',
    original_date: addDays(mon, 3),
    new_date: addDays(mon, 1),
    new_time: '17:30',
    duration_min: null,
    note: 'School trip on Thursday',
    created_at: created,
  }
  store.changes = [moved]
  store.reminders = [
    { id: 'rem_parker', user_id: 'demo', change_id: moved.id, done: false, shared_at: null, created_at: created, ...reminderFor(moved, 'Parker Downing', store.slots[1]) },
  ]
  store.places = [
    {
      student_id: 'stu_jojo',
      user_id: 'demo',
      address: '245 E 63rd St, New York, NY',
      door_code: '4417#',
      bathroom_code: '',
      bathroom_note: '',
      notes: 'Doorman building; ask for the Liu family.',
      hourly_rate: 60,
      updated_at: created,
    },
    {
      student_id: 'stu_parker',
      user_id: 'demo',
      address: 'Chelsea Chessmates, 180 8th Ave, New York, NY',
      door_code: '2580',
      bathroom_code: '1357',
      bathroom_note: "McDonald's next door",
      notes: '',
      hourly_rate: 45,
      updated_at: created,
    },
  ]
  save()
}
function sched() {
  const store = db()
  seedSchedule(store)
  return store as Store & Required<Pick<Store, 'slots' | 'changes' | 'reminders' | 'places'>>
}

export { SCHEDULE_MIGRATION, SCHEDULE_TABLES } from '../api'

export async function missingScheduleTables(): Promise<string[]> {
  return []
}

export { RATE_MIGRATION } from '../api'

export async function rateColumnMissing(): Promise<boolean> {
  return false
}

export async function listScheduleSlots(): Promise<ScheduleSlot[]> {
  await delay()
  return [...sched().slots].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
}

export async function createScheduleSlot(input: SlotInput): Promise<ScheduleSlot> {
  const slot: ScheduleSlot = { id: uid('slot'), user_id: 'demo', created_at: now(), ...input }
  sched().slots.push(slot)
  save()
  return slot
}

export async function updateScheduleSlot(id: string, patch: Partial<SlotInput>) {
  const store = sched()
  store.slots = store.slots.map((s) => (s.id === id ? { ...s, ...patch } : s))
  save()
}

export async function deleteScheduleSlot(id: string) {
  const store = sched()
  const gone = new Set(store.changes.filter((c) => c.slot_id === id).map((c) => c.id))
  store.slots = store.slots.filter((s) => s.id !== id)
  store.changes = store.changes.filter((c) => !gone.has(c.id))
  store.reminders = store.reminders.filter((r) => !r.change_id || !gone.has(r.change_id))
  save()
}

export async function listScheduleChanges(): Promise<ScheduleChange[]> {
  await delay()
  return [...sched().changes]
}

export async function saveScheduleChange(input: ChangeInput, id?: string): Promise<ScheduleChange> {
  const store = sched()
  const existing = id
    ? store.changes.find((c) => c.id === id)
    : input.slot_id
      ? store.changes.find((c) => c.slot_id === input.slot_id && c.original_date === input.original_date)
      : undefined
  if (existing) {
    const next = { ...existing, ...input }
    store.changes = store.changes.map((c) => (c.id === existing.id ? next : c))
    save()
    return next
  }
  const change: ScheduleChange = { id: uid('chg'), user_id: 'demo', created_at: now(), ...input }
  store.changes.push(change)
  save()
  return change
}

export async function deleteScheduleChange(id: string) {
  const store = sched()
  store.changes = store.changes.filter((c) => c.id !== id)
  store.reminders = store.reminders.filter((r) => r.change_id !== id)
  save()
}

export async function listReminders(): Promise<Reminder[]> {
  await delay()
  return [...sched().reminders].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function createReminder(input: ReminderInput): Promise<Reminder> {
  const reminder: Reminder = { id: uid('rem'), user_id: 'demo', done: false, shared_at: null, created_at: now(), ...input }
  sched().reminders.push(reminder)
  save()
  return reminder
}

export async function updateReminder(id: string, patch: ReminderPatch) {
  const store = sched()
  store.reminders = store.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r))
  save()
}

export async function deleteReminder(id: string) {
  const store = sched()
  store.reminders = store.reminders.filter((r) => r.id !== id)
  save()
}

export async function listStudentPlaces(): Promise<StudentPlace[]> {
  await delay()
  return [...sched().places]
}

export async function saveStudentPlace(studentId: string, patch: PlacePatch) {
  const store = sched()
  const blank = { address: '', door_code: '', bathroom_code: '', bathroom_note: '', notes: '', hourly_rate: null }
  const prev = store.places.find((p) => p.student_id === studentId)
  const next: StudentPlace = { ...blank, ...prev, ...patch, student_id: studentId, user_id: 'demo', updated_at: now() }
  store.places = [...store.places.filter((p) => p.student_id !== studentId), next]
  save()
}

// paid lessons ------------------------------------------------------------------

export { PAYMENTS_MIGRATION } from '../api'

export async function paymentsTableMissing(): Promise<boolean> {
  return false
}

export async function listPayments(): Promise<LessonPayment[]> {
  await delay()
  return [...(db().payments ?? [])]
}

export async function markPaid(input: PaymentInput) {
  const store = db()
  const rest = (store.payments ?? []).filter((p) => p.lesson_key !== input.lesson_key)
  store.payments = [...rest, { id: uid('pay'), user_id: 'demo', paid_on: now().slice(0, 10), created_at: now(), ...input }]
  save()
}

export async function markUnpaid(lessonKey: string) {
  const store = db()
  store.payments = (store.payments ?? []).filter((p) => p.lesson_key !== lessonKey)
  save()
}
