import { Link, useParams } from 'react-router-dom'
import { FOLDER_KINDS } from '../types/domain'
import { useFolderCounts, useStudent } from '../lib/queries'
import { Page, Card, LoadingPage } from '../components/ui/Page'
import { ChevronRight, Folder } from '../components/ui/Icons'

export function StudentPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { data: student, isLoading } = useStudent(studentId)
  const { data: counts } = useFolderCounts(studentId)

  if (isLoading && !student) return <LoadingPage />
  if (!student) return <Page back="/">Student not found.</Page>

  return (
    <Page back="/" eyebrow="Student folder" title={student.name}>
      <Card className="overflow-hidden">
        {FOLDER_KINDS.map((f, i) => {
          const to = f.kind === 'lesson_plan' ? `/students/${student.id}/lessons` : `/students/${student.id}/notes/${f.kind}`
          const count = counts?.[f.kind]
          return (
            <Link
              key={f.kind}
              to={to}
              className={`flex h-16 items-center gap-3.5 px-4 transition active:bg-surface-2 ${i > 0 ? 'border-t border-line' : ''}`}
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-xl text-black/70"
                style={{ background: student.color }}
              >
                <Folder size={18} />
              </span>
              <span className="flex-1 text-[17px] font-semibold text-ink">{f.label}</span>
              {count !== undefined && (
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] font-semibold text-ink-2 tabular-nums">
                  {count}
                </span>
              )}
              <ChevronRight className="text-ink-3" />
            </Link>
          )
        })}
      </Card>
    </Page>
  )
}
