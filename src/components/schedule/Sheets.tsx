import { useState, type ReactNode } from 'react'
import type { Student, StudentPlace } from '../../types/domain'
import { addMinutes, fmtDay, fmtTime, isOn, weekStart, whereLabel, type Occurrence } from '../../lib/schedule'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Calendar, Close, Folder, Pencil, Refresh, Trash } from '../ui/Icons'
import { DayPicker, Field, GroupLabel, LengthPicker, StudentPicker, WeekdayPicker, inputClass } from './Fields'
import { PlaceDetails } from './Places'
import { Badge } from './Week'

// ---------------------------------------------------------------------------
// the lesson, opened
// ---------------------------------------------------------------------------

export interface LessonActions {
  onMove: () => void
  onCancel: () => void
  onUndo: () => void
  onRemoveExtra: () => void
  onEditPlace: () => void
  onOpenFolder: () => void
  onEditSlot: () => void
}

/**
 * One lesson, opened from the week: when and where, the door codes, what
 * changed this week and why, and what can be done about it.
 */
export function LessonSheet({
  occurrence: o,
  student,
  place,
  onClose,
  actions,
}: {
  occurrence: Occurrence | null
  student?: Student
  place?: StudentPlace
  onClose: () => void
  actions: LessonActions
}) {
  const act = (fn: () => void) => () => {
    onClose()
    fn()
  }
  return (
    <Modal open={Boolean(o && student)} onClose={onClose} title={student?.name}>
      {o && student && (
        <div className="space-y-4">
          <div>
            <p className={isOn(o) ? 'text-[16px] font-semibold text-ink' : 'text-[16px] font-semibold text-ink-3 line-through'}>
              {fmtDay(o.date, { weekday: 'long' })} · {fmtTime(o.time)} – {fmtTime(addMinutes(o.time, o.duration))}
            </p>
            <StatusLine o={o} />
          </div>

          <div className="rounded-2xl border border-line bg-surface p-3">
            <PlaceDetails place={place} onEdit={act(actions.onEditPlace)} />
          </div>

          <div className="grid gap-2">
            {o.state === 'regular' && (
              <>
                <Action icon={<Calendar size={18} />} onClick={act(actions.onMove)} primary>
                  Reschedule this week's lesson
                </Action>
                <Action icon={<Close size={18} />} onClick={act(actions.onCancel)} danger>
                  Cancel this week's lesson
                </Action>
              </>
            )}
            {o.state === 'cancelled' && (
              <>
                <Action icon={<Refresh size={18} />} onClick={act(actions.onUndo)} primary>
                  It's back on: undo the cancellation
                </Action>
                <Action icon={<Calendar size={18} />} onClick={act(actions.onMove)}>
                  Reschedule it instead
                </Action>
              </>
            )}
            {(o.state === 'moved-away' || o.state === 'moved-here') && (
              <>
                <Action icon={<Calendar size={18} />} onClick={act(actions.onMove)} primary>
                  Change the new day or time
                </Action>
                <Action icon={<Refresh size={18} />} onClick={act(actions.onUndo)}>
                  Undo: back to the regular time
                </Action>
                <Action icon={<Close size={18} />} onClick={act(actions.onCancel)} danger>
                  Cancel it altogether
                </Action>
              </>
            )}
            {o.state === 'extra' && (
              <>
                <Action icon={<Calendar size={18} />} onClick={act(actions.onMove)} primary>
                  Change the day or time
                </Action>
                <Action icon={<Trash size={18} />} onClick={act(actions.onRemoveExtra)} danger>
                  Remove this one-off lesson
                </Action>
              </>
            )}
            <div className="mt-1 flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" icon={<Folder size={15} />} onClick={act(actions.onOpenFolder)}>
                Open the folder
              </Button>
              {o.slot && (
                <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={act(actions.onEditSlot)}>
                  Change the regular time
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function StatusLine({ o }: { o: Occurrence }) {
  const note = o.change?.note
  let line: ReactNode = null
  if (o.state === 'cancelled') line = <Badge tone="danger">Cancelled this week</Badge>
  else if (o.state === 'moved-away' && o.change?.new_date)
    line = <Badge tone="muted">Moved to {whereLabel(o.change.new_date, o.change.new_time ?? o.time, o.date)} this week</Badge>
  else if (o.state === 'moved-here' && o.change?.original_date && o.slot)
    line = <Badge tone="accent">Moved from {whereLabel(o.change.original_date, o.slot.start_time, o.date)}, this week only</Badge>
  else if (o.state === 'extra') line = <Badge tone="accent">One-off lesson</Badge>
  else if (o.slot) line = <span className="text-[13px] text-ink-3">Every {fmtDay(o.date, { weekday: 'long' }).split(',')[0]}</span>
  return (
    <div className="mt-1 space-y-1">
      {line}
      {note && <p className="text-[14px] text-ink-2">Reason: {note}</p>}
    </div>
  )
}

function Action({ icon, children, onClick, primary, danger }: { icon: ReactNode; children: ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <Button block variant={primary ? 'primary' : danger ? 'danger' : 'secondary'} icon={icon} onClick={onClick} className="justify-start">
      {children}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// forms
// ---------------------------------------------------------------------------

export interface LessonTimeValues {
  studentId: string
  date: string
  time: string
  duration: number
  note: string
}

/** Pick a day, time and length (and, for a one-off, the student); used to move a lesson or add one. */
export function LessonTimeModal({
  open,
  title,
  intro,
  submitLabel,
  weekStart: start,
  initial,
  students,
  notePlaceholder = 'Parent asked, school trip, sick…',
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  intro?: ReactNode
  submitLabel: string
  weekStart: string
  initial: LessonTimeValues
  /** Given for a one-off lesson, so the student can be chosen. */
  students?: Student[]
  notePlaceholder?: string
  onClose: () => void
  onSubmit: (v: LessonTimeValues) => Promise<void>
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {open && (
        <LessonTimeForm
          key={JSON.stringify(initial)}
          intro={intro}
          submitLabel={submitLabel}
          weekStart={start}
          initial={initial}
          students={students}
          notePlaceholder={notePlaceholder}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )}
    </Modal>
  )
}

function LessonTimeForm({
  intro,
  submitLabel,
  weekStart: start,
  initial,
  students,
  notePlaceholder,
  onClose,
  onSubmit,
}: {
  intro?: ReactNode
  submitLabel: string
  weekStart: string
  initial: LessonTimeValues
  students?: Student[]
  notePlaceholder: string
  onClose: () => void
  onSubmit: (v: LessonTimeValues) => Promise<void>
}) {
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = Boolean(v.studentId && v.date && /^\d\d:\d\d$/.test(v.time))
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!ready) return
        setBusy(true)
        setError(null)
        try {
          await onSubmit({ ...v, note: v.note.trim() })
          onClose()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'That could not be saved.')
        } finally {
          setBusy(false)
        }
      }}
    >
      {intro && <div className="-mt-1 text-[14px] text-ink-2">{intro}</div>}
      {students && (
        <div>
          <GroupLabel>Student</GroupLabel>
          <StudentPicker students={students} value={v.studentId} onChange={(studentId) => setV({ ...v, studentId })} />
        </div>
      )}
      <div>
        <GroupLabel>Day</GroupLabel>
        <DayPicker weekStart={v.date ? weekStart(v.date) : start} value={v.date} onChange={(date) => setV({ ...v, date })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[150px_1fr]">
        <Field label="Time">
          <input type="time" required value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} className={inputClass} />
        </Field>
        <div>
          <GroupLabel>Length</GroupLabel>
          <LengthPicker value={v.duration} onChange={(duration) => setV({ ...v, duration })} />
        </div>
      </div>
      <Field label="Reason or note (optional)">
        <input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder={notePlaceholder} className={inputClass} />
      </Field>
      {v.date && v.time && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-[14px] text-ink-2">
          {fmtDay(v.date, { weekday: 'long' })} at {fmtTime(v.time)} – {fmtTime(addMinutes(v.time, v.duration))}
        </p>
      )}
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Back
        </Button>
        <Button type="submit" variant="primary" disabled={busy || !ready}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

/** Cancel one week's lesson, with an optional reason for the reminder. */
export function CancelModal({
  open,
  title,
  body,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  body?: string
  onClose: () => void
  onSubmit: (note: string) => Promise<void>
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {open && <CancelForm body={body} onClose={onClose} onSubmit={onSubmit} />}
    </Modal>
  )
}

function CancelForm({ body, onClose, onSubmit }: { body?: string; onClose: () => void; onSubmit: (note: string) => Promise<void> }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          await onSubmit(note.trim())
          onClose()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'That could not be saved.')
        } finally {
          setBusy(false)
        }
      }}
    >
      {body && <p className="-mt-1 text-[14px] text-ink-2">{body}</p>}
      <Field label="Reason (optional)">
        <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sick, family trip, parent cancelled…" className={inputClass} />
      </Field>
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Back
        </Button>
        <Button type="submit" variant="danger" disabled={busy}>
          {busy ? 'Saving…' : 'Cancel the lesson'}
        </Button>
      </div>
    </form>
  )
}

