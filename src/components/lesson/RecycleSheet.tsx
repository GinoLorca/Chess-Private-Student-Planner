import { useMemo, useState } from 'react'
import type { Puzzle, Student } from '../../types/domain'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Recycle } from '../ui/Icons'
import { useLesson, useLessonPlans, useRecyclePosition, useStudents, useTeachFolders } from '../../lib/queries'
import { isTeach } from '../../lib/teach'
import { lastRecycleDestination, namesMentioned, rememberRecycleDestination, type RecycleDestination, type RecycleResult } from '../../lib/recycle'

interface RecycleSheetProps {
  open: boolean
  onClose: () => void
  puzzle: Puzzle | null
  /** The folder it's in (a student's or a Teach folder). */
  from: Student
  /** The section it's in: the new lesson's section is named after it, and a section of that name is picked first. */
  sectionTitle: string
  /** The lesson it's in, marked in the list. */
  currentLessonId: string
  onDone: (result: RecycleResult, info: { folderName: string; mentions: string[] }) => void
}

/**
 * Recycle one position: a copy of it in another lesson of this folder,
 * another student's, or (from Teach) another Teach folder's. Pick the folder,
 * the lesson (or a new one) and, when it has more than one, the section. The
 * last place used comes back at the top, so a run of positions goes in one
 * tap each.
 */
export function RecycleSheet({ open, onClose, puzzle, ...rest }: RecycleSheetProps) {
  return (
    <Modal open={open} onClose={onClose} title={`Recycle ${puzzle?.label || 'this position'}`}>
      {open && puzzle && <RecycleForm puzzle={puzzle} {...rest} onClose={onClose} />}
    </Modal>
  )
}

const field = 'h-11 w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-[15px] text-ink outline-none focus:border-accent'
const NEW = '__new__'
const label = 'mb-1 block text-[12px] font-semibold tracking-wider text-ink-3 uppercase'

