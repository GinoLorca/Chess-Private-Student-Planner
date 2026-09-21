import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './data'
import type { FolderKind, LessonPlan, LessonSection, Note, Puzzle, Student } from '../types/domain'

export const keys = {
  students: ['students'] as const,
  folderCounts: (studentId: string) => ['folderCounts', studentId] as const,
  lessonPlans: (studentId: string) => ['lessonPlans', studentId] as const,
  lesson: (planId: string) => ['lesson', planId] as const,
  puzzle: (puzzleId: string) => ['puzzle', puzzleId] as const,
  notes: (studentId: string, kind: Note['folder_kind']) => ['notes', studentId, kind] as const,
  settings: ['settings'] as const,
  pieceSets: ['pieceSets'] as const,
}

// ---------------------------------------------------------------------------
// students
// ---------------------------------------------------------------------------

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
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Student, 'name' | 'color' | 'sort_order'>> }) =>
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
  }
  const create = useMutation({
    mutationFn: (title: string) => api.createLessonPlan(studentId, title),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<LessonPlan, 'title' | 'agenda' | 'theme'>> }) =>
      api.updateLessonPlan(id, patch),
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
  return { create, update, remove }
}

// ---------------------------------------------------------------------------
// sections + puzzles (always scoped to one lesson so one invalidation covers both)
// ---------------------------------------------------------------------------

export function useLessonContentMutations(planId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.lesson(planId) })

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
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.puzzle(puzzleId), ctx.prev),
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

export type { FolderKind }
