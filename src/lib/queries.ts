import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import * as api from './data'
import type { LessonPayment, FolderKind, LessonPlan, LessonSection, LessonStatus, LessonTemplate, NewLessonInit, Note, Puzzle, Reminder, ScheduleChange, ScheduleSlot, Student, StudentPlace } from '../types/domain'
import { reminderFor } from './schedule'

export const keys = {
  students: ['students'] as const,
  folderCounts: (studentId: string) => ['folderCounts', studentId] as const,
  lessonPlans: (studentId: string) => ['lessonPlans', studentId] as const,
  lesson: (planId: string) => ['lesson', planId] as const,
  puzzle: (puzzleId: string) => ['puzzle', puzzleId] as const,
  notes: (studentId: string, kind: Note['folder_kind']) => ['notes', studentId, kind] as const,
  settings: ['settings'] as const,
  lessonHistory: ['lessonHistory'] as const,
  lessonTemplates: ['lessonTemplates'] as const,
  pieceSets: ['pieceSets'] as const,
  library: ['library'] as const,
  uscf: (memberId: string) => ['uscf', memberId] as const,
  uscfHistory: (memberId: string) => ['uscfHistory', memberId] as const,
  scheduleMissing: ['scheduleMissing'] as const,
  scheduleSlots: ['scheduleSlots'] as const,
  scheduleChanges: ['scheduleChanges'] as const,
  reminders: ['reminders'] as const,
  places: ['places'] as const,
  rateMissing: ['rateMissing'] as const,
  codesMissing: ['codesMissing'] as const,
  paymentsMissing: ['paymentsMissing'] as const,
  payments: ['payments'] as const,
}

/** A student's live USCF rating, kept for six hours (and offline, from the persisted cache). */
export function useUscfRating(memberId: string | null | undefined) {
  return useQuery({
    queryKey: keys.uscf(memberId ?? ''),
    queryFn: () => api.getUscfRating(memberId!),
    enabled: Boolean(memberId),
    staleTime: 6 * 60 * 60_000,
    retry: 1,
  })
}

/** The member's tournament history with scores, for the player tracker; a slower lookup, kept a day. */
export function useUscfHistory(memberId: string | null | undefined) {
  return useQuery({
    queryKey: keys.uscfHistory(memberId ?? ''),
    queryFn: () => api.getUscfHistory(memberId!),
    enabled: Boolean(memberId),
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  })
}

// ---------------------------------------------------------------------------
// students
// ---------------------------------------------------------------------------

/** Every position across every student, for the library page. */
export function useLibrary() {
  return useQuery({ queryKey: keys.library, queryFn: api.listLibrary })
}

export function useStudents() {
  return useQuery({ queryKey: keys.students, queryFn: api.listStudents })
}

/** A single student, served from the cached list so student screens open instantly. */
export function useStudent(studentId: string | undefined) {
  const q = useStudents()
  return { ...q, data: q.data?.find((s) => s.id === studentId) }
}

export function useFolderCounts(studentId: string | undefined) {
  return useQuery({
    queryKey: keys.folderCounts(studentId ?? ''),
    queryFn: () => api.getFolderCounts(studentId!),
    enabled: Boolean(studentId),
  })
}

export function useStudentMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.students })
  const create = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) => api.createStudent(name, color),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Student, 'name' | 'color' | 'logo' | 'uscf_id' | 'sort_order'>> }) =>
      api.updateStudent(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.students })
      const prev = qc.getQueryData<Student[]>(keys.students)
      qc.setQueryData<Student[]>(keys.students, (old) => old?.map((s) => (s.id === id ? { ...s, ...patch } : s)))
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.students, ctx.prev),
    onSettled: invalidate,
  })
  const remove = useMutation({ mutationFn: (id: string) => api.deleteStudent(id), onSuccess: invalidate })
  return { create, update, remove }
}

