import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { PieceSetProvider } from './state/PieceSetContext'
import { DashboardPage } from './pages/DashboardPage'
import { StudentPage } from './pages/StudentPage'
import { NotesPage } from './pages/NotesPage'
import { LessonPlanListPage } from './pages/LessonPlanListPage'
import { LessonPlanDetailPage } from './pages/LessonPlanDetailPage'
import { PuzzleEditorPage } from './pages/PuzzleEditorPage'
import { ViewerPage } from './pages/ViewerPage'
import { SettingsPage } from './pages/SettingsPage'
import { PuzzleStudyPage } from './pages/PuzzleStudyPage'

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <PieceSetProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/students/:studentId" element={<StudentPage />} />
              <Route path="/students/:studentId/notes/:folderKind" element={<NotesPage />} />
              <Route path="/students/:studentId/lessons" element={<LessonPlanListPage />} />
              <Route path="/students/:studentId/lessons/:lessonPlanId" element={<LessonPlanDetailPage />} />
              <Route
                path="/students/:studentId/lessons/:lessonPlanId/puzzles/:puzzleId"
                element={<PuzzleEditorPage />}
              />
              <Route
                path="/students/:studentId/lessons/:lessonPlanId/puzzles/:puzzleId/study"
                element={<PuzzleStudyPage />}
              />
              <Route
                path="/students/:studentId/lessons/:lessonPlanId/present"
                element={<ViewerPage mode="present" />}
              />
              <Route
                path="/students/:studentId/lessons/:lessonPlanId/coach"
                element={<ViewerPage mode="coach" />}
              />
            </Routes>
          </HashRouter>
        </PieceSetProvider>
      </ProtectedRoute>
    </AuthProvider>
  )
}

export default App
