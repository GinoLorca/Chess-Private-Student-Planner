import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import scheduleSql from '../../supabase/migrations/0009_schedule.sql?raw'
import rateSql from '../../supabase/migrations/0010_student_rate.sql?raw'
import type { Reminder, ScheduleSlot, Student } from '../types/domain'
import {
  useReminders,
  useScheduleChanges,
  useScheduleMissing,
  useScheduleMutations,
  useScheduleSlots,
  useRateMissing,
  useStudentPlaces,
  useStudents,
} from '../lib/queries'
import { RATE_MIGRATION, SCHEDULE_MIGRATION } from '../lib/data'
import {
  WEEKDAYS,
  addDays,
  addMinutes,
  directionsUrl,
  fmtDay,
  fmtTime,
  fmtWeekRange,
  isOn,
  shortName,
  todayIso,
  weekLabel,
  weekOccurrences,
  weekStart,
  weekdayName,
  type Occurrence,
} from '../lib/schedule'
import { copyText } from '../lib/links'
import { fmtMonth, lessonFee, monthOccurrences, monthOfWeek, setShowEarnings, tally, useShowEarnings } from '../lib/earnings'
import { LedgerCard } from '../components/schedule/Ledger'
import { Page, Card, SectionLabel, EmptyState, LoadingPage } from '../components/ui/Page'
import { Button, IconButton } from '../components/ui/Button'
import { ActionSheet } from '../components/ui/ActionSheet'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Calendar, ChevronLeft, ChevronRight, Close, Copy, MapPin, Plus, Refresh, Train, Trash } from '../components/ui/Icons'
import type { ActionItem } from '../components/ui/ActionSheet'
import { WeekView } from '../components/schedule/Week'
import { CancelModal, LessonSheet, LessonTimeModal, SlotModal, type LessonTimeValues, type SlotValues } from '../components/schedule/Sheets'
import { RemindersCard, ReminderToast } from '../components/schedule/Reminders'
import { sendToReminders } from '../lib/sendReminder'
import { PlaceModal, PlacesSection } from '../components/schedule/Places'

/**
 * The coach's week: who they see, on what day, at what time. The regular
 * week is set once; a cancellation or a move changes one week only and writes
 * a reminder to send on to Apple Reminders. Below: the regular week itself,
 * and each student's address and door codes.
 */