function RecycleForm({ puzzle, from, sectionTitle, currentLessonId, onDone, onClose }: Omit<RecycleSheetProps, 'open' | 'puzzle'> & { puzzle: Puzzle }) {
  const { data: students = [] } = useStudents()
  const { data: teachFolders = [] } = useTeachFolders()
  const fromTeach = isTeach(from)
  // This folder first, then the students (private ones stay hidden), then, from Teach, the other Teach folders.
  // A student's position goes to Teach through Send to Teach, which takes the student out of the wording.
  const others = students.filter((s) => s.id !== from.id)
  const teachOthers = fromTeach ? teachFolders.filter((f) => f.id !== from.id) : []
  const folders = [from, ...others, ...teachOthers]
  const mentions = useMemo(() => (fromTeach ? [] : namesMentioned(puzzle, from.name)), [fromTeach, puzzle, from.name])
  const recycle = useRecyclePosition()
  const [error, setError] = useState<string | null>(null)

  const [folderId, setFolderId] = useState('')
  const folder = folders.find((f) => f.id === folderId)
  const { data: lessons } = useLessonPlans(folder?.id)
  const [lessonChoice, setLessonChoice] = useState<string | null>(null)
  // To start with: the folder's newest lesson not yet taught, else a new one.
  const lessonId = lessonChoice ?? lessons?.find((l) => l.status !== 'taught')?.id ?? NEW
  const lesson = lessons?.find((l) => l.id === lessonId)
  const { data: bundle } = useLesson(lesson?.id)
  const [sectionChoice, setSectionChoice] = useState<string | null>(null)
  const sections = bundle?.sections ?? []
  const sameName = sections.find((s) => s.title.toLowerCase() === sectionTitle.toLowerCase())
  const section = sections.find((s) => s.id === sectionChoice) ?? sameName ?? sections[0]
  const count = bundle ? Object.values(bundle.puzzlesBySection).reduce((n, list) => n + list.length, 0) : null
  const nextNumber = (lessons?.[0]?.number ?? 0) + 1

  // Again: where the last one went, while that lesson and section are still there.
  const last = useMemo(() => lastRecycleDestination(), [])
  const lastFolder = last ? folders.find((f) => f.id === last.studentId) : undefined
  const { data: lastLessons } = useLessonPlans(lastFolder?.id)
  const lastLesson = lastLessons?.find((l) => l.id === last?.lessonId)
  const { data: lastBundle } = useLesson(lastLesson?.id)
  const lastSection = lastBundle?.sections.find((s) => s.id === last?.sectionId)

  async function send(to: RecycleDestination, folderName: string) {
    setError(null)
    try {
      const result = await recycle.mutateAsync({ puzzle, to })
      rememberRecycleDestination({ studentId: result.studentId, lessonId: result.lessonId, sectionId: result.sectionId })
      onDone(result, { folderName, mentions: result.studentId === from.id ? [] : mentions })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const busy = recycle.isPending
  const sectionName = sectionTitle.trim() || 'Positions'
  return (
    <div className="space-y-5">
      {/* Named in its notes: said once, up front, for whichever student it goes to. */}
      {mentions.length > 0 && (
        <p className="text-[13px] font-medium text-warn">
          Its notes mention {mentions.map((m) => `“${m}”`).join(', ')}. Going to another student, edit the copy once it's there.
        </p>
      )}
      {lastFolder && lastLesson && lastSection && (
        <section className="space-y-2">
          {/* Its own button, not Button: a long folder and section name wraps instead of running off a phone. */}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void send({ studentId: lastFolder.id, lesson: { id: lastLesson.id, number: lastLesson.number }, section: { id: lastSection.id, title: lastSection.title } }, lastFolder.name)
            }
            className="flex w-full items-start gap-2 rounded-xl bg-accent-soft px-3.5 py-2.5 text-left text-[15px] font-semibold text-accent-strong transition hover:brightness-95 active:scale-[0.99] disabled:opacity-50"
          >
            <Recycle size={17} className="mt-0.5 shrink-0" />
            <span>
              Again: {lastFolder.name} · Lesson {lastLesson.number} · {lastSection.title || 'Untitled section'}
            </span>
          </button>
          <p className="pt-1 text-[12px] font-semibold tracking-wider text-ink-3 uppercase">Or somewhere else</p>
        </section>
      )}

      <section className="space-y-3">
        <label className="block">
          <span className={label}>Folder</span>
          <select
            value={folder?.id ?? ''}
            onChange={(e) => {
              setFolderId(e.target.value)
              setLessonChoice(null)
              setSectionChoice(null)
            }}
            className={field}
          >
            <option value="" disabled>
              Choose a folder…
            </option>
            <optgroup label="This folder">
              <option value={from.id}>{from.name}</option>
            </optgroup>
            {others.length > 0 && (
              <optgroup label="Students">
                {others.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            )}
            {teachOthers.length > 0 && (
              <optgroup label="Teach">
                {teachOthers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        {folder && lessons && (
          <label className="block">
            <span className={label}>Lesson</span>
            <select
              value={lessonId}
              onChange={(e) => {
                setLessonChoice(e.target.value)
                setSectionChoice(null)
              }}
              className={field}
            >
              <option value={NEW}>New lesson (Lesson {nextNumber})</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  Lesson {l.number}
                  {l.title ? ` · ${l.title}` : ''}
                  {l.status === 'taught' ? ' · taught' : ''}
                  {l.id === currentLessonId ? ' (this lesson)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        {folder && lessons && lessonId === NEW && (
          <p className="text-[13.5px] text-ink-2">
            Lesson {nextNumber} is made for it, with one section, “{sectionName}”.
          </p>
        )}
        {folder && lesson && bundle && (
          <>
            <p className="text-[13.5px] text-ink-2">
              {count === 0 ? 'No positions yet.' : `${count} position${count === 1 ? '' : 's'} so far.`}
              {sections.length === 1 ? ` It goes in “${sections[0].title || 'Untitled section'}”.` : ''}
            </p>
            {sections.length > 1 && (
              <label className="block">
                <span className={label}>Section</span>
                <select value={section?.id ?? ''} onChange={(e) => setSectionChoice(e.target.value)} className={field}>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title || 'Untitled section'}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        {error && <p className="rounded-xl bg-warn-soft px-3 py-2 text-[14px] text-warn">{error}</p>}

        <Button
          variant="primary"
          block
          disabled={!folder || !lessons || busy || (lessonId !== NEW && !bundle)}
          onClick={() =>
            folder &&
            void send(
              {
                studentId: folder.id,
                lesson: lesson ? { id: lesson.id, number: lesson.number } : { new: true },
                section: section ? { id: section.id, title: section.title } : { title: sectionName },
              },
              folder.name,
            )
          }
        >
          {busy ? 'Recycling…' : folder ? `Recycle to ${folder.name}` : 'Recycle'}
        </Button>
        <p className="text-[12.5px] text-ink-3">
          A copy, with its answer, notes, arrows and levels; its dot starts over at red. This one stays where it is.
        </p>
      </section>
    </div>
  )
}
