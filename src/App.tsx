import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { PieceSetProvider } from './state/PieceSetContext'
import { AppearanceProvider, QueryProvider } from './app/providers'
import { LoadingPage } from './components/ui/Page'

// Each screen loads on demand so the first paint on an iPad only pulls the
// student list, not the editor and its drag-and-drop machinery.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const StudentPage = lazy(() => import('./pages/StudentPage').then((m) => ({ default: m.StudentPage })))
const NotesPage = lazy(() => import('./pages/NotesPage').then((m) => ({ default: m.NotesPage })))
const LessonPlanListPage = lazy(() =>
  import('./pages/LessonPlanListPage').then((m) => ({ default: m.LessonPlanListPage })),
)
const LessonPlanDetailPage = lazy(() =>
  import('./pages/LessonPlanDetailPage').then((m) => ({ default: m.LessonPlanDetailPage })),
)
const PuzzlePage = lazy(() => import('./pages/PuzzlePage').then((m) => ({ default: m.PuzzlePage })))
const PuzzleEditorPage = lazy(() => import('./pages/PuzzleEditorPage').then((m) => ({ default: m.PuzzleEditorPage })))
const PuzzleStudyPage = lazy(() => import('./pages/PuzzleStudyPage').then((m) => ({ default: m.PuzzleStudyPage })))
const ViewerPage = lazy(() => import('./pages/ViewerPage').then((m) => ({ default: m.ViewerPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const lesson = '/students/:studentId/lessons/:lessonPlanId'

function App() {
  return (
    <AppearanceProvider>
      <QueryProvider>
        <AuthProvider>
          <ProtectedRoute>
            <PieceSetProvider>
              <HashRouter>
                <Suspense fallback={<LoadingPage />}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/students/:studentId" element={<StudentPage />} />
                    <Route path="/students/:studentId/notes/:folderKind" element={<NotesPage />} />
                    <Route path="/students/:studentId/lessons" element={<LessonPlanListPage />} />
                    <Route path={lesson} element={<LessonPlanDetailPage />} />
                    <Route path={`${lesson}/puzzles/:puzzleId`} element={<PuzzlePage />} />
                    <Route path={`${lesson}/puzzles/:puzzleId/edit`} element={<PuzzleEditorPage />} />
                    <Route path={`${lesson}/puzzles/:puzzleId/study`} element={<PuzzleStudyPage />} />
                    <Route path={`${lesson}/present`} element={<ViewerPage mode="present" />} />
                    <Route path={`${lesson}/coach`} element={<ViewerPage mode="coach" />} />
                  </Routes>
                </Suspense>
              </HashRouter>
            </PieceSetProvider>
          </ProtectedRoute>
        </AuthProvider>
      </QueryProvider>
    </AppearanceProvider>
  )
}

export default App
