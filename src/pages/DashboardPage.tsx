import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createStudent, deleteStudent, listStudents, updateStudent } from '../lib/api'
import type { Student } from '../types/domain'
import { FolderTab } from '../components/folders/FolderTab'
import { AddFolderTab } from '../components/folders/AddFolderTab'
import { InputModal } from '../components/ui/InputModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useAuth } from '../auth/AuthProvider'

const PALETTE = ['#e9c98e', '#d9a5a0', '#a7c4b5', '#a9bfd9', '#c9b3d9', '#e0c3a0']

export function DashboardPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [students, setStudents] = useState<Student[] | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Student | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)

  useEffect(() => {
    listStudents().then(setStudents)
  }, [])

  async function handleAdd(name: string) {
    const color = PALETTE[(students?.length ?? 0) % PALETTE.length]
    const student = await createStudent(name, color)
    setStudents((prev) => [...(prev ?? []), student])
    setAddOpen(false)
  }

  async function handleRename(name: string) {
    if (!renameTarget) return
    await updateStudent(renameTarget.id, { name })
    setStudents((prev) => prev?.map((s) => (s.id === renameTarget.id ? { ...s, name } : s)) ?? null)
    setRenameTarget(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteStudent(deleteTarget.id)
    setStudents((prev) => prev?.filter((s) => s.id !== deleteTarget.id) ?? null)
  }

  return (
    <div className="mx-auto min-h-svh max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-marker text-3xl text-gold-500">Lesson Planner</h1>
          <p className="mt-1 text-sm text-ink-300">Tap a folder to open a student.</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/settings')} className="text-xs text-ink-400 hover:text-ink-100">
            Settings
          </button>
          <button onClick={() => signOut()} className="text-xs text-ink-400 hover:text-ink-100">
            Sign out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 md:grid-cols-4">
        {students?.map((student) => (
          <div key={student.id} className="group/tile relative">
            <FolderTab
              name={student.name}
              color={student.color}
              onOpen={() => navigate(`/students/${student.id}`)}
              onLongPress={() => setRenameTarget(student)}
            />
            <div className="pointer-events-none absolute right-1 top-0 flex gap-1 opacity-0 transition group-hover/tile:pointer-events-auto group-hover/tile:opacity-100">
              <button
                onClick={() => setRenameTarget(student)}
                className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-300 hover:text-gold-500"
              >
                rename
              </button>
              <button
                onClick={() => setDeleteTarget(student)}
                className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-300 hover:text-red-400"
              >
                delete
              </button>
            </div>
          </div>
        ))}
        <AddFolderTab onClick={() => setAddOpen(true)} />
      </div>

      <InputModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAdd}
        title="New student"
        label="Student name"
        placeholder="e.g. Joseph &quot;Jojo&quot; Liu"
        submitLabel="Create folder"
      />
      <InputModal
        open={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRename}
        title="Rename student"
        label="Student name"
        initialValue={renameTarget?.name ?? ''}
        submitLabel="Save"
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete student"
        message={`This deletes ${deleteTarget?.name}'s folder and everything in it. This can't be undone.`}
      />
    </div>
  )
}
