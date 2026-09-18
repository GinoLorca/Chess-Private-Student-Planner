import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createLessonPlan, deleteLessonPlan, listLessonPlans, listStudents } from '../lib/api'
import type { LessonPlan, Student } from '../types/domain'
import { InputModal } from '../components/ui/InputModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { motion } from 'framer-motion'

export function LessonPlanListPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [plans, setPlans] = useState<LessonPlan[] | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LessonPlan | null>(null)

  useEffect(() => {
    if (!studentId) return
    listLessonPlans(studentId).then(setPlans)
    listStudents().then((all) => setStudent(all.find((s) => s.id === studentId) ?? null))
  }, [studentId])

  async function handleAdd(title: string) {
    if (!studentId) return
    const plan = await createLessonPlan(studentId, title)
    setPlans((prev) => [plan, ...(prev ?? [])])
    setAddOpen(false)
    navigate(`/students/${studentId}/lessons/${plan.id}`)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteLessonPlan(deleteTarget.id)
    setPlans((prev) => prev?.filter((p) => p.id !== deleteTarget.id) ?? null)
  }

  return (
    <div className="mx-auto min-h-svh max-w-2xl px-6 py-10">
      <button onClick={() => navigate(`/students/${studentId}`)} className="mb-6 text-xs text-ink-400 hover:text-ink-100">
        ← Back
      </button>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-marker text-3xl text-gold-500">{student?.name}'s Lesson Plans</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="rounded-lg bg-gold-500 px-3 py-1.5 text-sm font-semibold text-ink-950 hover:bg-gold-400"
        >
          + New plan
        </button>
      </div>

      <div className="space-y-2">
        {plans?.length === 0 && <p className="text-sm text-ink-400">No lesson plans yet.</p>}
        {plans?.map((plan) => (
          <motion.div
            key={plan.id}
            whileHover={{ x: 2 }}
            className="group flex items-center justify-between rounded-xl border border-ink-800 bg-ink-900/60 px-4 py-3 hover:border-gold-600/50"
          >
            <button
              onClick={() => navigate(`/students/${studentId}/lessons/${plan.id}`)}
              className="flex-1 text-left"
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{student?.name}</div>
              <div className="text-[15px] font-semibold text-ink-100">Lesson Plan {plan.number}</div>
              {plan.title && <div className="text-xs text-gold-400">{plan.title}</div>}
            </button>
            <button
              onClick={() => setDeleteTarget(plan)}
              className="ml-3 text-xs text-ink-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
            >
              delete
            </button>
          </motion.div>
        ))}
      </div>

      <InputModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
        title="New lesson plan"
        label="Title (optional)"
        placeholder="e.g. Blunder Prevention"
        submitLabel="Create"
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete lesson plan"
        message="This deletes the plan and every puzzle inside it. This can't be undone."
      />
    </div>
  )
}
