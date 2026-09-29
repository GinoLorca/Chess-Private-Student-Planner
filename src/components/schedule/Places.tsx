import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import type { PlaceCode, Student, StudentPlace } from '../../types/domain'
import type { PlacePatch } from '../../lib/data'
import { directionsUrl, type TravelMode } from '../../lib/schedule'
import { onColor } from '../../lib/colors'
import { copyText } from '../../lib/links'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Car, Check, Close, Copy, Key, MapPin, Pencil, Plus, Train, Walk } from '../ui/Icons'
import { Field, inputClass } from './Fields'
import { fmtRate } from '../../lib/earnings'

const hasAny = (p?: StudentPlace | null) =>
  Boolean(p && (p.address || p.door_code || p.bathroom_code || p.bathroom_note || p.notes || p.extra_codes?.length))

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
      {(() => {
        const tiles = [
          p.door_code && <CodeTile key="door" label="Front door" code={p.door_code} />,
          p.bathroom_code && <CodeTile key="bath" label="Bathroom" code={p.bathroom_code} note={p.bathroom_note} />,
          ...(p.extra_codes ?? []).filter((c) => c.code).map((c, i) => <CodeTile key={`x${i}`} label={c.label || 'Code'} code={c.code} />),
        ].filter(Boolean)
        return tiles.length > 0 && <div className={clsx('grid gap-2', tiles.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>{tiles}</div>
      })()}
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
  showRates,
  onEdit,
}: {
  students: Student[]
  places: Map<string, StudentPlace>
  showRates: boolean
  onEdit: (s: Student) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {students.map((s) => {
        const ink = onColor(s.color)
        return (
          <div key={s.id} className="min-w-0">
            <div className="flex items-end justify-between gap-2">
              <div className="ml-3 flex h-7 w-fit max-w-[70%] min-w-0 items-center rounded-t-xl px-3.5" style={{ background: s.color }}>
                <span className="truncate text-[12px] font-bold tracking-[0.08em] uppercase" style={{ color: ink.inkSoft }}>
                  {s.name}
                </span>
              </div>
              {showRates && (
                <button
                  type="button"
                  onClick={() => onEdit(s)}
                  className="mr-2 mb-1 shrink-0 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[12.5px] font-bold text-ink-2 tabular-nums"
                >
                  {places.get(s.id)?.hourly_rate != null ? fmtRate(places.get(s.id)!.hourly_rate!) : '+ Rate'}
                </button>
              )}
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
  rate,
  codes,
  onClose,
  onSave,
}: {
  student: Student | null
  place?: StudentPlace | null
  rate: 'on' | 'off' | 'pending'
  /** More codes can be saved; false while their database column (0012) is still to be added. */
  codes: boolean
  onClose: () => void
  onSave: (patch: PlacePatch) => Promise<void>
}) {
  return (
    <Modal open={Boolean(student)} onClose={onClose} title={student ? `${student.name}: details` : ''}>
      {student && <PlaceForm key={student.id} place={place} rate={rate} codes={codes} onClose={onClose} onSave={onSave} />}
    </Modal>
  )
}

type TextFields = Required<Omit<PlacePatch, 'hourly_rate' | 'extra_codes'>>

function PlaceForm({
  place,
  rate,
  codes,
  onClose,
  onSave,
}: {
  place?: StudentPlace | null
  /** Show the hourly rate field; 'pending' when its database column is still to be added. */
  rate: 'on' | 'off' | 'pending'
  codes: boolean
  onClose: () => void
  onSave: (patch: PlacePatch) => Promise<void>
}) {
  const [extra, setExtra] = useState<PlaceCode[]>(place?.extra_codes ?? [])
  const [v, setV] = useState<TextFields>({
    address: place?.address ?? '',
    door_code: place?.door_code ?? '',
    bathroom_code: place?.bathroom_code ?? '',
    bathroom_note: place?.bathroom_note ?? '',
    notes: place?.notes ?? '',
  })
  const [rateText, setRateText] = useState(place?.hourly_rate != null ? String(place.hourly_rate) : '')
  const rateValue = rateText.trim() === '' ? null : Number(rateText.replace(/[$,\s]/g, ''))
  const rateBad = rateValue !== null && (!Number.isFinite(rateValue) || rateValue < 0)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof TextFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value })
  return (
    <form
      className="space-y-3.5"
      onSubmit={async (e) => {
        e.preventDefault()
        if (rateBad) return
        setBusy(true)
        try {
          const patch: PlacePatch = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()]))
          if (rate === 'on') patch.hourly_rate = rateValue === null ? null : Math.round(rateValue * 100) / 100
          if (codes) patch.extra_codes = extra.map((c) => ({ label: c.label.trim(), code: c.code.trim() })).filter((c) => c.code || c.label)
          await onSave(patch)
          onClose()
        } finally {
          setBusy(false)
        }
      }}
    >
      {rate !== 'off' && (
        <div className="rounded-2xl border border-line bg-surface-2 p-3">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Hourly rate</span>
          {rate === 'pending' ? (
            <p className="text-[13.5px] text-warn">Rates can be saved once the 0010 database update is run (the Schedule shows the SQL).</p>
          ) : (
            <label className="flex h-12 items-center gap-1 rounded-xl border border-line-strong bg-surface px-3.5 focus-within:border-accent">
              <span className="font-display text-[22px] font-bold text-ink-3">$</span>
              <input
                value={rateText}
                onChange={(e) => setRateText(e.target.value)}
                inputMode="decimal"
                placeholder="60"
                aria-label="Hourly rate in dollars"
                className="w-full min-w-0 bg-transparent font-display text-[22px] font-bold text-ink tabular-nums outline-none"
              />
              <span className="shrink-0 text-[14px] text-ink-3">per hour</span>
            </label>
          )}
          {rateBad && <p className="mt-1 text-[13px] text-danger">Enter the rate as a number, like 60 or 62.50.</p>}
        </div>
      )}
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
      {codes && <MoreCodes codes={extra} onChange={setExtra} />}
      <Field label="Notes">
        <textarea value={v.notes} onChange={set('notes')} rows={2} placeholder="Parking, buzzer, who to ask for…" className={clsx(inputClass, 'h-auto py-2.5')} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy || rateBad}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}

/** Any number of further codes, each with what it opens: another venue, a second bathroom. */
function MoreCodes({ codes, onChange }: { codes: PlaceCode[]; onChange: (codes: PlaceCode[]) => void }) {
  const edit = (i: number, patch: Partial<PlaceCode>) => onChange(codes.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  return (
    <div className="space-y-2">
      {codes.map((c, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-end gap-2">
          <Field label={i === 0 ? 'More codes: what it opens' : ''}>
            <input
              value={c.label}
              onChange={(e) => edit(i, { label: e.target.value })}
              placeholder="Chick-fil-A bathroom"
              aria-label="What the code opens"
              className={inputClass}
            />
          </Field>
          <Field label={i === 0 ? 'Code' : ''}>
            <input
              value={c.code}
              onChange={(e) => edit(i, { code: e.target.value })}
              placeholder="19-18-07"
              aria-label="Code"
              autoCapitalize="off"
              className={clsx(inputClass, 'font-mono')}
            />
          </Field>
          <button
            type="button"
            onClick={() => onChange(codes.filter((_, j) => j !== i))}
            aria-label="Remove this code"
            className="mb-1.5 grid h-9 w-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2"
          >
            <Close size={17} />
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="soft" icon={<Plus size={15} />} onClick={() => onChange([...codes, { label: '', code: '' }])}>
        {codes.length ? 'Add another code' : 'Add a venue or bathroom code'}
      </Button>
    </div>
  )
}
