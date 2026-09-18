import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createSection, getLessonPlan, listSections, updateLessonPlan } from '../lib/api'
import type { LessonPlan, LessonSection } from '../types/domain'
import { AgendaEditor } from '../components/lessons/AgendaEditor'
import { SectionBlock } from '../components/lessons/SectionBlock'

export function LessonPlanDetailPage() {
  const { studentId, lessonPlanId } = useParams<{ studentId: string; lessonPlanId: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<LessonPlan | null>(null)
  const [sections, setSections] = useState<LessonSection[] | null>(null)

  useEffect(() => {
    if (!lessonPlanId) return
    getLessonPlan(lessonPlanId).then(setPlan)
    listSections(lessonPlanId).then(setSections)
  }, [lessonPlanId])

  async function saveTitle(title: string) {
    if (!plan) return
    setPlan({ ...plan, title })
    await updateLessonPlan(plan.id, { title })
  }

  async function saveAgenda(agenda: string[]) {
    if (!plan) return
    setPlan({ ...plan, agenda })
    await updateLessonPlan(plan.id, { agenda })
  }

  async function handleAddSection() {
    if (!lessonPlanId) return
    const section = await createSection(lessonPlanId, '')
    setSections((prev) => [...(prev ?? []), section])
  }

  function refreshSections() {
    if (!lessonPlanId) return
    listSections(lessonPlanId).then(setSections)
  }

  if (!plan) return null

  return (
    <div className="mx-auto min-h-svh max-w-3xl px-6 py-10">
      <button
        onClick={() => navigate(`/students/${studentId}/lessons`)}
        className="mb-6 text-xs text-ink-400 hover:text-ink-100"
      >
        ← Back to plans
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <input
          value={plan.title}
          onChange={(e) => setPlan({ ...plan, title: e.target.value })}
          onBlur={(e) => saveTitle(e.target.value)}
          placeholder={`Lesson Plan ${plan.number}`}
          className="font-marker w-full max-w-md bg-transparent text-3xl text-gold-500 outline-none sm:w-auto"
        />
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/students/${studentId}/lessons/${plan.id}/coach`)}
            className="rounded-lg border border-ink-600 px-3 py-2 text-sm font-medium text-ink-100 hover:border-gold-500 hover:text-gold-400"
          >
            Coach's View
          </button>
          <button
            onClick={() => navigate(`/students/${studentId}/lessons/${plan.id}/present`)}
            className="rounded-lg bg-gold-500 px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-gold-400"
          >
            Present to student
          </button>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-ink-800 bg-ink-900/50 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Agenda</h2>
        <AgendaEditor items={plan.agenda} onChange={saveAgenda} />
      </div>

      <div className="space-y-4">
        {sections?.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            onOpenPuzzle={(puzzleId) =>
              navigate(`/students/${studentId}/lessons/${plan.id}/puzzles/${puzzleId}`)
            }
            onDeleted={refreshSections}
          />
        ))}
        <button
          onClick={handleAddSection}
          className="w-full rounded-xl border-2 border-dashed border-ink-700 py-3 text-sm text-ink-400 hover:border-gold-600/60 hover:text-gold-400"
        >
          + Add section
        </button>
      </div>
    </div>
  )
}