// ---------------------------------------------------------------------------
// lesson plans
// ---------------------------------------------------------------------------

export function useLessonPlans(studentId: string | undefined) {
  return useQuery({
    queryKey: keys.lessonPlans(studentId ?? ''),
    queryFn: () => api.listLessonPlans(studentId!),
    enabled: Boolean(studentId),
  })
}

export function useLesson(planId: string | undefined) {
  return useQuery({
    queryKey: keys.lesson(planId ?? ''),
    queryFn: () => api.getLessonBundle(planId!),
    enabled: Boolean(planId),
  })
}

export function useLessonPlanMutations(studentId: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.lessonPlans(studentId) })
    qc.invalidateQueries({ queryKey: keys.folderCounts(studentId) })
    qc.invalidateQueries({ queryKey: keys.lessonHistory })
  }
  const create = useMutation({
    mutationFn: (init: NewLessonInit = {}) => api.createLessonPlan(studentId, init),
    onSuccess: invalidate,
  })
  const createFromPositions = useMutation({
    mutationFn: (positions: api.PuzzlePatch[]) => api.createLessonFromPositions(studentId, positions),
    onSuccess: invalidate,
  })
  // Given another student's id the copy is recycled into their folder.
  const duplicate = useMutation({
    mutationFn: ({ planId, studentId: target }: { planId: string; studentId?: string }) => api.duplicateLessonPlan(planId, target),
    onSuccess: (_plan, { studentId: target }) => {
      invalidate()
      if (target && target !== studentId) {
        qc.invalidateQueries({ queryKey: keys.lessonPlans(target) })
        qc.invalidateQueries({ queryKey: keys.folderCounts(target) })
      }
    },
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: api.LessonPlanPatch }) => api.updateLessonPlan(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.lesson(id) })
      const prev = qc.getQueryData<api.LessonBundle>(keys.lesson(id))
      if (prev) qc.setQueryData<api.LessonBundle>(keys.lesson(id), { ...prev, plan: { ...prev.plan, ...patch } })
      // The lesson list changes at once too (its status dots).
      const prevList = qc.getQueryData<LessonPlan[]>(keys.lessonPlans(studentId))
      if (prevList) qc.setQueryData<LessonPlan[]>(keys.lessonPlans(studentId), prevList.map((p) => (p.id === id ? { ...p, ...patch } : p)))
      return { prev, prevList }
    },
    onError: (_e, { id }, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.lesson(id), ctx.prev)
      if (ctx?.prevList) qc.setQueryData(keys.lessonPlans(studentId), ctx.prevList)
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: keys.lesson(id) })
      invalidate()
    },
  })
  const remove = useMutation({ mutationFn: (id: string) => api.deleteLessonPlan(id), onSuccess: invalidate })
  return { create, createFromPositions, duplicate, update, remove }
}

/** The coach's recurring section titles, theme blocks and agenda items, most-used first. */
export function useLessonHistory() {
  return useQuery({ queryKey: keys.lessonHistory, queryFn: api.getLessonHistory })
}

export function useLessonTemplates() {
  return useQuery({ queryKey: keys.lessonTemplates, queryFn: api.listLessonTemplates })
}

export function useLessonTemplateMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.lessonTemplates })
  const create = useMutation({
    mutationFn: (template: Pick<LessonTemplate, 'name' | 'theme' | 'sections' | 'agenda'>) =>
      api.createLessonTemplate(template),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: (id: string) => api.deleteLessonTemplate(id), onSuccess: invalidate })
  return { create, remove }
}

// ---------------------------------------------------------------------------
// sections + puzzles (always scoped to one lesson so one invalidation covers both)
// ---------------------------------------------------------------------------

