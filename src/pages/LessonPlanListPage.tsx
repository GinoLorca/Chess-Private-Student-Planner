import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { LessonPlan } from '../types/domain'
import { useLessonPlanMutations, useLessonPlans, useStudent } from '../lib/queries'
import { Page, LoadingPage } from '../components/ui/Page'
import { Button, IconButton } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Plus } from '../components/ui/Icons'
import { FenSheet } from '../components/lesson/FenSheet'
import { DividerPaper, FolderBody, FolderTab, LessonCard } from '../components/lesson/Folder'
import { FOLDER_COLORS } from '../lib/colors'

export function LessonPlanListPage() {
  const { studentId = '' } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { data: student } = useStudent(studentId)
  const { data: plans, isLoading } = useLessonPlans(studentId)
  const { createFromPositions, remove } = useLessonPlanMutations(studentId)
  const [deleting, setDeleting] = useState<LessonPlan | null>(null)
  const [creating, setCreating] = useState(false)


  if (isLoading && !plans) return <LoadingPage />

  const folderColor = student?.color ?? FOLDER_COLORS[0]
  const dividerColor = FOLDER_COLORS.filter((c) => c !== folderColor)[0]

  return (
    <Page
      back={`/students/${studentId}`}
      width="wide"
      className="pt-6"
      actions={
        <IconButton label="New lesson plan" onClick={() => setCreating(true)} disabled={createFromPositions.isPending}>
          <Plus />
        </IconButton>
      }
    >
      <FolderTab color={folderColor} name={student?.name ?? 'Student'} aside="Lesson plans" />
      <FolderBody color={folderColor} className="pb-5">
        <DividerPaper color={dividerColor}>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h1 className="font-display text-[28px] leading-none font-bold text-ink sm:text-[32px]">Lesson plans</h1>
            <span className="text-[13px] font-semibold text-ink-3 tabular-nums">{plans?.length ?? 0}</span>
          </div>
          {/* minmax(0, 1fr) columns: a long title must never widen the card past the folder. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {plans?.map((plan) => (
              <LessonCard
                key={plan.id}
                number={plan.number}
                title={plan.title}
                theme={plan.theme}
                status={plan.status}
                taughtOn={plan.taught_on}
                to={`/students/${studentId}/lessons/${plan.id}`}
                onDelete={() => setDeleting(plan)}
              />
            ))}
            <div className="add-slot flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong p-4 text-center">
              <Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreating(true)} disabled={createFromPositions.isPending}>
                New lesson plan
              </Button>
              {plans && plans.length === 0 && (
                <p className="max-w-xs text-[13px] text-ink-3">
                  A plan is one session: themed sections of positions, with the answers and your notes.
                </p>
              )}
            </div>
          </div>
        </DividerPaper>
      </FolderBody>

      <FenSheet
        open={creating}
        title="New lesson"
        submitLabel={(n) => (n === 0 ? 'Create empty lesson' : `Create lesson · ${n} position${n === 1 ? '' : 's'}`)}
        onClose={() => setCreating(false)}
        onSubmit={async (positions) => {
          const plan = await createFromPositions.mutateAsync(positions)
          // Straight into annotating; an empty lesson opens as a folder.
          navigate(`/students/${studentId}/lessons/${plan.id}${positions.length ? '/annotate' : ''}`)
        }}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete Lesson ${deleting?.number ?? ''}?`}
        body="Every section and position in it goes too."
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id)
        }}
      />
    </Page>
  )
}
