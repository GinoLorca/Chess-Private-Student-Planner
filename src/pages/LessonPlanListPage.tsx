import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { LessonPlan } from '../types/domain'
import { useLessonPlanMutations, useLessonPlans, useStudent } from '../lib/queries'
import { Page, Card, EmptyState, LoadingPage } from '../components/ui/Page'
import { Button, IconButton } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ChevronRight, Plus, Trash } from '../components/ui/Icons'
import { NewLessonSheet } from '../components/lesson/NewLessonSheet'
import { StatusPill } from '../components/lesson/StatusPill'

export function LessonPlanListPage() {
  const { studentId = '' } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { data: student } = useStudent(studentId)
  const { data: plans, isLoading } = useLessonPlans(studentId)
  const { create, duplicate, remove } = useLessonPlanMutations(studentId)
  const [deleting, setDeleting] = useState<LessonPlan | null>(null)
  const [creating, setCreating] = useState(false)

  function open(plan: LessonPlan) {
    navigate(`/students/${studentId}/lessons/${plan.id}`)
  }

  if (isLoading && !plans) return <LoadingPage />

  return (
    <Page
      back={`/students/${studentId}`}
      eyebrow={student?.name}
      title="Lesson plans"
      actions={
        <IconButton label="New lesson plan" onClick={() => setCreating(true)} disabled={create.isPending}>
          <Plus />
        </IconButton>
      }
    >
      {plans && plans.length === 0 ? (
        <EmptyState
          title="No lesson plans yet"
          body="A plan is one session: themed sections of positions, with the answers and your notes."
          action={
            <Button variant="primary" icon={<Plus size={18} />} onClick={() => setCreating(true)}>
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
                  <span className="block text-[16px] font-semibold text-ink">
                    Lesson {plan.number}
                    {plan.title && <span className="font-normal text-ink-2"> · {plan.title}</span>}
                  </span>
                  {(plan.theme || plan.taught_on) && (
                    <span className="block truncate text-[13px] text-ink-3">
                      {[plan.theme, plan.taught_on ? `Taught ${formatDate(plan.taught_on)}` : ''].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <StatusPill status={plan.status} size="sm" />
                <ChevronRight className="shrink-0 text-ink-3" />
              </Link>
              <IconButton label="Delete lesson" className="mr-1 text-ink-3" onClick={() => setDeleting(plan)}>
                <Trash size={18} />
              </IconButton>
            </div>
          ))}
        </Card>
      )}

      <NewLessonSheet
        open={creating}
        plans={plans ?? []}
        onClose={() => setCreating(false)}
        onCreate={async (init) => open(await create.mutateAsync(init))}
        onDuplicate={async (planId) => open(await duplicate.mutateAsync(planId))}
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

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