export function useLessonContentMutations(planId: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.lesson(planId) })
    qc.invalidateQueries({ queryKey: keys.lessonHistory })
  }

  const createSection = useMutation({
    mutationFn: (title: string) => api.createSection(planId, title),
    onSuccess: invalidate,
  })
  const updateSection = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<LessonSection, 'title' | 'sort_order'>> }) =>
      api.updateSection(id, patch),
    onSuccess: invalidate,
  })
  const deleteSection = useMutation({ mutationFn: (id: string) => api.deleteSection(id), onSuccess: invalidate })
  const createPuzzle = useMutation({
    mutationFn: ({ sectionId, initial }: { sectionId: string; initial?: api.PuzzlePatch }) =>
      api.createPuzzle(sectionId, initial),
    onSuccess: invalidate,
  })
  const deletePuzzle = useMutation({ mutationFn: (id: string) => api.deletePuzzle(id), onSuccess: invalidate })
  /** Move a position to the end of another section; the cards move at once and move back if the save fails. */
  const movePuzzle = useMutation({
    mutationFn: ({ puzzle, toSectionId, sortOrder }: { puzzle: Puzzle; toSectionId: string; sortOrder: number }) =>
      api.updatePuzzle(puzzle.id, { section_id: toSectionId, sort_order: sortOrder }),
    onMutate: async ({ puzzle, toSectionId, sortOrder }) => {
      const key = keys.lesson(planId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<api.LessonBundle>(key)
      if (prev) {
        const moved = { ...puzzle, section_id: toSectionId, sort_order: sortOrder }
        const bySection = Object.fromEntries(Object.entries(prev.puzzlesBySection).map(([sid, list]) => [sid, list.filter((p) => p.id !== puzzle.id)]))
        bySection[toSectionId] = [...(bySection[toSectionId] ?? []), moved]
        qc.setQueryData<api.LessonBundle>(key, { ...prev, puzzlesBySection: bySection })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.lesson(planId), ctx.prev),
    onSettled: (_d, _e, { puzzle }) => {
      invalidate()
      qc.invalidateQueries({ queryKey: keys.puzzle(puzzle.id) })
    },
  })
  /** A position's red / yellow / green dot; the card changes at once. */
  const setPuzzleStatus = useMutation({
    mutationFn: ({ puzzle, status }: { puzzle: Puzzle; status: LessonStatus }) => api.updatePuzzle(puzzle.id, { status }),
    onMutate: async ({ puzzle, status }) => {
      const key = keys.lesson(planId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<api.LessonBundle>(key)
      if (prev) {
        const list = (prev.puzzlesBySection[puzzle.section_id] ?? []).map((p) => (p.id === puzzle.id ? { ...p, status } : p))
        qc.setQueryData<api.LessonBundle>(key, { ...prev, puzzlesBySection: { ...prev.puzzlesBySection, [puzzle.section_id]: list } })
      }
      const one = qc.getQueryData<Puzzle>(keys.puzzle(puzzle.id))
      if (one) qc.setQueryData<Puzzle>(keys.puzzle(puzzle.id), { ...one, status })
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.lesson(planId), ctx.prev),
    onSettled: (_d, _e, { puzzle }) => {
      invalidate()
      qc.invalidateQueries({ queryKey: keys.puzzle(puzzle.id) })
    },
  })
  /**
   * Positions not got to, carried into a new lesson: numbered next, the same
   * title and theme, each position under a section of the same name, in
   * the order they were in.
   */
  const moveToNewLesson = useMutation({
    mutationFn: async ({ puzzles }: { puzzles: Puzzle[] }) => {
      const bundle = qc.getQueryData<api.LessonBundle>(keys.lesson(planId)) ?? (await api.getLessonBundle(planId))
      const { plan: source, sections } = bundle
      const plan = await api.createLessonPlan(source.student_id, { title: source.title, theme: source.theme })
      const moving = new Set(puzzles.map((p) => p.id))
      let order = 0
      for (const section of sections) {
        const here = (bundle.puzzlesBySection[section.id] ?? []).filter((p) => moving.has(p.id))
        if (here.length === 0) continue
        const created = await api.createSection(plan.id, section.title)
        for (const p of here) await api.updatePuzzle(p.id, { section_id: created.id, sort_order: order++ })
      }
      return plan
    },
    onSettled: (plan, _e, { puzzles }) => {
      invalidate()
      for (const p of puzzles) qc.invalidateQueries({ queryKey: keys.puzzle(p.id) })
      if (plan) {
        qc.invalidateQueries({ queryKey: keys.lessonPlans(plan.student_id) })
        qc.invalidateQueries({ queryKey: keys.folderCounts(plan.student_id) })
      }
    },
  })
  return { createSection, updateSection, deleteSection, createPuzzle, deletePuzzle, movePuzzle, setPuzzleStatus, moveToNewLesson }
}

export function useCustomPieceSetMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.pieceSets })
  const create = useMutation({
    mutationFn: ({ name, images }: { name: string; images: Record<string, string> }) =>
      api.createCustomPieceSet(name, images),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: (id: string) => api.deleteCustomPieceSet(id), onSuccess: invalidate })
  return { create, remove }
}

