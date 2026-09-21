import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rolodex } from '../components/students/Rolodex'
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
  const navigate = useNavigate()
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
        <Rolodex students={students ?? []} onOpen={(s) => navigate(`/students/${s.id}`)} onMenu={setMenuFor} />
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
