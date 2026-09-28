import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import type { Reminder, Student } from '../../types/domain'
import { fmtDue } from '../../lib/schedule'
import { Card } from '../ui/Page'
import { Button, IconButton } from '../ui/Button'
import { Bell, Check, Close, Share, Trash } from '../ui/Icons'

/**
 * The reminders the schedule has written, open ones first by due date. Each
 * can be sent to Apple Reminders, ticked off here, or deleted.
 */
export function RemindersCard({
  reminders,
  students,
  onSend,
  onDone,
  onDelete,
}: {
  reminders: Reminder[]
  students: Map<string, Student>
  onSend: (r: Reminder) => void
  onDone: (r: Reminder, done: boolean) => void
  onDelete: (r: Reminder) => void
}) {
  const [showDone, setShowDone] = useState(false)
  // Read the clock once, when the card appears, to mark overdue reminders.
  const [now] = useState(() => Date.now())
  const open = reminders
    .filter((r) => !r.done)
    .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999') || b.created_at.localeCompare(a.created_at))
  const done = reminders.filter((r) => r.done)
  if (open.length === 0 && done.length === 0) return null
  return (
    <Card className="mb-6 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Bell size={18} className="text-accent-strong" />
        <h2 className="text-[16px] font-bold text-ink">Reminders</h2>
        {open.length > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[12px] font-bold text-accent-ink">{open.length}</span>}
      </div>
      <div className="mb-2" />
      {open.length === 0 && <p className="py-2 text-[14px] text-ink-3">All caught up.</p>}
      <ul className="divide-y divide-line">
        {open.map((r) => (
          <ReminderRow key={r.id} now={now} r={r} student={r.student_id ? students.get(r.student_id) : undefined} onSend={onSend} onDone={onDone} onDelete={onDelete} />
        ))}
      </ul>
      {done.length > 0 && (
        <>
          <button onClick={() => setShowDone(!showDone)} className="mt-2 text-[13px] font-semibold text-ink-3 underline underline-offset-2">
            {showDone ? 'Hide done' : `Show done (${done.length})`}
          </button>
          {showDone && (
            <ul className="mt-1 divide-y divide-line opacity-70">
              {done.map((r) => (
                <ReminderRow key={r.id} now={now} r={r} student={r.student_id ? students.get(r.student_id) : undefined} onSend={onSend} onDone={onDone} onDelete={onDelete} />
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}

function ReminderRow({
  now,
  r,
  student,
  onSend,
  onDone,
  onDelete,
}: {
  now: number
  r: Reminder
  student?: Student
  onSend: (r: Reminder) => void
  onDone: (r: Reminder, done: boolean) => void
  onDelete: (r: Reminder) => void
}) {
  const overdue = !r.done && r.due_at && new Date(r.due_at).getTime() < now
  return (
    <li className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-2 py-3 sm:grid-cols-[auto_1fr_auto]">
      <button
        onClick={() => onDone(r, !r.done)}
        aria-pressed={r.done}
        aria-label={r.done ? 'Mark not done' : 'Mark done'}
        className={clsx(
          'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition active:scale-90',
          r.done ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-transparent',
        )}
      >
        <Check size={15} />
      </button>
      <div className="min-w-0 flex-1">
        <p className={clsx('text-[15px] leading-snug font-semibold', r.done ? 'text-ink-3 line-through' : 'text-ink')}>
          {student && <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle ring-1 ring-black/10" style={{ background: student.color }} />}
          {r.title}
        </p>
        {r.notes && <p className="mt-0.5 text-[13px] leading-snug whitespace-pre-line text-ink-3">{r.notes}</p>}
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
          {r.due_at && <span className={overdue ? 'font-semibold text-danger' : 'text-ink-2'}>Due {fmtDue(r.due_at)}</span>}
          {r.shared_at && (
            <span className="flex items-center gap-1 font-semibold text-accent-strong">
              <Check size={13} /> Sent to Reminders
            </span>
          )}
        </p>
      </div>
      <div className="col-start-2 -ml-2 flex items-center gap-1 sm:col-start-3 sm:row-start-1 sm:ml-0">
        {!r.done && (
          <Button size="sm" variant={r.shared_at ? 'ghost' : 'soft'} icon={<Share size={15} />} onClick={() => onSend(r)}>
            {r.shared_at ? 'Send again' : 'Add to Reminders'}
          </Button>
        )}
        <IconButton label="Delete reminder" className="h-9 w-9 text-ink-3" onClick={() => onDelete(r)}>
          <Trash size={17} />
        </IconButton>
      </div>
    </li>
  )
}

/**
 * The note that pops up after a cancel or a move: the reminder it wrote,
 * with the button to send it on while it's fresh.
 */
export function ReminderToast({ reminder, onSend, onClose }: { reminder: Reminder | null; onSend: (r: Reminder) => void; onClose: () => void }) {
  // It stays long enough to act on, then steps aside; the reminder waits in the list above.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!reminder) return
    const t = setTimeout(() => close.current(), 20000)
    return () => clearTimeout(t)
  }, [reminder])
  return (
    <AnimatePresence>
      {reminder && (
        <motion.div
          role="status"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="pb-safe fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-4"
        >
          <div className="flex w-full max-w-lg items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-float">
            <Bell size={20} className="mt-0.5 shrink-0 text-accent-strong" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold tracking-[0.1em] text-ink-3 uppercase">Reminder written</p>
              <p className="text-[14.5px] leading-snug font-semibold text-ink">{reminder.title}</p>
              <Button
                size="sm"
                variant="primary"
                icon={<Share size={15} />}
                className="mt-2"
                onClick={() => {
                  onSend(reminder)
                  onClose()
                }}
              >
                Add to Apple Reminders
              </Button>
            </div>
            <IconButton label="Close" className="-mt-1 -mr-1 h-9 w-9" onClick={onClose}>
              <Close size={18} />
            </IconButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