export function usePuzzle(puzzleId: string | undefined) {
  return useQuery({
    queryKey: keys.puzzle(puzzleId ?? ''),
    queryFn: () => api.getPuzzle(puzzleId!),
    enabled: Boolean(puzzleId),
  })
}

export function usePuzzleMutations(puzzleId: string, planId?: string) {
  const qc = useQueryClient()
  const key = ['puzzle', puzzleId]
  const update = useMutation({
    // One position's saves go one at a time, in the order they were made:
    // drawing marks quickly on a slow connection could otherwise land out
    // of order, and an older set of arrows overwrite a newer one.
    mutationKey: key,
    scope: { id: `puzzle-${puzzleId}` },
    mutationFn: (patch: api.PuzzlePatch) => api.updatePuzzle(puzzleId, patch),
    onMutate: async (patch) => {
      // A read already on its way would land after this change and wipe it.
      await qc.cancelQueries({ queryKey: keys.puzzle(puzzleId) })
      if (planId) await qc.cancelQueries({ queryKey: keys.lesson(planId) })
      const prev = qc.getQueryData<Puzzle>(keys.puzzle(puzzleId))
      if (prev) qc.setQueryData<Puzzle>(keys.puzzle(puzzleId), { ...prev, ...patch })
      // The lesson views read from the bundle, so patch the copy there as well.
      const prevBundle = planId ? qc.getQueryData<api.LessonBundle>(keys.lesson(planId)) : undefined
      if (planId && prevBundle) {
        qc.setQueryData<api.LessonBundle>(keys.lesson(planId), {
          ...prevBundle,
          puzzlesBySection: Object.fromEntries(
            Object.entries(prevBundle.puzzlesBySection).map(([sid, list]) => [
              sid,
              list.map((p) => (p.id === puzzleId ? { ...p, ...patch } : p)),
            ]),
          ),
        })
      }
      return { prev, prevBundle }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.puzzle(puzzleId), ctx.prev)
      if (planId && ctx?.prevBundle) qc.setQueryData(keys.lesson(planId), ctx.prevBundle)
    },
    onSettled: () => {
      // Re-read only after the last save in the queue: reading between two
      // saves brings back the server's copy without the newest marks, which
      // then vanish from the board for a moment (or for good).
      if (qc.isMutating({ mutationKey: key }) > 1) return
      qc.invalidateQueries({ queryKey: keys.puzzle(puzzleId) })
      if (planId) qc.invalidateQueries({ queryKey: keys.lesson(planId) })
    },
  })
  return { update }
}

// ---------------------------------------------------------------------------
// notes
// ---------------------------------------------------------------------------

export function useNotes(studentId: string | undefined, kind: Note['folder_kind']) {
  return useQuery({
    queryKey: keys.notes(studentId ?? '', kind),
    queryFn: () => api.listNotes(studentId!, kind),
    enabled: Boolean(studentId),
  })
}

