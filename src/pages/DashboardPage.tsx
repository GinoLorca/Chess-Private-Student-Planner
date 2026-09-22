import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rolodex } from '../components/students/Rolodex'
import type { Student } from '../types/domain'
import { useStudentMutations, useStudents } from '../lib/queries'
import { Page, EmptyState, LoadingPage } from '../components/ui/Page'
import { Button, IconButton } from '../components/ui/Button'
import { InputModal } from '../components/ui/InputModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ActionSheet } from '../components/ui/ActionSheet'
import { More, Pencil, Plus, Settings, Trash, Library } from '../components/ui/Icons'
import { FOLDER_COLORS, SCHOOL_COLORS } from '../lib/colors'
import { BUILTIN_LOGOS, logoFromFile } from '../lib/logos'
import { LogoBadge } from '../components/lesson/Folder'
import { Modal } from '../components/ui/Modal'

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: students, isLoading } = useStudents()
  const { create, update, remove } = useStudentMutations()
  const [adding, setAdding] = useState(false)
  const [menuFor, setMenuFor] = useState<Student | null>(null)
  const [renaming, setRenaming] = useState<Student | null>(null)
  const [recoloring, setRecoloring] = useState<Student | null>(null)
  const [logoFor, setLogoFor] = useState<Student | null>(null)
  const [customColorFor, setCustomColorFor] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState<Student | null>(null)
  // A failed save rolls the folder back; say why, instead of the change just vanishing.
  const [saveError, setSaveError] = useState<string | null>(null)
  const report = { onError: (e: unknown) => setSaveError(explainSaveError(e)) }

  if (isLoading && !students) return <LoadingPage />

  return (
    <Page
      title="Students"
      actions={
        <>
          <Link to="/library">
            <IconButton label="Position library">
              <Library />
            </IconButton>
          </Link>
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
      {saveError && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-[14px] text-warn">
          <p className="flex-1">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="shrink-0 font-semibold underline underline-offset-2">
            Dismiss
          </button>
        </div>
      )}
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
          { label: 'School logo…', icon: <Library />, onSelect: () => setLogoFor(menuFor) },
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
          if (renaming) await update.mutateAsync({ id: renaming.id, patch: { name } }, report)
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
          if (recoloring) update.mutate({ id: recoloring.id, patch: { color } }, report)
          setRecoloring(null)
        }}
        onCustom={() => {
          setCustomColorFor(recoloring)
          setRecoloring(null)
        }}
      />
      <InputModal
        open={Boolean(customColorFor)}
        title="Custom colour"
        label="Hex colour, e.g. #1b3a6b"
        placeholder="#1b3a6b"
        initialValue={customColorFor?.color ?? ''}
        submitLabel="Use colour"
        onClose={() => setCustomColorFor(null)}
        onSubmit={async (value) => {
          const hex = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`
          if (customColorFor && /^#[0-9a-f]{6}$/i.test(hex)) await update.mutateAsync({ id: customColorFor.id, patch: { color: hex.toLowerCase() } }, report)
        }}
      />
      <LogoPicker
        student={logoFor}
        onClose={() => setLogoFor(null)}
        onPick={(logo, color) => {
          if (logoFor) update.mutate({ id: logoFor.id, patch: color ? { logo, color } : { logo } }, report)
          setLogoFor(null)
        }}
      />
    </Page>
  )
}

/** What went wrong saving a folder, in the coach's terms; the missing-column case names its fix. */
function explainSaveError(e: unknown): string {
  const msg =
    e instanceof Error ? e.message : e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/logo/i.test(msg) && /does not exist|schema cache/i.test(msg)) {
    return "The database doesn't have the logo column yet, so the logo and colour were not saved. In Supabase → SQL Editor, run supabase/migrations/0007_student_logo.sql once (it is one line), then pick the logo again."
  }
  return `Couldn't save that change: ${msg}`
}

/**
 * The school badge for a folder: a built-in logo (which also offers the
 * school's colour), a picture from the iPad, or none.
 */
function LogoPicker({
  student,
  onClose,
  onPick,
}: {
  student: Student | null
  onClose: () => void
  onPick: (logo: string | null, color?: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <Modal open={Boolean(student)} onClose={onClose} title="School logo">
      <div className="space-y-2">
        {BUILTIN_LOGOS.map((l) => (
          <div key={l.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
            <LogoBadge logo={l.src} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-ink">{l.label}</p>
              <p className="text-[12px] text-ink-3">{student?.logo === l.src ? 'Current logo' : 'Built in'}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => onPick(l.src)}>
              Logo only
            </Button>
            <Button size="sm" variant="primary" onClick={() => onPick(l.src, l.color)}>
              <span className="mr-1.5 inline-block h-3.5 w-3.5 rounded-sm" style={{ background: l.color }} />
              Logo + colour
            </Button>
          </div>
        ))}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
              onPick(await logoFromFile(file))
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            }
          }}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="soft" onClick={() => inputRef.current?.click()}>
            Choose a picture…
          </Button>
          {student?.logo && (
            <Button variant="ghost" onClick={() => onPick(null)}>
              Remove logo
            </Button>
          )}
        </div>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <p className="text-[12.5px] text-ink-3">A picture is shrunk to a small badge and kept with the student, so no upload service is needed.</p>
      </div>
    </Modal>
  )
}

function ColorPicker({
  student,
  onClose,
  onPick,
  onCustom,
}: {
  student: Student | null
  onClose: () => void
  onPick: (color: string) => void
  onCustom: () => void
}) {
  return (
    <ActionSheet
      open={Boolean(student)}
      onClose={onClose}
      title="Folder colour"
      items={[...FOLDER_COLORS.map((c) => ({ color: c, label: c === student?.color ? 'Current colour' : 'Use this colour' })), ...SCHOOL_COLORS.map((s) => ({ color: s.color, label: s.color === student?.color ? `${s.label} (current)` : s.label }))].map(({ color: c, label }) => ({
        label,
        icon: <span className="block h-6 w-6 rounded-md" style={{ background: c }} />,
        onSelect: () => onPick(c),
      })).concat([{ label: 'Custom colour…', icon: <Pencil />, onSelect: onCustom }])}
    />
  )
}
