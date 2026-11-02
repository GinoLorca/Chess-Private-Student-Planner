import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LessonPlan, Student } from '../../types/domain'
import { ActionSheet } from '../ui/ActionSheet'
import { Eye, Plus, Recycle, Trash } from '../ui/Icons'
import { useLessonPlanMutations, useStudents } from '../../lib/queries'

/** What happened, for the page to say, with where to go to see it. */
export interface LessonMenuNote {
  text: string
  to?: string
}

/**
 * A lesson's menu where lessons are listed (right-click or hold its card):
 * open it, recycle it for another student (the whole lesson, its sections
 * and positions with everything on them, as that student's next lesson),
 * duplicate it as this folder's next lesson, or delete it. The same
 * recycling as the ⋯ menu inside the lesson.
 */
export function LessonMenu({
  plan,
  folder,
  onClose,
  onDelete,
  onNote,
}: {
  /** The lesson the menu is open for; none, closed. */
  plan: LessonPlan | null
  /** The folder it's in: a student's or a Teach folder. */
  folder: Student | undefined
  onClose: () => void
  /** Given, the menu offers Delete (the page asks to confirm). */
  onDelete?: (plan: LessonPlan) => void
  onNote: (note: LessonMenuNote) => void
}) {
  const navigate = useNavigate()
  // Private folders stay out, and Teach folders: a student's lesson goes to Teach through Send to Teach.
  const { data: students = [] } = useStudents()
  const others = students.filter((s) => s.id !== folder?.id)
  const { duplicate } = useLessonPlanMutations(folder?.id ?? '')
  const [recycling, setRecycling] = useState<LessonPlan | null>(null)

  const base = `/students/${folder?.id}/lessons`
  const failed = (what: string) => (e: unknown) => onNote({ text: `Couldn't ${what}: ${e instanceof Error ? e.message : String(e)}` })
  return (
    <>
      <ActionSheet
        open={Boolean(plan)}
        onClose={onClose}
        title={plan ? `Lesson ${plan.number}${plan.title ? ` · ${plan.title}` : ''}` : 'Lesson'}
        items={
          plan
            ? [
                { label: 'Open', icon: <Eye />, onSelect: () => navigate(`${base}/${plan.id}`) },
                ...(others.length > 0 ? [{ label: 'Recycle for another student…', icon: <Recycle />, onSelect: () => setRecycling(plan) }] : []),
                {
                  label: 'Duplicate as next lesson',
                  icon: <Plus />,
                  onSelect: () =>
                    duplicate
                      .mutateAsync({ planId: plan.id })
                      .then((copy) => onNote({ text: `Lesson ${plan.number} duplicated as Lesson ${copy.number}.`, to: `${base}/${copy.id}` }))
                      .catch(failed('duplicate it')),
                },
                ...(onDelete ? [{ label: 'Delete', icon: <Trash />, danger: true, onSelect: () => onDelete(plan) }] : []),
              ]
            : []
        }
      />
      {/* The whole lesson, positions and annotations included, becomes that student's next lesson. */}
      <ActionSheet
        open={Boolean(recycling)}
        onClose={() => setRecycling(null)}
        title={`Recycle Lesson ${recycling?.number ?? ''} for…`}
        items={others.map((s) => ({
          label: s.name,
          icon: <Recycle />,
          onSelect: () => {
            if (!recycling) return
            duplicate
              .mutateAsync({ planId: recycling.id, studentId: s.id })
              .then((copy) => onNote({ text: `Lesson ${recycling.number} recycled to ${s.name} as Lesson ${copy.number}.`, to: `/students/${s.id}/lessons/${copy.id}` }))
              .catch(failed('recycle it'))
          },
        }))}
      />
    </>
  )
}