export function useNoteMutations(studentId: string, kind: Note['folder_kind']) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.notes(studentId, kind) })
    qc.invalidateQueries({ queryKey: keys.folderCounts(studentId) })
  }
  const create = useMutation({ mutationFn: () => api.createNote(studentId, kind), onSuccess: invalidate })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Note, 'title' | 'body' | 'amount'>> }) =>
      api.updateNote(id, patch),
    onMutate: async ({ id, patch }) => {
      const key = keys.notes(studentId, kind)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Note[]>(key)
      qc.setQueryData<Note[]>(key, (old) => old?.map((n) => (n.id === id ? { ...n, ...patch } : n)))
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.notes(studentId, kind), ctx.prev),
    onSettled: invalidate,
  })
  const remove = useMutation({ mutationFn: (id: string) => api.deleteNote(id), onSuccess: invalidate })
  return { create, update, remove }
}


// ---------------------------------------------------------------------------
// schedule
// ---------------------------------------------------------------------------

/** Schedule tables the database still lacks (the 0009 migration not yet run). */
export function useScheduleMissing() {
  return useQuery({ queryKey: keys.scheduleMissing, queryFn: api.missingScheduleTables, staleTime: 60 * 60_000 })
}

export function useScheduleSlots(enabled = true) {
  return useQuery({ queryKey: keys.scheduleSlots, queryFn: api.listScheduleSlots, enabled, retry: 1 })
}

export function useScheduleChanges(enabled = true) {
  return useQuery({ queryKey: keys.scheduleChanges, queryFn: api.listScheduleChanges, enabled, retry: 1 })
}

export function useReminders(enabled = true) {
  return useQuery({ queryKey: keys.reminders, queryFn: api.listReminders, enabled, retry: 1 })
}

/** Whether 0012 (more door codes, each position's covered dot) is still to be run. */
export function useCodesMissing(enabled = true) {
  return useQuery({ queryKey: keys.codesMissing, queryFn: api.codesMigrationMissing, enabled, staleTime: 60 * 60_000 })
}

/** Whether the hourly-rate column is still to be added (migration 0010). */
export function useRateMissing(enabled = true) {
  return useQuery({ queryKey: keys.rateMissing, queryFn: api.rateColumnMissing, enabled, staleTime: 60 * 60_000 })
}

export function useStudentPlaces(enabled = true) {
  return useQuery({ queryKey: keys.places, queryFn: api.listStudentPlaces, enabled, retry: 1 })
}

// ---------------------------------------------------------------------------
// Schedule changes, made to work with no connection. Each kind has a key and
// its function registered on the client (registerOfflineMutations), so a
// change made offline is saved on the device with the cache and sent when
// the connection returns, even after the app was closed. The hooks below
// also show each change at once (an optimistic update) instead of waiting.
// ---------------------------------------------------------------------------

type ChangeVars = { input: api.ChangeInput; id?: string; studentName: string; slot: ScheduleSlot | null }
type SlotUpdateVars = { id: string; patch: Partial<api.SlotInput> }
type ReminderVars = { id: string; patch: api.ReminderPatch }
type PlaceVars = { studentId: string; patch: api.PlacePatch }
/** Which change to undo; the slot and date find it once a change made offline has its real id. */
export type UndoVars = { id: string; slot_id: string | null; original_date: string | null }

/** Temporary ids given to things made offline, until the server gives real ones. */
export const isPending = (id: string) => id.startsWith('pending-')
const pendingId = () => `pending-${Math.random().toString(36).slice(2, 10)}`

