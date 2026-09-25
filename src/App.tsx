import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { PieceSetProvider } from './state/PieceSetContext'
import { AppearanceProvider, QueryProvider } from './app/providers'
import { LoadingPage } from './components/ui/Page'
import { OfflineBar } from './components/ui/OfflineBar'
import { Prefetcher } from './app/Prefetcher'
import { PullToRefresh } from './components/ui/PullToRefresh'

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
const AnnotatePage = lazy(() => import('./pages/AnnotatePage').then((m) => ({ default: m.AnnotatePage })))
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })))
const PuzzleLinkPage = lazy(() => import('./pages/PuzzleLinkPage').then((m) => ({ default: m.PuzzleLinkPage })))
const LessonViewPage = lazy(() => import('./pages/LessonViewPage').then((m) => ({ default: m.LessonViewPage })))
const LessonSheetPage = lazy(() => import('./pages/LessonSheetPage').then((m) => ({ default: m.LessonSheetPage })))
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
                <OfflineBar />
                <Prefetcher />
                <PullToRefresh>
                <Suspense fallback={<LoadingPage />}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/library" element={<LibraryPage />} />
                    <Route path="/p/:puzzleId" element={<PuzzleLinkPage />} />
                    <Route path="/students/:studentId" element={<StudentPage />} />
                    <Route path="/students/:studentId/notes/:folderKind" element={<NotesPage />} />
                    <Route path="/students/:studentId/lessons" element={<LessonPlanListPage />} />
                    <Route path={lesson} element={<LessonPlanDetailPage />} />
                    <Route path={`${lesson}/annotate`} element={<AnnotatePage />} />
                    <Route path={`${lesson}/puzzles/:puzzleId`} element={<PuzzlePage />} />
                    <Route path={`${lesson}/puzzles/:puzzleId/edit`} element={<PuzzleEditorPage />} />
                    <Route path={`${lesson}/present`} element={<LessonViewPage mode="present" />} />
                    <Route path={`${lesson}/coach`} element={<LessonViewPage mode="coach" />} />
                    <Route path={`${lesson}/learn`} element={<LessonViewPage mode="learn" />} />
                    <Route path={`${lesson}/sheet`} element={<LessonSheetPage />} />
                  </Routes>
                </Suspense>
                </PullToRefresh>
              </HashRouter>
            </PieceSetProvider>
          </ProtectedRoute>
        </AuthProvider>
      </QueryProvider>
    </AppearanceProvider>
  )
}

export default App
