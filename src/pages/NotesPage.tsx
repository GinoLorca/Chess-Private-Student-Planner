import { useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Note } from '../types/domain'
import { FOLDER_KINDS } from '../types/domain'
import { useNoteMutations, useNotes, useStudent } from '../lib/queries'
import { Page, Card, EmptyState, LoadingPage } from '../components/ui/Page'
import { Button, IconButton } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ChevronRight, Plus, Trash } from '../components/ui/Icons'

type Kind = Note['folder_kind']

export function NotesPage() {
  const { studentId = '', folderKind = 'misc' } = useParams<{ studentId: string; folderKind: Kind }>()
  const kind = folderKind as Kind
  const { data: student } = useStudent(studentId)
  const { data: notes, isLoading } = useNotes(studentId, kind)
  const { create, update, remove } = useNoteMutations(studentId, kind)
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Note | null>(null)
  const label = FOLDER_KINDS.find((f) => f.kind === kind)?.label ?? 'Notes'
  const openNote = notes?.find((n) => n.id === openId) ?? null

  async function addNote() {
    const note = await create.mutateAsync()
    setOpenId(note.id)
  }

  if (isLoading && !notes) return <LoadingPage />

  return (
    <Page
      back={`/students/${studentId}`}
      eyebrow={student?.name}
      title={label}
      actions={
        <IconButton label="New note" onClick={addNote} disabled={create.isPending}>
          <Plus />
        </IconButton>
      }
    >
      {notes && notes.length === 0 ? (
        <EmptyState
          title={`Nothing filed under ${label} yet`}
          action={
            <Button variant="primary" icon={<Plus size={18} />} onClick={addNote}>
              New note
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {notes?.map((note, i) => (
            <div key={note.id} className={`flex items-center ${i > 0 ? 'border-t border-line' : ''}`}>
              <button
                onClick={() => setOpenId(note.id)}
                className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition active:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold text-ink">{note.title || 'Untitled'}</span>
                  <span className="block truncate text-[13px] text-ink-3">
                    {kind === 'invoices' && note.amount != null ? `$${note.amount} · ` : ''}
                    {new Date(note.updated_at).toLocaleDateString()}
                    {note.body ? ` · ${note.body.slice(0, 80)}` : ''}
                  </span>
                </span>
                <ChevronRight className="shrink-0 text-ink-3" />
              </button>
              <IconButton label="Delete note" className="mr-1 text-ink-3" onClick={() => setDeleting(note)}>
                <Trash size={18} />
              </IconButton>
            </div>
          ))}
        </Card>
      )}

      <Modal open={Boolean(openNote)} onClose={() => setOpenId(null)} title="Note">
        {openNote && (
          <NoteEditor
            key={openNote.id}
            note={openNote}
            showAmount={kind === 'invoices'}
            onClose={() => setOpenId(null)}
            onSave={(patch) => update.mutate({ id: openNote.id, patch })}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete "${deleting?.title || 'Untitled'}"?`}
        confirmLabel="Delete"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id)
        }}
      />
    </Page>
  )
}

// Keyed on the note id by its parent, so opening a different note starts fresh.
function NoteEditor({
  note,
  showAmount,
  onClose,
  onSave,
}: {
  note: Note
  showAmount: boolean
  onClose: () => void
  onSave: (patch: Partial<Pick<Note, 'title' | 'body' | 'amount'>>) => void
}) {
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [amount, setAmount] = useState(note.amount == null ? '' : String(note.amount))

  function commit() {
    const patch: Partial<Pick<Note, 'title' | 'body' | 'amount'>> = {}
    if (title !== note.title) patch.title = title
    if (body !== note.body) patch.body = body
    if (showAmount) {
      const parsed = amount.trim() === '' ? null : Number(amount)
      if (parsed !== note.amount && !(parsed !== null && Number.isNaN(parsed))) patch.amount = parsed
    }
    if (Object.keys(patch).length) onSave(patch)
    onClose()
  }

  const field =
    'w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-[16px] outline-none focus:border-accent'

  return (
    <div className="space-y-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={`${field} h-12`} />
      {showAmount && (
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount ($)"
          className={`${field} h-12`}
        />
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write anything…"
        rows={8}
        className={`${field} resize-y py-3 leading-relaxed`}
      />
      <div className="flex justify-end">
        <Button variant="primary" onClick={commit}>
          Done
        </Button>
      </div>
    </div>
  )
}