export const MUTATION_KEYS = {
  addSlot: ['schedule', 'addSlot'],
  updateSlot: ['schedule', 'updateSlot'],
  removeSlot: ['schedule', 'removeSlot'],
  change: ['schedule', 'change'],
  undo: ['schedule', 'undo'],
  updateReminder: ['schedule', 'updateReminder'],
  removeReminder: ['schedule', 'removeReminder'],
  savePlace: ['schedule', 'savePlace'],
  paid: ['payments', 'paid'],
  unpaid: ['payments', 'unpaid'],
} as const

/** What each change does on the server; shared by the hooks and by changes restored from the device. */
function mutationFns(qc: QueryClient) {
  return {
    addSlot: (input: api.SlotInput) => api.createScheduleSlot(input),
    // A slot or reminder made offline has no server id yet; its next sync replaces it.
    updateSlot: async ({ id, patch }: SlotUpdateVars) => (isPending(id) ? undefined : api.updateScheduleSlot(id, patch)),
    removeSlot: async (id: string) => (isPending(id) ? undefined : api.deleteScheduleSlot(id)),
    /**
     * A week's change and the reminder it writes, together. A lesson has one
     * change per date, so an earlier change to it is replaced, and that
     * change's open reminder goes (the new one says where things stand).
     */
    change: async ({ input, id, studentName, slot }: ChangeVars) => {
      const known = (qc.getQueryData<ScheduleChange[]>(keys.scheduleChanges) ?? []).filter((c) => !isPending(c.id))
      const realId = id && !isPending(id) ? id : undefined
      const replaced = realId
        ? known.find((c) => c.id === realId)
        : input.slot_id
          ? known.find((c) => c.slot_id === input.slot_id && c.original_date === input.original_date)
          : undefined
      const saved = await api.saveScheduleChange(input, replaced?.id ?? realId)
      const stale = (qc.getQueryData<Reminder[]>(keys.reminders) ?? []).filter((r) => r.change_id === saved.id && !r.done && !isPending(r.id))
      await Promise.all(stale.map((r) => api.deleteReminder(r.id)))
      const reminder = await api.createReminder({ ...reminderFor(saved, studentName, slot), change_id: saved.id })
      return { saved, reminder }
    },
    undo: async ({ id, slot_id, original_date }: UndoVars) => {
      if (!isPending(id)) return api.deleteScheduleChange(id)
      // Made offline too: by now it has synced (changes go in order), so find it by lesson and date.
      if (!slot_id) return
      const real = (await api.listScheduleChanges()).find((c) => c.slot_id === slot_id && c.original_date === original_date)
      if (real) await api.deleteScheduleChange(real.id)
    },
    updateReminder: async ({ id, patch }: ReminderVars) => (isPending(id) ? undefined : api.updateReminder(id, patch)),
    removeReminder: async (id: string) => (isPending(id) ? undefined : api.deleteReminder(id)),
    savePlace: ({ studentId, patch }: PlaceVars) => api.saveStudentPlace(studentId, patch),
    paid: (input: api.PaymentInput) => api.markPaid(input),
    unpaid: (lessonKey: string) => api.markUnpaid(lessonKey),
  }
}

/** Called once on the client: lets changes saved on the device send themselves later. */
export function registerOfflineMutations(qc: QueryClient) {
  const fns = mutationFns(qc)
  for (const name of Object.keys(MUTATION_KEYS) as (keyof typeof MUTATION_KEYS)[]) {
    qc.setMutationDefaults([...MUTATION_KEYS[name]], { mutationFn: fns[name] as (v: unknown) => Promise<unknown>, scope: { id: 'schedule' } })
  }
}

/** Schedule changes are sent one at a time, in the order they were made (an undo after its change). */
const IN_ORDER = { id: 'schedule' }

