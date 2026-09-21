import * as real from './api'
import * as demo from './demo/demoApi'
import { isDemo } from './supabase'

// One import path for every screen. Demo mode (VITE_DEMO=1) swaps the whole
// backend for the in-memory store; nothing else in the app knows the difference.
const impl: typeof real = isDemo ? demo : real

export const listStudents = impl.listStudents
export const createStudent = impl.createStudent
export const updateStudent = impl.updateStudent
export const deleteStudent = impl.deleteStudent
export const getFolderCounts = impl.getFolderCounts
export const listLessonPlans = impl.listLessonPlans
export const getLessonPlan = impl.getLessonPlan
export const createLessonPlan = impl.createLessonPlan
export const updateLessonPlan = impl.updateLessonPlan
export const deleteLessonPlan = impl.deleteLessonPlan
export const listSections = impl.listSections
export const createSection = impl.createSection
export const updateSection = impl.updateSection
export const deleteSection = impl.deleteSection
export const listAllPuzzleIds = impl.listAllPuzzleIds
export const getLessonBundle = impl.getLessonBundle
export const listPuzzles = impl.listPuzzles
export const getPuzzle = impl.getPuzzle
export const createPuzzle = impl.createPuzzle
export const updatePuzzle = impl.updatePuzzle
export const deletePuzzle = impl.deletePuzzle
export const listNotes = impl.listNotes
export const createNote = impl.createNote
export const updateNote = impl.updateNote
export const deleteNote = impl.deleteNote
export const getUserSettings = impl.getUserSettings
export const updateUserSettings = impl.updateUserSettings
export const listCustomPieceSets = impl.listCustomPieceSets
export const createCustomPieceSet = impl.createCustomPieceSet
export const deleteCustomPieceSet = impl.deleteCustomPieceSet

export type { LessonBundle, PuzzlePatch, SettingsPatch } from './api'
