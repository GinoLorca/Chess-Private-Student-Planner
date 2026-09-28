import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import type { Student, StudentPlace } from '../../types/domain'
import type { PlacePatch } from '../../lib/data'
import { directionsUrl, type TravelMode } from '../../lib/schedule'
import { onColor } from '../../lib/colors'
import { copyText } from '../../lib/links'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Car, Check, Copy, Key, MapPin, Pencil, Train, Walk } from '../ui/Icons'
import { Field, inputClass } from './Fields'

const hasAny = (p?: StudentPlace | null) => Boolean(p && (p.address || p.door_code || p.bathroom_code || p.bathroom_note || p.notes))

/**
 * Where a student's lessons happen and the codes to get in, laid out to be
 * read on the doorstep: the address (tap to copy, or open the route and its
 * ETA), each code large enough to key in at a glance (tap one to copy it).
 */
export function PlaceDetails({ place, onEdit, compact }: { place?: StudentPlace | null; onEdit?: () => void; compact?: boolean }) {
  if (!hasAny(place)) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line-strong px-3.5 py-3 text-[14px] text-ink-3">
        <span>No address or door codes yet.</span>
        {onEdit && (
          <Button size="sm" variant="soft" icon={<Pencil size={15} />} onClick={onEdit}>
            Add
          </Button>
        )}
      </div>
    )
  }
  const p = place!
  return (
    <div className="space-y-2.5">
      {p.address && <AddressBlock address={p.address} />}
      {(p.door_code || p.bathroom_code) && (
        <div className={clsx('grid gap-2', p.door_code && p.bathroom_code ? 'grid-cols-2' : 'grid-cols-1')}>
          {p.door_code && <CodeTile label="Front door" code={p.door_code} />}
          {p.bathroom_code && <CodeTile label="Bathroom" code={p.bathroom_code} note={p.bathroom_note} />}
        </div>
      )}
      {!p.bathroom_code && p.bathroom_note && <p className="text-[14px] text-ink-2">Bathroom: {p.bathroom_note}</p>}
      {p.notes && !compact && <p className="text-[14px] leading-snug whitespace-pre-line text-ink-2">{p.notes}</p>}
      {onEdit && (
        <button onClick={onEdit} className="text-[13px] font-semibold text-accent-strong underline underline-offset-2">
          Edit address and codes
        </button>
      )}
    </div>
  )
}

const MODES: { mode: TravelMode; label: string; icon: ReactNode }[] = [
  { mode: 'transit', label: 'Transit', icon: <Train size={15} /> },
  { mode: 'walking', label: 'Walk', icon: <Walk size={15} /> },
  { mode: 'driving', label: 'Drive', icon: <Car size={15} /> },
]

/**
 * The address, ready to go: tap it (or Copy) to put it on the clipboard for
 * a transit app; Transit, Walk or Drive opens Apple Maps on the route from
 * wherever you are, with its ETA; Google Maps does the same there.
 */
function AddressBlock({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (await copyText(address)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }
  const chip = 'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold transition active:scale-95'
  return (
    <div>
      <button type="button" onClick={copy} title="Tap to copy the address" className="flex w-full items-start gap-3 text-left">
        <MapPin size={18} className="mt-0.5 shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1 text-[15px] leading-snug whitespace-pre-line text-ink">{address}</span>
      </button>
      <div className="mt-2 flex flex-wrap gap-1.5 pl-[30px]">
        <button type="button" onClick={copy} className={clsx(chip, copied ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2')}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        {MODES.map((m) => (
          <a
            key={m.mode}
            href={directionsUrl(address, m.mode)}
            target="_blank"
            rel="noopener noreferrer"
            title={`${m.label} route and ETA in Apple Maps`}
            className={clsx(chip, 'bg-accent-soft text-accent-strong')}
          >
            {m.icon}
            {m.label}
          </a>
        ))}
        <a
          href={directionsUrl(address, 'transit', 'google')}
          target="_blank"
          rel="noopener noreferrer"
          title="Transit route and ETA in Google Maps"
          className={clsx(chip, 'bg-surface-2 text-ink-2')}
        >
          Google Maps
        </a>
      </div>
    </div>
  )
}

