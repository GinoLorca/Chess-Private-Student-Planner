import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { Student } from '../../types/domain'
import { WEEKDAYS, fmtDay, parseDate, shortName, weekDates } from '../../lib/schedule'
import { Chip, ChipRow } from '../ui/Chip'

export const inputClass =
  'h-11 w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-[16px] text-ink outline-none focus:border-accent'

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
    </label>
  )
}

/** A heading for a group of chips (a <label> can't wrap buttons). */
export function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[13px] font-medium text-ink-2">{children}</p>
}

export function StudentPicker({ students, value, onChange }: { students: Student[]; value: string; onChange: (id: string) => void }) {
  return (
    <ChipRow>
      {students.map((s) => (
        <Chip
          key={s.id}
          selected={value === s.id}
          onClick={() => onChange(s.id)}
          icon={<span className="block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: s.color }} />}
          title={s.name}
        >
          {shortName(s.name)}
        </Chip>
      ))}
    </ChipRow>
  )
}

export function WeekdayPicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <ChipRow>
      {WEEKDAYS.map((d) => (
        <Chip key={d.value} selected={value === d.value} onClick={() => onChange(d.value)} className="px-3">
          {d.short}
        </Chip>
      ))}
    </ChipRow>
  )
}

/** The seven days of a week as chips ("Tue 29"), plus a date field for anything further off. */
export function DayPicker({ weekStart, value, onChange }: { weekStart: string; value: string; onChange: (date: string) => void }) {
  const days = weekDates(weekStart)
  return (
    <div className="space-y-2">
      <ChipRow>
        {days.map((d) => (
          <Chip key={d} selected={value === d} onClick={() => onChange(d)} className="px-3">
            {fmtDay(d).replace(/,.*? (\d+)$/, ' $1')}
          </Chip>
        ))}
      </ChipRow>
      <input
        type="date"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label="Or pick any date"
        className={clsx(inputClass, 'max-w-[220px]')}
      />
      {value && !days.includes(value) && (
        <p className="text-[13px] text-ink-3">{parseDate(value).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      )}
    </div>
  )
}

const LENGTHS = [30, 45, 60, 90]

export function LengthPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <ChipRow>
      {LENGTHS.map((n) => (
        <Chip key={n} selected={value === n} onClick={() => onChange(n)} className="px-3">
          {n < 60 ? `${n} min` : n === 60 ? '1 hour' : `${n / 60} hours`}
        </Chip>
      ))}
      {!LENGTHS.includes(value) && (
        <Chip selected className="px-3">
          {value} min
        </Chip>
      )}
    </ChipRow>
  )
}
