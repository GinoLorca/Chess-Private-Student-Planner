import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './data'
import type { FolderKind, LessonSection, LessonTemplate, NewLessonInit, Note, Puzzle, Reminder, ScheduleChange, ScheduleSlot, Student } from '../types/domain'
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
      return { prev }
    },
    onError: (_e, { id }, ctx) => ctx?.prev && qc.setQueryData(keys.lesson(id), ctx.prev),
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
  return { createSection, updateSection, deleteSection, createPuzzle, deletePuzzle }
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
  const update = useMutation({
    mutationFn: (patch: api.PuzzlePatch) => api.updatePuzzle(puzzleId, patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: keys.puzzle(puzzleId) })
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

export function useStudentPlaces(enabled = true) {
  return useQuery({ queryKey: keys.places, queryFn: api.listStudentPlaces, enabled, retry: 1 })
}

export function useScheduleMutations() {
  const qc = useQueryClient()
  const refresh = (...which: (keyof typeof keys)[]) => () =>
    Promise.all(which.map((k) => qc.invalidateQueries({ queryKey: keys[k] as readonly unknown[] })))

  const addSlot = useMutation({ mutationFn: (input: api.SlotInput) => api.createScheduleSlot(input), onSuccess: refresh('scheduleSlots') })
  const updateSlot = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<api.SlotInput> }) => api.updateScheduleSlot(id, patch),
    onSuccess: refresh('scheduleSlots'),
  })
  const removeSlot = useMutation({
    mutationFn: (id: string) => api.deleteScheduleSlot(id),
    onSuccess: refresh('scheduleSlots', 'scheduleChanges', 'reminders'),
  })

  /**
   * A week's change and the reminder it writes, together. A lesson has one
   * change per date, so an earlier change to it is replaced, and that
   * change's open reminder goes (the new one says where things stand).
   */
  const change = useMutation({
    mutationFn: async ({ input, id, studentName, slot }: { input: api.ChangeInput; id?: string; studentName: string; slot: ScheduleSlot | null }) => {
      const known = qc.getQueryData<ScheduleChange[]>(keys.scheduleChanges) ?? []
      const replaced = id
        ? known.find((c) => c.id === id)
        : input.slot_id
          ? known.find((c) => c.slot_id === input.slot_id && c.original_date === input.original_date)
          : undefined
      const saved = await api.saveScheduleChange(input, replaced?.id ?? id)
      const stale = (qc.getQueryData<Reminder[]>(keys.reminders) ?? []).filter((r) => r.change_id === saved.id && !r.done)
      await Promise.all(stale.map((r) => api.deleteReminder(r.id)))
      const reminder = await api.createReminder({ ...reminderFor(saved, studentName, slot), change_id: saved.id })
      return { saved, reminder }
    },
    onSettled: refresh('scheduleChanges', 'reminders'),
  })
  /** Put the week back as usual; the change's reminders go with it. */
  const undo = useMutation({ mutationFn: (id: string) => api.deleteScheduleChange(id), onSettled: refresh('scheduleChanges', 'reminders') })

  const updateReminder = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: api.ReminderPatch }) => api.updateReminder(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.reminders })
      const prev = qc.getQueryData<Reminder[]>(keys.reminders)
      qc.setQueryData<Reminder[]>(keys.reminders, (old) => old?.map((r) => (r.id === id ? { ...r, ...patch } : r)))
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.reminders, ctx.prev),
    onSettled: refresh('reminders'),
  })
  const removeReminder = useMutation({ mutationFn: (id: string) => api.deleteReminder(id), onSettled: refresh('reminders') })

  const savePlace = useMutation({
    mutationFn: ({ studentId, patch }: { studentId: string; patch: api.PlacePatch }) => api.saveStudentPlace(studentId, patch),
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

export type { FolderKind }
