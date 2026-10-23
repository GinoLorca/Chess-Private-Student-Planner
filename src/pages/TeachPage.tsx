import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { Student } from '../types/domain'
import * as api from '../lib/data'
import { keys, useLessonPlans, useStudentMutations, useTeachFolderMutations, useTeachFolders, useTeachMissing } from '../lib/queries'
import { EmptyState, LoadingPage, Page } from '../components/ui/Page'
import { Button, IconButton } from '../components/ui/Button'
import { ActionSheet } from '../components/ui/ActionSheet'
import { InputModal } from '../components/ui/InputModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { MigrationNotice } from '../components/ui/MigrationNotice'
import { FolderBody, FolderTab } from '../components/lesson/Folder'
import { onColor } from '../lib/colors'
import { ChevronRight, Document, More, Pencil, Plus, Trash } from '../components/ui/Icons'
import teachSql from '../../supabase/migrations/0014_teach_and_levels.sql?raw'

/**
 * Teach: lessons for anyone, kept apart from the students. Positions come in
 * from a student's folder (Teach, next to Analyze, takes the student out of
 * them), from a pasted or opened PGN or FEN, or from Muse. Its folders hold
 * lessons exactly like a student's folder, so a set can be prepared for one
 * private student and recycled into their folder when it's ready.
 */
export function TeachPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const missing = useTeachMissing()
  const { data: folders, isLoading } = useTeachFolders()
  const { create } = useTeachFolderMutations()
  const { update, remove } = useStudentMutations()
  const [naming, setNaming] = useState(false)
  const [menuFor, setMenuFor] = useState<Student | null>(null)
  const [renaming, setRenaming] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState<Student | null>(null)
  const [pickingImport, setPickingImport] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Import: a new lesson in the folder, opened with the importer up (paste PGN or FEN, or open a file).
  async function importInto(folder?: Student) {
    setBusy(true)
    setError(null)
    try {
      const f = folder ?? (await api.ensureTeachFolder())
      const plan = await api.createLessonPlan(f.id, { title: '', sections: ['Positions'] })
      const [section] = await api.listSections(plan.id)
      qc.invalidateQueries({ queryKey: keys.students })
      qc.invalidateQueries({ queryKey: keys.lessonPlans(f.id) })
      navigate(`/students/${f.id}/lessons/${plan.id}?quickadd=${section.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (isLoading && !folders) return <LoadingPage />

  return (
    <Page
      back="/"
      eyebrow="Lessons for anyone"
      title="Teach"
      width="wide"
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            icon={<Document size={16} />}
            disabled={busy || missing.data}
            onClick={() => ((folders?.length ?? 0) > 1 ? setPickingImport(true) : void importInto(folders?.[0]))}
          >
            Import
          </Button>
          <IconButton label="New folder" onClick={() => setNaming(true)} disabled={missing.data}>
            <Plus />
          </IconButton>
        </>
      }
    >
      {missing.data ? (
        <MigrationNotice file={api.TEACH_MIGRATION} sql={teachSql} adds="Teach (and De-Construct, next)" onCheck={() => void missing.refetch()} />
      ) : (
        <>
          {error && <p className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-[14px] text-warn">{error}</p>}
          {!folders || folders.length === 0 ? (
            <EmptyState
              title="Nothing in Teach yet"
              body="Send a position here from any student with Teach, next to Analyze: the student is taken out of it. Or import a PGN or FEN, pasted or from a file."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" icon={<Document size={18} />} disabled={busy} onClick={() => void importInto()}>
                    Import PGN or FEN
                  </Button>
                  <Button icon={<Plus size={18} />} onClick={() => setNaming(true)}>
                    New folder
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-x-5 gap-y-7 lg:grid-cols-2">
              {folders.map((f) => (
                <TeachFolderCard key={f.id} folder={f} onMenu={() => setMenuFor(f)} />
              ))}
            </div>
          )}
        </>
      )}

      <InputModal
        open={naming}
        title="New Teach folder"
        label="Name"
        placeholder="e.g. Back-rank mates, or Jojo's next block"
        submitLabel="Create"
        onClose={() => setNaming(false)}
        onSubmit={async (name) => {
          if (name.trim()) await create.mutateAsync(name.trim())
          setNaming(false)
        }}
      />
      <InputModal
        open={Boolean(renaming)}
        title="Rename folder"
        label="Name"
        initialValue={renaming?.name ?? ''}
        submitLabel="Rename"
        onClose={() => setRenaming(null)}
        onSubmit={async (name) => {
          if (renaming && name.trim()) await update.mutateAsync({ id: renaming.id, patch: { name: name.trim() } })
          setRenaming(null)
        }}
      />
      <ActionSheet
        open={Boolean(menuFor)}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name}
        items={
          menuFor
            ? [
                { label: 'Import PGN or FEN here', icon: <Document />, onSelect: () => void importInto(menuFor) },
                { label: 'Rename', icon: <Pencil />, onSelect: () => setRenaming(menuFor) },
                { label: 'Delete folder…', icon: <Trash />, danger: true, onSelect: () => setDeleting(menuFor) },
              ]
            : []
        }
      />
      <ActionSheet
        open={pickingImport}
        onClose={() => setPickingImport(false)}
        title="Import into…"
        items={(folders ?? []).map((f) => ({ label: f.name, icon: <Document />, onSelect: () => void importInto(f) }))}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? 'this folder'}?`}
        body="Its lessons and positions go with it. The students' own positions are not touched."
        confirmLabel="Delete"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id)
          setDeleting(null)
        }}
      />
    </Page>
  )
}

/** One Teach folder: its tab, and its newest lessons on the folder to open straight away. */
function TeachFolderCard({ folder, onMenu }: { folder: Student; onMenu: () => void }) {
  const { data: plans } = useLessonPlans(folder.id)
  const count = plans?.length ?? 0
  const lessons = `/students/${folder.id}/lessons`
  return (
    <div className="min-w-0">
      <FolderTab color={folder.color} name={folder.name} aside={`${count} lesson${count === 1 ? '' : 's'}`} />
      <FolderBody color={folder.color} className="pb-4">
        <div className="rounded-xl bg-paper p-2 shadow-[0_8px_20px_-16px_rgba(0,0,0,0.5)]">
          {plans && plans.length > 0 ? (
            <ul>
              {plans.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <Link
                    to={`${lessons}/${p.id}`}
                    className="flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-[15px] text-ink hover:bg-black/5"
                  >
                    <span className="w-7 shrink-0 font-display text-[18px] font-bold tabular-nums">{p.number}</span>
                    <span className="min-w-0 flex-1 truncate">{p.title || p.theme || 'Untitled lesson'}</span>
                    <ChevronRight size={16} className="shrink-0 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2.5 py-3 text-[14px] text-ink-3">No lessons yet.</p>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Link to={lessons} className="flex-1">
            <Button variant="secondary" block>
              Open {plans && plans.length > 4 ? `all ${plans.length}` : 'folder'}
            </Button>
          </Link>
          <IconButton label={`${folder.name}: more`} onClick={onMenu} style={{ color: onColor(folder.color).ink }} className="hover:bg-white/15">
            <More />
          </IconButton>
        </div>
      </FolderBody>
    </div>
  )
}
