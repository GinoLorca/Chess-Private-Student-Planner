import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createNote, deleteNote, listNotes, updateNote } from '../lib/api'
import type { FolderKind, Note } from '../types/domain'
import { FOLDER_KINDS } from '../types/domain'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

export function NotesPage() {
  const { studentId, folderKind } = useParams<{ studentId: string; folderKind: string }>()
  const navigate = useNavigate()
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const kind = folderKind as Note['folder_kind']
  const label = FOLDER_KINDS.find((f) => f.kind === (kind as FolderKind))?.label ?? kind
  const showAmount = kind === 'invoices'

  useEffect(() => {
    if (!studentId || !kind) return
    listNotes(studentId, kind).then(setNotes)
  }, [studentId, kind])

  async function handleAdd() {
    if (!studentId || !kind) return
    const note = await createNote(studentId, kind)
    setNotes((prev) => [note, ...(prev ?? [])])
  }

  function patchLocal(id: string, patch: Partial<Note>) {
    setNotes((prev) => prev?.map((n) => (n.id === id ? { ...n, ...patch } : n)) ?? null)
  }

  async function persist(id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'amount'>>) {
    setSavingId(id)
    await updateNote(id, patch)
    setSavingId(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteNote(deleteTarget.id)
    setNotes((prev) => prev?.filter((n) => n.id !== deleteTarget.id) ?? null)
  }

  return (
    <div className="mx-auto min-h-svh max-w-2xl px-6 py-10">
      <button onClick={() => navigate(`/students/${studentId}`)} className="mb-6 text-xs text-ink-400 hover:text-ink-100">
        ← Back
      </button>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-marker text-3xl text-gold-500">{label}</h1>
        <button
          onClick={handleAdd}
          className="rounded-lg bg-gold-500 px-3 py-1.5 text-sm font-semibold text-ink-950 hover:bg-gold-400"
        >
          + Add
        </button>
      </div>

      <div className="space-y-3">
        {notes?.length === 0 && <p className="text-sm text-ink-400">Nothing here yet.</p>}
        {notes?.map((note) => (
          <div key={note.id} className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <input
                value={note.title}
                onChange={(e) => patchLocal(note.id, { title: e.target.value })}
                onBlur={(e) => persist(note.id, { title: e.target.value })}
                className="w-full bg-transparent text-sm font-semibold text-ink-100 outline-none"
                placeholder="Title"
              />
              <button
                onClick={() => setDeleteTarget(note)}
                className="shrink-0 text-xs text-ink-500 hover:text-red-400"
              >
                delete
              </button>
            </div>
            {showAmount && (
              <input
                type="number"
                step="0.01"
                value={note.amount ?? ''}
                onChange={(e) => patchLocal(note.id, { amount: e.target.value === '' ? null : Number(e.target.value) })}
                onBlur={(e) => persist(note.id, { amount: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="Amount"
                className="mb-2 w-32 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-ink-100 outline-none focus:border-gold-500"
              />
            )}
            <textarea
              value={note.body}
              onChange={(e) => patchLocal(note.id, { body: e.target.value })}
              onBlur={(e) => persist(note.id, { body: e.target.value })}
              rows={3}
              placeholder="Notes…"
              className="w-full resize-y rounded-md border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-ink-200 outline-none focus:border-gold-500"
            />
            {savingId === note.id && <p className="mt-1 text-[10px] text-ink-500">saving…</p>}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete entry"
        message="This can't be undone."
      />
    </div>
  )
}
