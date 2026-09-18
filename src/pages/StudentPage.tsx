import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getFolderCounts, listStudents } from '../lib/api'
import type { FolderKind, Student } from '../types/domain'
import { FOLDER_KINDS } from '../types/domain'
import { SubfolderRow, FolderIcon } from '../components/folders/SubfolderRow'

export function StudentPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [counts, setCounts] = useState<Record<FolderKind, number> | null>(null)

  useEffect(() => {
    if (!studentId) return
    listStudents().then((all) => setStudent(all.find((s) => s.id === studentId) ?? null))
    getFolderCounts(studentId).then(setCounts)
  }, [studentId])

  function openFolder(kind: FolderKind) {
    if (!studentId) return
    if (kind === 'lesson_plan') navigate(`/students/${studentId}/lessons`)
    else navigate(`/students/${studentId}/notes/${kind}`)
  }

  return (
    <div className="mx-auto min-h-svh max-w-2xl px-6 py-10">
      <button onClick={() => navigate('/')} className="mb-6 text-xs text-ink-400 hover:text-ink-100">
        ← All students
      </button>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
        className="mb-6 flex items-center gap-3"
      >
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-950"
          style={{ background: student?.color ?? '#e9c98e' }}
        >
          <FolderIcon />
        </span>
        <h1 className="font-marker text-3xl text-ink-100">{student?.name ?? '…'}</h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, type: 'spring', duration: 0.4, bounce: 0.2 }}
        className="divide-y divide-ink-800 rounded-2xl border border-ink-800 bg-ink-900/60 p-2"
      >
        {FOLDER_KINDS.map(({ kind, label }) => (
          <SubfolderRow
            key={kind}
            icon={<FolderIcon />}
            label={label}
            count={counts?.[kind] ?? 0}
            onClick={() => openFolder(kind)}
          />
        ))}
      </motion.div>
    </div>
  )
}
