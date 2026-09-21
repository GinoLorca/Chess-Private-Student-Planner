import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { LessonPlan } from '../types/domain'
import { useLessonPlanMutations, useLessonPlans, useStudent } from '../lib/queries'
import { Page, Card, EmptyState, LoadingPage } from '../components/ui/Page'
import { Button, IconButton } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ChevronRight, Plus, Trash } from '../components/ui/Icons'

export function LessonPlanListPage() {
  const { studentId = '' } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { data: student } = useStudent(studentId)
  const { data: plans, isLoading } = useLessonPlans(studentId)
  const { create, remove } = useLessonPlanMutations(studentId)
  const [deleting, setDeleting] = useState<LessonPlan | null>(null)

  async function addPlan() {
    const plan = await create.mutateAsync('')
    navigate(`/students/${studentId}/lessons/${plan.id}`)
  }

  if (isLoading && !plans) return <LoadingPage />

  return (
    <Page
      back={`/students/${studentId}`}
      eyebrow={student?.name}
      title="Lesson plans"
      actions={
        <IconButton label="New lesson plan" onClick={addPlan} disabled={create.isPending}>
          <Plus />
        </IconButton>
      }
    >
      {plans && plans.length === 0 ? (
        <EmptyState
          title="No lesson plans yet"
          body="A plan is one session: themed sections of positions, with the answers and your notes."
          action={
            <Button variant="primary" icon={<Plus size={18} />} onClick={addPlan}>
              New lesson plan
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {plans?.map((plan, i) => (
            <div
              key={plan.id}
              className={`flex items-center transition active:bg-surface-2 ${i > 0 ? 'border-t border-line' : ''}`}
            >
              <Link
                to={`/students/${studentId}/lessons/${plan.id}`}
                className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-[15px] font-bold text-accent-strong tabular-nums">
                  {plan.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-ink">Lesson {plan.number}</span>
                  {plan.title && <span className="block truncate text-[14px] text-ink-2">{plan.title}</span>}
                </span>
                <ChevronRight className="shrink-0 text-ink-3" />
              </Link>
              <IconButton label="Delete lesson" className="mr-1 text-ink-3" onClick={() => setDeleting(plan)}>
                <Trash size={18} />
              </IconButton>
            </div>
          ))}
        </Card>
      )}

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
