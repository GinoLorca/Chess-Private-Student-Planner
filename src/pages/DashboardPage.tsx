import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rolodex } from '../components/students/Rolodex'
import type { Student } from '../types/domain'
import { useStudentMutations, useStudents } from '../lib/queries'
import { missingStudentColumns, STUDENT_MIGRATION_COLUMNS } from '../lib/data'
import { copyText } from '../lib/links'
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
  const [uscfFor, setUscfFor] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState<Student | null>(null)
  // Columns later migrations add; when the database lacks one, say so up
  // front with the SQL to run, rather than letting a save quietly fail.
  const [missing, setMissing] = useState<string[]>([])
  const [copiedSql, setCopiedSql] = useState(false)
  useEffect(() => {
    let live = true
    missingStudentColumns()
      .then((cols) => live && setMissing(cols))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  const missingSql = missing.map((c) => `alter table students add column if not exists ${c} text;`).join('\n')
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
      {missing.length > 0 && (
        <div role="alert" className="mb-4 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-[14px] text-warn">
          <p className="font-semibold">
            {missing.length === 1 ? 'A database update is waiting' : `${missing.length} database updates are waiting`}, so{' '}
            {missing.map((c) => (c === 'logo' ? 'school logos' : c === 'uscf_id' ? 'USCF IDs' : c)).join(' and ')} can't be saved yet.
          </p>
          <p className="mt-1">In Supabase → SQL Editor, paste this and Run, once:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-surface px-3 py-2 font-mono text-[12.5px] whitespace-pre-wrap text-ink">{missingSql}</pre>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await copyText(missingSql)
                setCopiedSql(true)
              }}
            >
              {copiedSql ? 'Copied' : 'Copy the SQL'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
              I've run it, check again
            </Button>
          </div>
          <p className="mt-2 text-[12.5px]">
            These are {missing.map((c) => STUDENT_MIGRATION_COLUMNS[c]).join(' and ')} in the repo's supabase/migrations folder.
          </p>
        </div>
      )}
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
        <Rolodex students={students ?? []} onOpen={(s) => navigate(`/students/${s.id}`)} onMenu={setMenuFor} onInfo={setSaveError} />
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
          { label: menuFor?.uscf_id ? `USCF ID… (${menuFor.uscf_id})` : 'USCF ID…', icon: <Pencil />, onSelect: () => setUscfFor(menuFor) },
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
      <InputModal
        open={Boolean(uscfFor)}
        title="USCF ID"
        label="Member number (the digits on the USCF card)"
        placeholder="e.g. 32473012"
        initialValue={uscfFor?.uscf_id ?? ''}
        submitLabel="Save"
        onClose={() => setUscfFor(null)}
        onSubmit={async (value) => {
          const digits = value.replace(/\D/g, '')
          if (uscfFor) await update.mutateAsync({ id: uscfFor.id, patch: { uscf_id: digits || null } }, report)
        }}
      />
      <LogoPicker
        student={logoFor}
        onClose={() => setLogoFor(null)}
        onPick={(logo, color) => {
          if (!logoFor) return
          // Two saves, so the colour lands even when the logo column is missing.
          if (color) update.mutate({ id: logoFor.id, patch: { color } }, report)
          update.mutate({ id: logoFor.id, patch: { logo } }, report)
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
  const column = Object.keys(STUDENT_MIGRATION_COLUMNS).find((c) => msg.toLowerCase().includes(c))
  if (column && /does not exist|schema cache/i.test(msg)) {
    const what = column === 'logo' ? 'the logo' : column === 'uscf_id' ? 'the USCF ID' : column
    return `The database doesn't have the ${column} column yet, so ${what} was not saved. In Supabase → SQL Editor, run supabase/migrations/${STUDENT_MIGRATION_COLUMNS[column]} once (it is one line), then try again.`
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