function CodeTile({ label, code, note }: { label: string; code: string; note?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(code)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1400)
        }
      }}
      title="Tap to copy"
      className="min-w-0 rounded-xl border border-line bg-surface-2 px-3 py-2 text-left transition active:scale-[0.98]"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-ink-3 uppercase">
        <Key size={13} />
        {copied ? 'Copied' : label}
      </span>
      <span className="block truncate font-mono text-[22px] leading-tight font-bold tracking-wider text-ink">{code}</span>
      {note && <span className="block truncate text-[12.5px] text-ink-3">{note}</span>}
    </button>
  )
}

/** One card per student: their folder colour on a tab, the address and codes beneath. */
export function PlacesSection({
  students,
  places,
  onEdit,
}: {
  students: Student[]
  places: Map<string, StudentPlace>
  onEdit: (s: Student) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {students.map((s) => {
        const ink = onColor(s.color)
        return (
          <div key={s.id} className="min-w-0">
            <div className="ml-3 flex h-7 w-fit max-w-[80%] items-center rounded-t-xl px-3.5" style={{ background: s.color }}>
              <span className="truncate text-[12px] font-bold tracking-[0.08em] uppercase" style={{ color: ink.inkSoft }}>
                {s.name}
              </span>
            </div>
            <div className="rounded-2xl rounded-tl-md border-2 bg-surface p-3.5 shadow-card" style={{ borderColor: s.color }}>
              <PlaceDetails place={places.get(s.id)} onEdit={() => onEdit(s)} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function PlaceModal({
  student,
  place,
  onClose,
  onSave,
}: {
  student: Student | null
  place?: StudentPlace | null
  onClose: () => void
  onSave: (patch: PlacePatch) => Promise<void>
}) {
  return (
    <Modal open={Boolean(student)} onClose={onClose} title={student ? `${student.name}: where and codes` : ''}>
      {student && <PlaceForm key={student.id} place={place} onClose={onClose} onSave={onSave} />}
    </Modal>
  )
}

function PlaceForm({ place, onClose, onSave }: { place?: StudentPlace | null; onClose: () => void; onSave: (patch: PlacePatch) => Promise<void> }) {
  const [v, setV] = useState<Required<PlacePatch>>({
    address: place?.address ?? '',
    door_code: place?.door_code ?? '',
    bathroom_code: place?.bathroom_code ?? '',
    bathroom_note: place?.bathroom_note ?? '',
    notes: place?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof PlacePatch) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value })
  return (
    <form
      className="space-y-3.5"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await onSave(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()])) as PlacePatch)
          onClose()
        } finally {
          setBusy(false)
        }
      }}
    >
      <Field label="Address (home, store or venue)">
        <textarea value={v.address} onChange={set('address')} rows={2} placeholder="180 8th Ave, New York, NY" className={clsx(inputClass, 'h-auto py-2.5')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Front door code">
          <input value={v.door_code} onChange={set('door_code')} placeholder="4417#" autoCapitalize="off" className={clsx(inputClass, 'font-mono')} />
        </Field>
        <Field label="Bathroom code">
          <input value={v.bathroom_code} onChange={set('bathroom_code')} placeholder="1357" autoCapitalize="off" className={clsx(inputClass, 'font-mono')} />
        </Field>
      </div>
      <Field label="Which bathroom">
        <input value={v.bathroom_note} onChange={set('bathroom_note')} placeholder="McDonald's next door" className={inputClass} />
      </Field>
      <Field label="Notes">
        <textarea value={v.notes} onChange={set('notes')} rows={2} placeholder="Parking, buzzer, who to ask for…" className={clsx(inputClass, 'h-auto py-2.5')} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
