import { useParams } from 'react-router-dom'
import { FOLDER_KINDS } from '../types/domain'
import { useFolderCounts, useStudent } from '../lib/queries'
import { FOLDER_COLORS } from '../lib/colors'
import { FolderBody, FolderTab, HangingFile } from '../components/lesson/Folder'
import { Page, LoadingPage } from '../components/ui/Page'
import { Folder } from '../components/ui/Icons'

/** The student's folder, opened: one hanging file per sub-folder inside it. */
export function StudentPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { data: student, isLoading } = useStudent(studentId)
  const { data: counts } = useFolderCounts(studentId)

  if (isLoading && !student) return <LoadingPage />
  if (!student) return <Page back="/">Student not found.</Page>

  // The files take the palette in order, skipping the folder's own colour.
  const palette = FOLDER_COLORS.filter((c) => c !== student.color)

  return (
    <Page back="/" className="pt-6">
      <FolderTab color={student.color} name={student.name} aside="Student folder" />
      <FolderBody color={student.color} className="pb-5">
        <div
          className="divider-paper -mx-3 rounded-t-2xl bg-paper px-3 pt-5 pb-6 sm:-mx-5 sm:px-5"
          style={{ borderLeft: `10px solid ${palette[0]}` }}
        >
          <h1 className="mb-4 font-display text-[28px] leading-none font-bold text-ink sm:text-[32px]">{student.name}</h1>
          <div className="space-y-4">
            {FOLDER_KINDS.map((f, i) => (
              <HangingFile
                key={f.kind}
                to={f.kind === 'lesson_plan' ? `/students/${student.id}/lessons` : `/students/${student.id}/notes/${f.kind}`}
                color={palette[(i + 1) % palette.length]}
                label={f.label}
                count={counts?.[f.kind]}
                icon={<Folder size={14} />}
              />
            ))}
          </div>
        </div>
      </FolderBody>
    </Page>
  )
}
