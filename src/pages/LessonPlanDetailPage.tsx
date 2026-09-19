import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createSection, getLessonPlan, listAllPuzzleIds, listSections, updateLessonPlan } from '../lib/api'
import type { LessonPlan, LessonSection } from '../types/domain'
import { AgendaEditor } from '../components/lessons/AgendaEditor'
import { SectionBlock } from '../components/lessons/SectionBlock'
import { useSessionSet } from '../hooks/useSessionSet'

export function LessonPlanDetailPage() {
  const { studentId, lessonPlanId } = useParams<{ studentId: string; lessonPlanId: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<LessonPlan | null>(null)
  const [sections, setSections] = useState<LessonSection[] | null>(null)
  const [totalPuzzles, setTotalPuzzles] = useState<number | null>(null)
  const { set: reviewedIds, add: markReviewed } = useSessionSet(`reviewed:${lessonPlanId}`)

  useEffect(() => {
    if (!lessonPlanId) return
    getLessonPlan(lessonPlanId).then(setPlan)
    listSections(lessonPlanId).then(setSections)
    refreshPuzzleCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonPlanId])

  function refreshPuzzleCount() {
    if (!lessonPlanId) return
    listAllPuzzleIds(lessonPlanId).then((ids) => setTotalPuzzles(ids.length))
  }

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
    refreshPuzzleCount()
  }

  function openPuzzle(puzzleId: string) {
    markReviewed(puzzleId)
    navigate(`/students/${studentId}/lessons/${lessonPlanId}/puzzles/${puzzleId}`)
  }

  if (!plan) return null

  const reviewedCount = totalPuzzles === null ? 0 : [...reviewedIds].length
  const progressPct = totalPuzzles ? Math.round((Math.min(reviewedCount, totalPuzzles) / totalPuzzles) * 100) : 0

  return (
    <div className="mx-auto min-h-svh max-w-3xl px-6 py-10">
      <button
        onClick={() => navigate(`/students/${studentId}/lessons`)}
        className="mb-6 text-xs text-ink-400 hover:text-ink-100"
      >
        ← Back to plans
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
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

      {!!totalPuzzles && (
        <div className="mb-6 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold text-ink-400">
            {Math.min(reviewedCount, totalPuzzles)} / {totalPuzzles} positions reviewed
          </span>
        </div>
      )}

      <div className="mb-8 rounded-xl border border-ink-800 bg-ink-900/50 p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Agenda</h2>
          <span className="text-[10.5px] text-ink-500">tap to check off</span>
        </div>
        <AgendaEditor items={plan.agenda} onChange={saveAgenda} storageKey={plan.id} />
      </div>

      <div className="space-y-4">
        {sections?.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            onOpenPuzzle={openPuzzle}
            onDeleted={refreshSections}
            onPuzzlesChanged={refreshPuzzleCount}
            reviewedIds={reviewedIds}
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