/** Change a cached list at once, and hand back the old one to undo it if the save fails. */
async function patchList<T>(qc: QueryClient, key: readonly unknown[], apply: (list: T[]) => T[]) {
  await qc.cancelQueries({ queryKey: key })
  const prev = qc.getQueryData<T[]>(key)
  qc.setQueryData<T[]>(key, (old) => apply(old ?? []))
  return { key, prev }
}
const restore = (qc: QueryClient) => (_e: unknown, _v: unknown, ctx?: { key: readonly unknown[]; prev?: unknown }[] | { key: readonly unknown[]; prev?: unknown }) => {
  for (const c of Array.isArray(ctx) ? ctx : ctx ? [ctx] : []) if (c.prev !== undefined) qc.setQueryData(c.key, c.prev)
}

export function useScheduleMutations() {
  const qc = useQueryClient()
  const fns = mutationFns(qc)
  const refresh = (...which: (keyof typeof keys)[]) => () =>
    Promise.all(which.map((k) => qc.invalidateQueries({ queryKey: keys[k] as readonly unknown[] })))
  const now = () => new Date().toISOString()

  const addSlot = useMutation({
    mutationKey: MUTATION_KEYS.addSlot,
    scope: IN_ORDER,
    mutationFn: fns.addSlot,
    onMutate: (input) =>
      patchList<ScheduleSlot>(qc, keys.scheduleSlots, (l) => [...l, { id: pendingId(), user_id: '', created_at: now(), ...input }]),
    onError: restore(qc),
    onSettled: refresh('scheduleSlots'),
  })
  const updateSlot = useMutation({
    mutationKey: MUTATION_KEYS.updateSlot,
    scope: IN_ORDER,
    mutationFn: fns.updateSlot,
    onMutate: ({ id, patch }) => patchList<ScheduleSlot>(qc, keys.scheduleSlots, (l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    onError: restore(qc),
    onSettled: refresh('scheduleSlots'),
  })
  const removeSlot = useMutation({
    mutationKey: MUTATION_KEYS.removeSlot,
    scope: IN_ORDER,
    mutationFn: fns.removeSlot,
    onMutate: async (id) => [
      await patchList<ScheduleSlot>(qc, keys.scheduleSlots, (l) => l.filter((x) => x.id !== id)),
      await patchList<ScheduleChange>(qc, keys.scheduleChanges, (l) => l.filter((c) => c.slot_id !== id)),
    ],
    onError: restore(qc),
    onSettled: refresh('scheduleSlots', 'scheduleChanges', 'reminders'),
  })

  const change = useMutation({
    mutationKey: MUTATION_KEYS.change,
    scope: IN_ORDER,
    mutationFn: fns.change,
    // The week shows the change and its reminder straight away, online or not.
    onMutate: async ({ input, id, studentName, slot }) => {
      const tempId = pendingId()
      let changeId = tempId
      const changes = await patchList<ScheduleChange>(qc, keys.scheduleChanges, (l) => {
        const at = l.findIndex((c) => (id ? c.id === id : input.slot_id !== null && c.slot_id === input.slot_id && c.original_date === input.original_date))
        if (at >= 0) {
          changeId = l[at].id
          return l.map((c, i) => (i === at ? { ...c, ...input } : c))
        }
        return [...l, { id: tempId, user_id: '', created_at: now(), ...input }]
      })
      const reminders = await patchList<Reminder>(qc, keys.reminders, (l) => [
        { id: pendingId(), user_id: '', change_id: changeId, done: false, shared_at: null, created_at: now(), ...reminderFor(input, studentName, slot) },
        ...l.filter((r) => !(r.change_id === changeId && !r.done)),
      ])
      return [changes, reminders]
    },
    onError: restore(qc),
    onSettled: refresh('scheduleChanges', 'reminders'),
  })
  /** Put the week back as usual; the change's reminders go with it. */
  const undo = useMutation({
    mutationKey: MUTATION_KEYS.undo,
    scope: IN_ORDER,
    mutationFn: fns.undo,
    onMutate: async ({ id }) => [
      await patchList<ScheduleChange>(qc, keys.scheduleChanges, (l) => l.filter((c) => c.id !== id)),
      await patchList<Reminder>(qc, keys.reminders, (l) => l.filter((r) => r.change_id !== id)),
    ],
    onError: restore(qc),
    onSettled: refresh('scheduleChanges', 'reminders'),
  })

  const updateReminder = useMutation({
    mutationKey: MUTATION_KEYS.updateReminder,
    scope: IN_ORDER,
    mutationFn: fns.updateReminder,
    onMutate: ({ id, patch }) => patchList<Reminder>(qc, keys.reminders, (l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    onError: restore(qc),
    onSettled: refresh('reminders'),
  })
  const removeReminder = useMutation({
    mutationKey: MUTATION_KEYS.removeReminder,
    scope: IN_ORDER,
    mutationFn: fns.removeReminder,
    onMutate: (id) => patchList<Reminder>(qc, keys.reminders, (l) => l.filter((r) => r.id !== id)),
    onError: restore(qc),
    onSettled: refresh('reminders'),
  })

  const savePlace = useMutation({
    mutationKey: MUTATION_KEYS.savePlace,
    scope: IN_ORDER,
    mutationFn: fns.savePlace,
    onMutate: ({ studentId, patch }) =>
      patchList<StudentPlace>(qc, keys.places, (l) => {
        const prev = l.find((p) => p.student_id === studentId)
        const blank = { address: '', door_code: '', bathroom_code: '', bathroom_note: '', notes: '', hourly_rate: null, extra_codes: [] }
        const next: StudentPlace = { ...blank, ...prev, ...patch, student_id: studentId, user_id: prev?.user_id ?? '', updated_at: now() }
        return [...l.filter((p) => p.student_id !== studentId), next]
      }),
    onError: restore(qc),
    onSettled: refresh('places'),
  })

  return { addSlot, updateSlot, removeSlot, change, undo, updateReminder, removeReminder, savePlace }
}

/** Open reminders, for the badge on the Schedule button. 0 before the schedule migration has run. */
export function useOpenReminderCount(): number {
  const missing = useScheduleMissing()
  const ready = Boolean(missing.data && missing.data.length === 0)
  const reminders = useReminders(ready)
  return (reminders.data ?? []).filter((r) => !r.done).length
}

/** Whether the paid-lessons table is still to be added (migration 0011). */
export function usePaymentsMissing(enabled = true) {
  return useQuery({ queryKey: keys.paymentsMissing, queryFn: api.paymentsTableMissing, enabled, staleTime: 60 * 60_000 })
}

export function usePayments(enabled = true) {
  return useQuery({ queryKey: keys.payments, queryFn: api.listPayments, enabled, retry: 1 })
}

/** Mark a lesson paid or not; the tick shows at once (online or not) and rolls back if the save fails. */
export function usePaymentMutations() {
  const qc = useQueryClient()
  const fns = mutationFns(qc)
  const settle = () => qc.invalidateQueries({ queryKey: keys.payments })
  const paid = useMutation({
    mutationKey: MUTATION_KEYS.paid,
    scope: IN_ORDER,
    mutationFn: fns.paid,
    onMutate: (input) =>
      patchList<LessonPayment>(qc, keys.payments, (list) => [
        ...list.filter((p) => p.lesson_key !== input.lesson_key),
        { id: `pending-${input.lesson_key}`, user_id: '', paid_on: new Date().toISOString().slice(0, 10), created_at: '', ...input },
      ]),
    onError: restore(qc),
    onSettled: settle,
  })
  const unpaid = useMutation({
    mutationKey: MUTATION_KEYS.unpaid,
    scope: IN_ORDER,
    mutationFn: fns.unpaid,
    onMutate: (lessonKey) => patchList<LessonPayment>(qc, keys.payments, (list) => list.filter((p) => p.lesson_key !== lessonKey)),
    onError: restore(qc),
    onSettled: settle,
  })
  return { paid, unpaid }
}

export type { FolderKind }
