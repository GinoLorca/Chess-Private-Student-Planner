import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Student } from '../types/domain'
import { useStudentMutations, useStudents } from '../lib/queries'
import { Page, EmptyState, LoadingPage } from '../components/ui/Page'
import { Button, IconButton } from '../components/ui/Button'
import { InputModal } from '../components/ui/InputModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ActionSheet } from '../components/ui/ActionSheet'
import { More, Pencil, Plus, Settings, Trash } from '../components/ui/Icons'
import { FOLDER_COLORS } from '../lib/colors'

export function DashboardPage() {
  const { data: students, isLoading } = useStudents()
  const { create, update, remove } = useStudentMutations()
  const [adding, setAdding] = useState(false)
  const [menuFor, setMenuFor] = useState<Student | null>(null)
  const [renaming, setRenaming] = useState<Student | null>(null)
  const [recoloring, setRecoloring] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState<Student | null>(null)

  if (isLoading && !students) return <LoadingPage />

  return (
    <Page
      title="Students"
      actions={
        <>
          <Link to="/settings">
            <IconButton label="Settings">
              <Settings />
            </IconButton>
          </Link>
          <IconButton label="Add student" onClick={() => setAdding(true)}>
            <Plus />
          </IconButton>
        </>
      }
    >
      {students && students.length === 0 ? (
        <EmptyState
          title="No students yet"
          body="Each student gets a folder with lesson plans, notes, game reviews and invoices."
          action={
            <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAdding(true)}>
              Add a student
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
          {students?.map((s, i) => (
            <FolderCard key={s.id} student={s} index={i} onMenu={() => setMenuFor(s)} />
          ))}
        </div>
      )}

      <InputModal
        open={adding}
        title="New student"
        label="Name"
        placeholder='e.g. Joseph "Jojo" Liu'
        submitLabel="Add"
        onClose={() => setAdding(false)}
        onSubmit={async (name) => {
          const color = FOLDER_COLORS[(students?.length ?? 0) % FOLDER_COLORS.length]
          await create.mutateAsync({ name, color })
        }}
      />

      <ActionSheet
        open={Boolean(menuFor)}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name}
        items={[
          { label: 'Rename', icon: <Pencil />, onSelect: () => setRenaming(menuFor) },
          { label: 'Change folder colour', icon: <More />, onSelect: () => setRecoloring(menuFor) },
          { label: 'Delete student', icon: <Trash />, danger: true, onSelect: () => setDeleting(menuFor) },
        ]}
      />

      <InputModal
        open={Boolean(renaming)}
        title="Rename student"
        label="Name"
        initialValue={renaming?.name ?? ''}
        onClose={() => setRenaming(null)}
        onSubmit={async (name) => {
          if (renaming) await update.mutateAsync({ id: renaming.id, patch: { name } })
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? ''}?`}
        body="This removes every lesson plan, puzzle and note in their folder. There's no undo."
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id)
        }}
      />

      <ColorPicker
        student={recoloring}
        onClose={() => setRecoloring(null)}
        onPick={(color) => {
          if (recoloring) update.mutate({ id: recoloring.id, patch: { color } })
          setRecoloring(null)
        }}
      />
    </Page>
  )
}

function FolderCard({ student, index, onMenu }: { student: Student; index: number; onMenu: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.25 }}
      className="relative"
    >
      <Link to={`/students/${student.id}`} className="group block">
        <div className="relative pt-5">
          <span
            className="absolute top-0 left-4 h-6 w-[46%] rounded-t-lg"
            style={{ background: student.color, filter: 'brightness(0.92)' }}
          />
          <div
            className="relative flex h-32 items-end overflow-hidden rounded-xl p-3.5 shadow-card transition duration-200 group-hover:-translate-y-1 group-active:scale-[0.98]"
            style={{ background: `linear-gradient(160deg, ${student.color} 0%, ${student.color} 55%, rgba(0,0,0,0.06) 100%)` }}
          >
            <span className="absolute inset-x-0 top-0 h-1/3 bg-white/25" />
            <span className="relative text-[17px] leading-tight font-bold text-black/75">{student.name}</span>
          </div>
        </div>
      </Link>
      <button
        onClick={onMenu}
        aria-label={`Options for ${student.name}`}
        className="absolute top-7 right-2 grid h-9 w-9 place-items-center rounded-full text-black/50 hover:bg-black/10"
      >
        <More size={18} />
      </button>
    </motion.div>
  )
}

function ColorPicker({
  student,
  onClose,
  onPick,
}: {
  student: Student | null
  onClose: () => void
  onPick: (color: string) => void
}) {
  return (
    <ActionSheet
      open={Boolean(student)}
      onClose={onClose}
      title="Folder colour"
      items={FOLDER_COLORS.map((c) => ({
        label: c === student?.color ? 'Current colour' : 'Use this colour',
        icon: <span className="block h-6 w-6 rounded-md" style={{ background: c }} />,
        onSelect: () => onPick(c),
      }))}
    />
  )
}