export interface SlotValues {
  studentId: string
  weekday: number
  time: string
  duration: number
}

/** A regular weekly lesson: who, which weekday, what time, how long. */
export function SlotModal({
  open,
  title,
  initial,
  students,
  onClose,
  onSubmit,
  onDelete,
}: {
  open: boolean
  title: string
  initial: SlotValues
  students: Student[]
  onClose: () => void
  onSubmit: (v: SlotValues) => Promise<void>
  onDelete?: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {open && <SlotForm key={JSON.stringify(initial)} initial={initial} students={students} onClose={onClose} onSubmit={onSubmit} onDelete={onDelete} />}
    </Modal>
  )
}

function SlotForm({
  initial,
  students,
  onClose,
  onSubmit,
  onDelete,
}: {
  initial: SlotValues
  students: Student[]
  onClose: () => void
  onSubmit: (v: SlotValues) => Promise<void>
  onDelete?: () => void
}) {
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = Boolean(v.studentId && /^\d\d:\d\d$/.test(v.time))
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!ready) return
        setBusy(true)
        setError(null)
        try {
          await onSubmit(v)
          onClose()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'That could not be saved.')
        } finally {
          setBusy(false)
        }
      }}
    >
      <div>
        <GroupLabel>Student</GroupLabel>
        <StudentPicker students={students} value={v.studentId} onChange={(studentId) => setV({ ...v, studentId })} />
      </div>
      <div>
        <GroupLabel>Every</GroupLabel>
        <WeekdayPicker value={v.weekday} onChange={(weekday) => setV({ ...v, weekday })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[150px_1fr]">
        <Field label="Time">
          <input type="time" required value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} className={inputClass} />
        </Field>
        <div>
          <GroupLabel>Length</GroupLabel>
          <LengthPicker value={v.duration} onChange={(duration) => setV({ ...v, duration })} />
        </div>
      </div>
      {error && <p className="text-[14px] text-danger">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            className="text-danger"
            icon={<Trash size={16} />}
            onClick={() => {
              onClose()
              onDelete()
            }}
          >
            Remove
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Back
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !ready}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  )
}