export function SchedulePage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const today = todayIso()
  const start = weekStart(params.get('week') ?? today)
  const setStart = (s: string) => setParams(s === weekStart(today) ? {} : { week: s }, { replace: true })

  const missing = useScheduleMissing()
  const ready = !(missing.data && missing.data.length > 0)
  const { data: studentList, isLoading: loadingStudents } = useStudents()
  const slots = useScheduleSlots(ready)
  const changes = useScheduleChanges(ready)
  const reminders = useReminders(ready)
  const placesQ = useStudentPlaces(ready)
  const m = useScheduleMutations()
  const showEarnings = useShowEarnings()
  const rateMissing = useRateMissing(ready && showEarnings)
  const [now] = useState(() => new Date())
  const [rateCopied, setRateCopied] = useState(false)

  const students = useMemo(() => new Map((studentList ?? []).map((s) => [s.id, s])), [studentList])
  const places = useMemo(() => new Map((placesQ.data ?? []).map((p) => [p.student_id, p])), [placesQ.data])
  const occurrences = weekOccurrences(start, slots.data ?? [], changes.data ?? [])

  const [opened, setOpened] = useState<Occurrence | null>(null)
  const [quick, setQuick] = useState<Occurrence | null>(null)
  const [moving, setMoving] = useState<Occurrence | null>(null)
  const [cancelling, setCancelling] = useState<Occurrence | null>(null)
  const [undoing, setUndoing] = useState<Occurrence | null>(null)
  const [adding, setAdding] = useState(false)
  const [addingExtra, setAddingExtra] = useState(false)
  const [slotEdit, setSlotEdit] = useState<{ slot: ScheduleSlot | null; initial: SlotValues } | null>(null)
  const [deletingSlot, setDeletingSlot] = useState<ScheduleSlot | null>(null)
  const [placeFor, setPlaceFor] = useState<Student | null>(null)
  const [toast, setToast] = useState<Reminder | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if ((loadingStudents && !studentList) || (missing.isLoading && !missing.data)) return <LoadingPage />

  if (!ready) {
    return (
      <Page back="/" title="Schedule">
        <div role="alert" className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-[14px] text-warn">
          <p className="font-semibold">One database update is needed before the schedule can be saved.</p>
          <p className="mt-1">
            In Supabase → SQL Editor → New query, paste {SCHEDULE_MIGRATION} and Run, once. It adds the weekly schedule, the reminders and
            each student's address and door codes.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await copyText(scheduleSql)
                setCopied(true)
              }}
            >
              {copied ? 'Copied' : 'Copy the SQL'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => missing.refetch()}>
              I've run it, check again
            </Button>
          </div>
          <p className="mt-2 text-[12.5px]">It's supabase/migrations/{SCHEDULE_MIGRATION} in the repo.</p>
        </div>
      </Page>
    )
  }

  const roster = studentList ?? []
  const nameOf = (id: string) => students.get(id)?.name ?? 'Student'
  const weekChanges = new Set(occurrences.filter((o) => o.change).map((o) => o.change!.id))
  const cancelled = occurrences.filter((o) => o.state === 'cancelled').length
  const moved = new Set(occurrences.filter((o) => o.state === 'moved-away' || o.state === 'moved-here').map((o) => o.change!.id)).size
  const extras = occurrences.filter((o) => o.state === 'extra').length
  const onCount = occurrences.filter(isOn).length
  const summary = [
    `${onCount} ${onCount === 1 ? 'lesson' : 'lessons'}`,
    moved && `${moved} moved`,
    cancelled && `${cancelled} cancelled`,
    extras && `${extras} one-off`,
  ].filter(Boolean)

  // --- actions ---------------------------------------------------------------

  async function send(r: Reminder) {
    const how = await sendToReminders(r)
    if (how === 'cancelled') return
    if (how === 'failed') {
      setNotice("Couldn't open the share sheet or copy the text on this device.")
      return
    }
    m.updateReminder.mutate({ id: r.id, patch: { shared_at: new Date().toISOString() } })
    if (how === 'copied') setNotice('Copied. Paste it into a new reminder in Apple Reminders.')
  }

  const originalDate = (o: Occurrence) => o.change?.original_date ?? o.date

  async function saveMove(o: Occurrence, v: LessonTimeValues) {
    if (o.state === 'extra') {
      const { reminder } = await m.change.mutateAsync({
        input: { slot_id: null, student_id: o.studentId, kind: 'extra', original_date: null, new_date: v.date, new_time: v.time, duration_min: v.duration, note: v.note },
        id: o.change!.id,
        studentName: nameOf(o.studentId),
        slot: null,
      })
      setToast(reminder)
      return
    }
    const slot = o.slot!
    const from = originalDate(o)
    // Moved back to its own day and time: that's just the regular lesson again.
    if (v.date === from && v.time === slot.start_time && v.duration === slot.duration_min) {
      if (o.change) await m.undo.mutateAsync(o.change.id)
      return
    }
    const { reminder } = await m.change.mutateAsync({
      input: {
        slot_id: slot.id,
        student_id: o.studentId,
        kind: 'moved',
        original_date: from,
        new_date: v.date,
        new_time: v.time,
        duration_min: v.duration === slot.duration_min ? null : v.duration,
        note: v.note,
      },
      studentName: nameOf(o.studentId),
      slot,
    })
    setToast(reminder)
    // Follow the lesson if it moved into another week.
    if (weekStart(v.date) !== start) setStart(weekStart(v.date))
  }

  async function saveCancel(o: Occurrence, note: string) {
    const { reminder } = await m.change.mutateAsync({
      input: { slot_id: o.slot!.id, student_id: o.studentId, kind: 'cancelled', original_date: originalDate(o), new_date: null, new_time: null, duration_min: null, note },
      studentName: nameOf(o.studentId),
      slot: o.slot,
    })
    setToast(reminder)
  }

  async function saveExtra(v: LessonTimeValues) {
    const { reminder } = await m.change.mutateAsync({
      input: { slot_id: null, student_id: v.studentId, kind: 'extra', original_date: null, new_date: v.date, new_time: v.time, duration_min: v.duration, note: v.note },
      studentName: nameOf(v.studentId),
      slot: null,
    })
    setToast(reminder)
    if (weekStart(v.date) !== start) setStart(weekStart(v.date))
  }

  async function saveSlot(v: SlotValues) {
    const input = { student_id: v.studentId, weekday: v.weekday, start_time: v.time, duration_min: v.duration }
    if (slotEdit?.slot) await m.updateSlot.mutateAsync({ id: slotEdit.slot.id, patch: input })
    else await m.addSlot.mutateAsync(input)
  }

  const moveInitial = (o: Occurrence): LessonTimeValues => ({
    studentId: o.studentId,
    date: o.change?.new_date ?? o.date,
    time: o.change?.new_time ?? o.slot?.start_time ?? o.time,
    duration: o.change?.duration_min ?? o.slot?.duration_min ?? o.duration,
    note: o.change?.note ?? '',
  })

  /** The right-click / long-press menu: this week's changes, as the lesson's state allows. */
  const quickItems = (o: Occurrence): ActionItem[] => {
    const details: ActionItem = { label: 'Details, address and codes', icon: <MapPin />, onSelect: () => setOpened(o) }
    const address = places.get(o.studentId)?.address
    const travel: ActionItem[] = address
      ? [
          { label: 'Copy the address', icon: <Copy />, onSelect: () => void copyText(address).then((ok) => ok && setNotice(`Copied: ${address}`)) },
          { label: 'Transit route and ETA', icon: <Train />, onSelect: () => window.open(directionsUrl(address, 'transit'), '_blank', 'noopener') },
        ]
      : []
    return [...lessonItems(o), ...travel, details]
  }
  const lessonItems = (o: Occurrence): ActionItem[] => {
    switch (o.state) {
      case 'regular':
        return [
          { label: "Reschedule this week's lesson", icon: <Calendar />, onSelect: () => setMoving(o) },
          { label: "Cancel this week's lesson", icon: <Close />, danger: true, onSelect: () => setCancelling(o) },
        ]
      case 'cancelled':
        return [
          { label: "It's back on: undo the cancellation", icon: <Refresh />, onSelect: () => setUndoing(o) },
          { label: 'Reschedule it instead', icon: <Calendar />, onSelect: () => setMoving(o) },
        ]
      case 'moved-away':
      case 'moved-here':
        return [
          { label: 'Change the new day or time', icon: <Calendar />, onSelect: () => setMoving(o) },
          { label: 'Undo: back to the regular time', icon: <Refresh />, onSelect: () => setUndoing(o) },
          { label: 'Cancel it altogether', icon: <Close />, danger: true, onSelect: () => setCancelling(o) },
        ]
      case 'extra':
        return [
          { label: 'Change the day or time', icon: <Calendar />, onSelect: () => setMoving(o) },
          { label: 'Remove this one-off lesson', icon: <Trash />, danger: true, onSelect: () => setUndoing(o) },
        ]
    }
  }

  const openSlot = (slot: ScheduleSlot | null, preset?: Partial<SlotValues>) =>
    setSlotEdit({
      slot,
      initial: slot
        ? { studentId: slot.student_id, weekday: slot.weekday, time: slot.start_time, duration: slot.duration_min }
        : { studentId: roster[0]?.id ?? '', weekday: 2, time: '16:00', duration: 60, ...preset },
    })

  const slotList = (slots.data ?? []).filter((s) => students.has(s.student_id))

  // What the lessons come to, for the ledger and each lesson's fee.
  const rates = new Map((placesQ.data ?? []).map((p) => [p.student_id, p.hourly_rate ?? null]))
  const hasRates = [...rates.values()].some((r) => r != null)
  // This week's ledger is this month's; any other week goes to the month holding most of it.
  const month = start === weekStart(today) ? today.slice(0, 7) : monthOfWeek(start)
  const weekTally = tally(occurrences, rates, now)
  const monthTally = tally(monthOccurrences(month, slots.data ?? [], changes.data ?? []), rates, now)
  const loadError = slots.error ?? changes.error

  return (
    <Page
      back="/"
      title="Schedule"
      width="wide"
      actions={
        <IconButton label="Add a lesson" onClick={() => setAdding(true)}>
          <Plus />
        </IconButton>
      }
    >
      {notice && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[14px] text-ink-2">
          <p className="flex-1">{notice}</p>
          <button onClick={() => setNotice(null)} className="shrink-0 font-semibold underline underline-offset-2">
            OK
          </button>
        </div>
      )}
      {loadError && (
        <div role="alert" className="mb-4 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-[14px] text-warn">
          The schedule couldn't be loaded ({loadError instanceof Error ? loadError.message : 'unknown error'}). Pull down to try again.
        </div>
      )}

      <RemindersCard
        reminders={reminders.data ?? []}
        students={students}
        onSend={send}
        onDone={(r, done) => m.updateReminder.mutate({ id: r.id, patch: { done } })}
        onDelete={(r) => m.removeReminder.mutate(r.id)}
      />

      {/* The week */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <h2 className="text-[20px] font-bold text-on-bg">{weekLabel(start, today)}</h2>
          <p className="text-[14px] text-on-bg-2">
            {fmtWeekRange(start)}
            {slotList.length > 0 && ` · ${summary.join(' · ')}`}
          </p>
        </div>
        {start !== weekStart(today) && (
          <Button size="sm" variant="secondary" onClick={() => setStart(weekStart(today))}>
            This week
          </Button>
        )}
        <div className="flex rounded-xl border border-line-strong bg-surface">
          <IconButton label="Previous week" onClick={() => setStart(addDays(start, -7))}>
            <ChevronLeft />
          </IconButton>
          <IconButton label="Next week" onClick={() => setStart(addDays(start, 7))}>
            <ChevronRight />
          </IconButton>
        </div>
      </div>

      {slotList.length === 0 && weekChanges.size === 0 ? (
        <EmptyState
          title="No regular lessons yet"
          body="Add each student's usual day and time once. Every week then fills itself in, and cancellations and moves change just that week."
          action={
            <Button variant="primary" icon={<Plus size={18} />} onClick={() => openSlot(null)} disabled={roster.length === 0}>
              Add a regular lesson
            </Button>
          }
        />
      ) : (
        <WeekView
          start={start}
          occurrences={occurrences}
          students={students}
          places={places}
          today={today}
          fees={showEarnings ? new Map(occurrences.map((o) => [o.key, lessonFee(o, rates.get(o.studentId))])) : undefined}
          onOpen={setOpened}
          onMenu={setQuick}
        />
      )}
      <p className="mt-2 text-[13px] text-on-bg-2">
        Right-click or press and hold a lesson to reschedule or cancel it for this week only. Tap it for the address and door codes.
      </p>

      {showEarnings && slotList.length + weekChanges.size > 0 && (
        <LedgerCard
          week={weekTally}
          month={monthTally}
          weekTitle={weekLabel(start, today)}
          monthTitle={fmtMonth(month, today)}
          students={students}
          notice={
            rateMissing.data ? (
              <div className="rounded-xl bg-warn-soft px-3.5 py-3 text-[14px] text-warn">
                <p className="font-semibold">One more database update adds hourly rates.</p>
                <p className="mt-1">In Supabase → SQL Editor, paste {RATE_MIGRATION} and Run, once.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await copyText(rateSql)
                      setRateCopied(true)
                    }}
                  >
                    {rateCopied ? 'Copied' : 'Copy the SQL'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => rateMissing.refetch()}>
                    I've run it, check again
                  </Button>
                </div>
              </div>
            ) : !hasRates ? (
              <p className="text-[14px] text-ink-2">
                Add each student's hourly rate (the <span className="font-semibold">+ Rate</span> tag on their card below) to see what every lesson,
                the week and the month come to.
              </p>
            ) : undefined
          }
          onSetRate={(id) => setPlaceFor(students.get(id) ?? null)}
          onHide={() => {
            setShowEarnings(false)
            setNotice('Earnings are hidden on this device. Settings → Schedule shows them again.')
          }}
        />
      )}

      {/* The regular week */}
      <div className="mt-10 mb-2 flex items-center justify-between gap-2">
        <SectionLabel tone="page" className="mb-0">
          Regular week
        </SectionLabel>
        <Button size="sm" variant="soft" icon={<Plus size={15} />} onClick={() => openSlot(null)} disabled={roster.length === 0}>
          Regular lesson
        </Button>
      </div>
      <Card className="divide-y divide-line px-4">
        {slotList.length === 0 ? (
          <p className="py-4 text-[14px] text-ink-3">Nothing yet. A regular lesson repeats every week on its day.</p>
        ) : (
          WEEKDAYS.filter((d) => slotList.some((s) => s.weekday === d.value)).map((d) => (
            <div key={d.value} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <p className="w-28 shrink-0 text-[14px] font-bold text-ink">{d.long}</p>
              <div className="flex flex-wrap gap-2">
                {slotList
                  .filter((s) => s.weekday === d.value)
                  .map((s) => {
                    const st = students.get(s.student_id)!
                    return (
                      <button
                        key={s.id}
                        onClick={() => openSlot(s)}
                        className="flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-3.5 text-[14px] transition active:scale-95"
                      >
                        <span className="block h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: st.color }} />
                        <span className="font-semibold text-ink">{shortName(st.name)}</span>
                        <span className="text-ink-2 tabular-nums">
                          {fmtTime(s.start_time)} – {fmtTime(addMinutes(s.start_time, s.duration_min))}
                        </span>
                      </button>
                    )
                  })}
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Where, and the codes to get in */}
      <SectionLabel tone="page" className="mt-10">
        Addresses and door codes
      </SectionLabel>
      <p className="-mt-1 mb-4 text-[14px] text-on-bg-2">
        Each student's lesson address, front door code and bathroom code. Tap a code to copy it.
      </p>
      {roster.length === 0 ? (
        <EmptyState title="No students yet" body="Add a student on the Students page first." />
      ) : (
        <PlacesSection students={roster} places={places} showRates={showEarnings && rateMissing.data === false} onEdit={setPlaceFor} />
      )}

      {/* Sheets and dialogs */}
      <LessonSheet
        occurrence={opened}
        student={opened ? students.get(opened.studentId) : undefined}
        place={opened ? places.get(opened.studentId) : undefined}
        rate={showEarnings && opened ? rates.get(opened.studentId) : undefined}
        onClose={() => setOpened(null)}
        actions={{
          onMove: () => setMoving(opened),
          onCancel: () => setCancelling(opened),
          onUndo: () => setUndoing(opened),
          onRemoveExtra: () => setUndoing(opened),
          onEditPlace: () => opened && setPlaceFor(students.get(opened.studentId) ?? null),
          onOpenFolder: () => opened && navigate(`/students/${opened.studentId}`),
          onEditSlot: () => opened?.slot && openSlot(opened.slot),
        }}
      />

      <LessonTimeModal
        open={Boolean(moving)}
        title={moving ? `${moving.state === 'extra' ? 'Move' : 'Reschedule'} ${shortName(nameOf(moving.studentId))}'s lesson` : ''}
        intro={
          moving?.slot ? (
            <>
              This week only. The regular {weekdayName(moving.slot.weekday)} {fmtTime(moving.slot.start_time)} lesson stays as it is, and a
              reminder is written.
            </>
          ) : (
            'A reminder is written for the new time.'
          )
        }
        submitLabel={moving?.state === 'extra' ? 'Save' : 'Move the lesson'}
        weekStart={start}
        initial={moving ? moveInitial(moving) : { studentId: '', date: start, time: '16:00', duration: 60, note: '' }}
        onClose={() => setMoving(null)}
        onSubmit={(v) => saveMove(moving!, v)}
      />

      <CancelModal
        open={Boolean(cancelling)}
        title={cancelling ? `Cancel ${shortName(nameOf(cancelling.studentId))}'s lesson on ${fmtDay(cancelling.change?.original_date ?? cancelling.date)}?` : ''}
        body={
          cancelling?.slot
            ? `Just this week. The regular ${weekdayName(cancelling.slot.weekday)} ${fmtTime(cancelling.slot.start_time)} lesson carries on after it, and a reminder is written.`
            : undefined
        }
        onClose={() => setCancelling(null)}
        onSubmit={(note) => saveCancel(cancelling!, note)}
      />

      <LessonTimeModal
        open={addingExtra}
        title="One-off lesson"
        intro="An extra lesson on one day only, such as a make-up. A reminder is written for it."
        submitLabel="Add the lesson"
        weekStart={start}
        initial={{ studentId: roster[0]?.id ?? '', date: start <= today && today <= addDays(start, 6) ? today : start, time: '16:00', duration: 60, note: '' }}
        students={roster}
        notePlaceholder="Make-up for last week…"
        onClose={() => setAddingExtra(false)}
        onSubmit={saveExtra}
      />

      <SlotModal
        open={Boolean(slotEdit)}
        title={slotEdit?.slot ? 'Regular lesson' : 'New regular lesson'}
        initial={slotEdit?.initial ?? { studentId: '', weekday: 2, time: '16:00', duration: 60 }}
        students={roster}
        onClose={() => setSlotEdit(null)}
        onSubmit={saveSlot}
        onDelete={slotEdit?.slot ? () => setDeletingSlot(slotEdit.slot) : undefined}
      />

      <ConfirmDialog
        open={Boolean(deletingSlot)}
        title="Remove this regular lesson?"
        body={
          deletingSlot
            ? `${nameOf(deletingSlot.student_id)} on ${weekdayName(deletingSlot.weekday)}s at ${fmtTime(deletingSlot.start_time)} stops repeating, and its cancellations and moves go with it.`
            : undefined
        }
        confirmLabel="Remove"
        onConfirm={() => m.removeSlot.mutateAsync(deletingSlot!.id)}
        onClose={() => setDeletingSlot(null)}
      />

      <ConfirmDialog
        open={Boolean(undoing)}
        title={undoing?.state === 'extra' ? 'Remove this one-off lesson?' : 'Put the lesson back to its regular time?'}
        body={
          undoing
            ? `${undoing.state === 'extra' ? '' : `${shortName(nameOf(undoing.studentId))} is back on ${fmtDay(undoing.change?.original_date ?? undoing.date)} at ${fmtTime(undoing.slot?.start_time ?? undoing.time)}. `}Its reminder is removed here; if you sent it to Apple Reminders, delete it there too.`
            : undefined
        }
        confirmLabel={undoing?.state === 'extra' ? 'Remove' : 'Put it back'}
        danger={undoing?.state === 'extra'}
        onConfirm={() => m.undo.mutateAsync(undoing!.change!.id)}
        onClose={() => setUndoing(null)}
      />

      <ActionSheet
        open={Boolean(quick)}
        onClose={() => setQuick(null)}
        title={quick ? `${shortName(nameOf(quick.studentId))} · ${fmtDay(quick.date)}, ${fmtTime(quick.time)}` : undefined}
        items={quick ? quickItems(quick) : []}
      />

      <ActionSheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Add"
        items={[
          { label: 'One-off lesson (a make-up, an extra)', icon: <Calendar />, onSelect: () => setAddingExtra(true) },
          { label: 'Regular weekly lesson', icon: <Plus />, onSelect: () => openSlot(null) },
        ]}
      />

      <PlaceModal
        student={placeFor}
        place={placeFor ? places.get(placeFor.id) : null}
        rate={!showEarnings ? 'off' : rateMissing.data === false ? 'on' : 'pending'}
        onClose={() => setPlaceFor(null)}
        onSave={(patch) => m.savePlace.mutateAsync({ studentId: placeFor!.id, patch })}
      />

      <ReminderToast reminder={toast} onSend={send} onClose={() => setToast(null)} />
    </Page>
  )
}
