import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import type { Puzzle } from '../../types/domain'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Page'
import { MigrationNotice } from '../ui/MigrationNotice'
import teachSql from '../../../supabase/migrations/0014_teach_and_levels.sql?raw'
import { TEACH_MIGRATION, TEACH_NAME, type PuzzlePatch } from '../../lib/data'
import { useLesson, useLessonPlans, useSendToTeach, useTeachFolders, useTeachMissing } from '../../lib/queries'
import { rewritePositionOnly } from '../../lib/ai'
import { normalizeFen } from '../../lib/fen'
import {
  findPersonMentions,
  lastTeachDestination,
  personNames,
  rememberTeachDestination,
  teachPatch,
  teachTexts,
  withoutNames,
  type TeachDestination,
  type TeachResult,
  type TeachText,
} from '../../lib/teach'

export interface TeachItem {
  puzzle: Puzzle
  /** The section it's in, the default name for its section in Teach. */
  sectionTitle: string
}

interface SendToTeachSheetProps {
  open: boolean
  onClose: () => void
  /** The student the positions come from: their name is what's taken out. */
  studentName: string
  /** One position, or (with `lesson`) every position of a lesson, in order. */
  items: TeachItem[]
  /** Sending a whole lesson: it lands as a new Teach lesson with the same sections. */
  lesson?: { title: string; theme: string }
}

/**
 * Send to Teach: a copy of a student's position (or a whole lesson) in a
 * Teach folder, with the student taken out. Its wording is rewritten to talk
 * about the position only, and every change is shown, editable, before
 * anything is saved. The student's original stays as it is.
 */
export function SendToTeachSheet({ open, onClose, ...rest }: SendToTeachSheetProps) {
  const title = rest.lesson ? 'Send this lesson to Teach' : 'Send to Teach'
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {open && <SendForm {...rest} onClose={onClose} />}
    </Modal>
  )
}

/** One rewritten piece of wording, keyed by position and field. */
interface Change {
  puzzleId: string
  field: TeachText
  after: string
}

function SendForm({ studentName, items: given, lesson, onClose }: Omit<SendToTeachSheetProps, 'open'>) {
  // What was asked for when the sheet opened: a parent re-rendering mustn't start the rewrite over.
  const [items] = useState(given)
  const missing = useTeachMissing()
  const names = useMemo(() => personNames(studentName), [studentName])
  const [changes, setChanges] = useState<Change[] | null>(null)
  const [by, setBy] = useState<{ by: 'ai' | 'device'; problem?: string } | null>(null)
  const [done, setDone] = useState<TeachResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const send = useSendToTeach()

  // Find what mentions a person, and have it rewritten, as the sheet opens.
  useEffect(() => {
    let live = true
    ;(async () => {
      const found: Change[] = []
      let how: { by: 'ai' | 'device'; problem?: string } = { by: 'device' }
      // Three at a time: a long lesson shouldn't fire twenty requests at once.
      const queue = [...items]
      async function worker() {
        for (let item = queue.shift(); item; item = queue.shift()) {
          const fields = teachTexts(item.puzzle).filter((t) => findPersonMentions(t.text, names).length > 0)
          if (fields.length === 0) continue
          const r = await rewritePositionOnly(
            normalizeFen(item.puzzle.starting_fen, item.puzzle.side_to_move),
            item.puzzle.solution,
            fields.map((f) => ({ key: f.key, text: f.text })),
            names,
          )
          if (r.by === 'ai') how = { by: 'ai' }
          else if (how.by !== 'ai') how = { by: 'device', problem: r.problem }
          for (const f of fields) found.push({ puzzleId: item.puzzle.id, field: f, after: r.texts[f.key] ?? f.text })
        }
      }
      await Promise.all([worker(), worker(), worker()])
      if (!live) return
      const order = new Map(items.map((it, i) => [it.puzzle.id, i]))
      found.sort((a, b) => (order.get(a.puzzleId) ?? 0) - (order.get(b.puzzleId) ?? 0))
      setChanges(found)
      setBy(how)
    })().catch((e) => live && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
  }, [items, names])

  if (missing.data) {
    return (
      <MigrationNotice
        file={TEACH_MIGRATION}
        sql={teachSql}
        adds="Teach (and De-Construct, next)"
        onCheck={() => void missing.refetch()}
      />
    )
  }

  if (done) return <Sent result={done} count={items.length} onClose={onClose} />

  const patchesFor = (all: Change[]) => {
    const byPuzzle = new Map<string, Record<string, string>>()
    for (const c of all) byPuzzle.set(c.puzzleId, { ...byPuzzle.get(c.puzzleId), [c.field.key]: c.after })
    return (item: TeachItem): PuzzlePatch => teachPatch(item.puzzle, byPuzzle.get(item.puzzle.id) ?? {})
  }

  return (
    <div className="space-y-5">
      {lesson ? (
        <LessonDestination
          lesson={lesson}
          names={names}
          busy={send.lesson.isPending}
          disabled={!changes}
          onSend={async (folderId, title, theme) => {
            setError(null)
            const patch = patchesFor(changes ?? [])
            const sections: { title: string; patches: PuzzlePatch[] }[] = []
            for (const item of items) {
              const at = sections.find((s) => s.title === item.sectionTitle)
              if (at) at.patches.push(patch(item))
              else sections.push({ title: item.sectionTitle, patches: [patch(item)] })
            }
            try {
              setDone(await send.lesson.mutateAsync({ folderId, lesson: { title, theme }, sections }))
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e))
            }
          }}
        />
      ) : (
        <PositionDestination
          item={items[0]}
          busy={send.positions.isPending}
          disabled={!changes}
          onSend={async (to) => {
            setError(null)
            try {
              const result = await send.positions.mutateAsync({ to, patches: items.map(patchesFor(changes ?? [])) })
              rememberTeachDestination({ folderId: result.folderId, lessonId: result.lessonId, sectionId: result.sectionId })
              setDone(result)
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e))
            }
          }}
        />
      )}

      {error && <p className="rounded-xl bg-warn-soft px-3 py-2 text-[14px] text-warn">{error}</p>}

      <section>
        <h3 className="mb-2 text-[12px] font-semibold tracking-wider text-ink-3 uppercase">The wording</h3>
        {!changes ? (
          <p className="flex items-center gap-2 text-[14px] text-ink-2">
            <Spinner className="h-4 w-4" /> Taking the student out of the wording…
          </p>
        ) : changes.length === 0 ? (
          <p className="text-[14px] text-ink-2">
            Nothing {items.length > 1 ? 'in these positions' : 'here'} mentions a person, so the wording goes over as it is.
          </p>
        ) : (
          <>
            <p className="mb-3 text-[13.5px] text-ink-2">
              Rewritten to talk about the position only
              {by?.by === 'device' ? ' (worked out on this device, so read it through)' : ''}. Edit anything before sending.
              {by?.by === 'device' && by.problem && <span className="mt-1 block text-[12.5px] text-ink-3">{by.problem}</span>}
            </p>
            <div className="space-y-4">
              {changes.map((c, i) => (
                <ChangeRow
                  key={`${c.puzzleId}:${c.field.key}`}
                  change={c}
                  names={names}
                  heading={items.length > 1 ? items.find((it) => it.puzzle.id === c.puzzleId)?.puzzle.label : undefined}
                  onChange={(after) => setChanges((all) => all && all.map((x, j) => (j === i ? { ...x, after } : x)))}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

/** One piece of wording: what it said, the mentions marked, and the rewrite to edit. */
function ChangeRow({ change, names, heading, onChange }: { change: Change; names: string[]; heading?: string; onChange: (after: string) => void }) {
  const left = findPersonMentions(change.after, names)
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <p className="mb-1.5 text-[12px] font-semibold text-ink-3">
        {heading ? `${heading} · ` : ''}
        {change.field.label}
      </p>
      <p className="mb-2 text-[13.5px] leading-relaxed text-ink-3">
        <Marked text={change.field.text} names={names} />
      </p>
      <textarea
        value={change.after}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(6, Math.max(2, Math.ceil(change.after.length / 60)))}
        className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[15px] leading-relaxed text-ink outline-none focus:border-accent"
      />
      {left.length > 0 && (
        <p className="mt-1 text-[12.5px] font-medium text-warn">Still mentions {[...new Set(left.map((m) => `“${m.word}”`))].join(', ')}</p>
      )}
    </div>
  )
}

function Marked({ text, names }: { text: string; names: string[] }) {
  const parts: ReactNode[] = []
  let at = 0
  for (const m of findPersonMentions(text, names)) {
    if (m.start > at) parts.push(text.slice(at, m.start))
    parts.push(
      <mark key={m.start} className="rounded-[3px] bg-warn-soft px-0.5 text-warn line-through decoration-1">
        {m.word}
      </mark>,
    )
    at = m.end
  }
  parts.push(text.slice(at))
  return <>{parts}</>
}

const field = 'h-11 w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-[15px] text-ink outline-none focus:border-accent'
const NEW = '__new__'

/** Which Teach folder, lesson and section one position goes to. */
function PositionDestination({
  item,
  busy,
  disabled,
  onSend,
}: {
  item: TeachItem
  busy: boolean
  disabled: boolean
  onSend: (to: TeachDestination) => void
}) {
  const { data: folders = [] } = useTeachFolders()
  const last = useMemo(() => lastTeachDestination(), [])
  const [folderId, setFolderId] = useState<string>(last?.folderId ?? '')
  // The folder in hand: the one picked, else the first (made as "Teach" on send if there are none).
  const folder = folders.find((f) => f.id === folderId) ?? folders[0]
  const { data: lessons } = useLessonPlans(folder?.id)
  const [lessonId, setLessonId] = useState<string>(last?.lessonId ?? NEW)
  const lessonInFolder = lessons?.find((l) => l.id === lessonId)
  const chosenLesson = lessonInFolder ? lessonInFolder.id : NEW
  const { data: bundle } = useLesson(chosenLesson === NEW ? undefined : chosenLesson)
  const [sectionId, setSectionId] = useState<string>(last?.sectionId ?? '')
  const sameName = bundle?.sections.find((s) => s.title.toLowerCase() === item.sectionTitle.toLowerCase())
  const section = bundle?.sections.find((s) => s.id === sectionId) ?? (sectionId === NEW ? undefined : (sameName ?? bundle?.sections[0]))
  const generic = /^positions?$/i.test(item.sectionTitle.trim())
  const [lessonTitle, setLessonTitle] = useState(generic ? '' : item.sectionTitle)
  const [sectionTitle, setSectionTitle] = useState(item.sectionTitle || 'Positions')

  return (
    <section className="space-y-3">
      {folders.length > 1 && (
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold tracking-wider text-ink-3 uppercase">Folder</span>
          <select value={folder?.id ?? ''} onChange={(e) => setFolderId(e.target.value)} className={field}>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold tracking-wider text-ink-3 uppercase">Lesson in {folder?.name ?? TEACH_NAME}</span>
        <select value={chosenLesson} onChange={(e) => setLessonId(e.target.value)} className={field}>
          <option value={NEW}>New lesson</option>
          {lessons?.map((l) => (
            <option key={l.id} value={l.id}>
              Lesson {l.number}
              {l.title ? ` · ${l.title}` : ''}
            </option>
          ))}
        </select>
      </label>
      {chosenLesson === NEW ? (
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold tracking-wider text-ink-3 uppercase">The new lesson's title</span>
          <input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="e.g. Back-rank mates" className={field} />
        </label>
      ) : (
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold tracking-wider text-ink-3 uppercase">Section</span>
          <select value={section?.id ?? NEW} onChange={(e) => setSectionId(e.target.value)} className={field}>
            {bundle?.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
            <option value={NEW}>New section</option>
          </select>
        </label>
      )}
      {chosenLesson !== NEW && !section && (
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold tracking-wider text-ink-3 uppercase">The new section's name</span>
          <input value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} placeholder="e.g. Back rank" className={field} />
        </label>
      )}
      <Button
        variant="primary"
        block
        disabled={disabled || busy || (chosenLesson !== NEW && !section && !sectionTitle.trim())}
        onClick={() =>
          onSend({
            folderId: folder?.id,
            lesson: chosenLesson === NEW ? { title: lessonTitle.trim() } : { id: chosenLesson },
            section: section ? { id: section.id } : { title: sectionTitle.trim() || 'Positions' },
          })
        }
      >
        {busy ? 'Sending…' : 'Send to Teach'}
      </Button>
    </section>
  )
}

/** A whole lesson: which Teach folder, and the new lesson's title (its wording checked too). */
function LessonDestination({
  lesson,
  names,
  busy,
  disabled,
  onSend,
}: {
  lesson: { title: string; theme: string }
  names: string[]
  busy: boolean
  disabled: boolean
  onSend: (folderId: string | undefined, title: string, theme: string) => void
}) {
  const { data: folders = [] } = useTeachFolders()
  const last = useMemo(() => lastTeachDestination(), [])
  const [folderId, setFolderId] = useState<string>(last?.folderId ?? '')
  const folder = folders.find((f) => f.id === folderId) ?? folders[0]
  // A title like "Jojo's endgames" loses the name here and now; the coach sees it in the box.
  const [title, setTitle] = useState(() => withoutNames(lesson.title, names))
  const theme = withoutNames(lesson.theme, names)
  const left = findPersonMentions(title, names)
  return (
    <section className="space-y-3">
      {folders.length > 1 && (
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold tracking-wider text-ink-3 uppercase">Folder</span>
          <select value={folder?.id ?? ''} onChange={(e) => setFolderId(e.target.value)} className={field}>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1 block text-[12px] font-semibold tracking-wider text-ink-3 uppercase">New lesson in {folder?.name ?? TEACH_NAME}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. Back-rank mates" className={field} />
      </label>
      {left.length > 0 && <p className="-mt-1 text-[12.5px] font-medium text-warn">The title still mentions {left.map((m) => `“${m.word}”`).join(', ')}</p>}
      <p className="text-[13px] text-ink-2">Its sections and positions come along. The agenda stays with the student's lesson.</p>
      <Button variant="primary" block disabled={disabled || busy} onClick={() => onSend(folder?.id, title.trim(), theme)}>
        {busy ? 'Sending…' : 'Send to Teach'}
      </Button>
    </section>
  )
}

function Sent({ result, count, onClose }: { result: TeachResult; count: number; onClose: () => void }) {
  const { data: folders = [] } = useTeachFolders()
  const folder = folders.find((f) => f.id === result.folderId)
  return (
    <div className="space-y-4">
      <p className={clsx('rounded-xl bg-accent-soft px-3 py-2.5 text-[15px] font-medium text-accent-strong')}>
        {count === 1 ? 'Sent' : `${count} positions sent`} to {folder?.name ?? TEACH_NAME}. The student's {count === 1 ? 'position is' : 'positions are'} unchanged.
      </p>
      <div className="flex gap-2">
        <Link to={`/students/${result.folderId}/lessons/${result.lessonId}`} className="flex-1">
          <Button variant="primary" block>
            Open in Teach
          </Button>
        </Link>
        <Button className="flex-1" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}
