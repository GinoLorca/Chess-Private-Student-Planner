import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { Student } from '../../types/domain'
import { fmtHours, fmtMoney, type Tally } from '../../lib/earnings'
import { shortName } from '../../lib/schedule'
import { IconButton } from '../ui/Button'
import { EyeOff } from '../ui/Icons'

/**
 * What the lessons come to, set out like the foot of a receipt: the week
 * on the left, the month on the right, torn apart by a dashed rule. Each
 * side has its total in the display face, the lessons and hours behind it,
 * a bar split by student in their folder colours, and how much of it is
 * already earned. Cancellations and students with no rate yet are noted
 * underneath rather than folded silently into the sum.
 */
export function LedgerCard({
  week,
  month,
  weekTitle,
  monthTitle,
  students,
  notice,
  onSetRate,
  onHide,
}: {
  week: Tally
  month: Tally
  weekTitle: string
  monthTitle: string
  students: Map<string, Student>
  /** Shown in place of the figures, e.g. the database update still to run. */
  notice?: ReactNode
  onSetRate: (studentId: string) => void
  onHide: () => void
}) {
  return (
    <section
      aria-label="Earnings"
      className="relative mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
    >
      {/* The receipt's perforated top edge. */}
      <div
        aria-hidden
        className="h-2 w-full opacity-60"
        style={{ backgroundImage: 'radial-gradient(circle at 6px -2px, var(--color-bg, #f4f1ea) 5px, transparent 5.5px)', backgroundSize: '12px 8px' }}
      />
      <div className="flex items-center justify-between gap-2 px-4 pt-1.5 sm:px-5">
        <p className="text-[11px] font-bold tracking-[0.18em] text-ink-3 uppercase">Ledger</p>
        <IconButton label="Hide earnings" className="-mr-2 h-9 w-9 text-ink-3" onClick={onHide}>
          <EyeOff size={17} />
        </IconButton>
      </div>
      {notice ? (
        <div className="px-4 pb-4 sm:px-5">{notice}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <Side title={weekTitle} t={week} students={students} onSetRate={onSetRate} />
          <div className="relative border-t-2 border-dashed border-line sm:border-t-0 sm:border-l-2">
            <Side title={monthTitle} t={month} students={students} onSetRate={onSetRate} />
          </div>
        </div>
      )}
    </section>
  )
}

function Side({ title, t, students, onSetRate }: { title: string; t: Tally; students: Map<string, Student>; onSetRate: (id: string) => void }) {
  const toCome = Math.max(0, t.total - t.earned)
  const earnedPct = t.total > 0 ? Math.round((t.earned / t.total) * 100) : 0
  return (
    <div className="px-4 pt-2 pb-4 sm:px-5">
      <p className="text-[12px] font-bold tracking-[0.14em] text-ink-2 uppercase">{title}</p>
      <p className="mt-0.5 font-display text-[40px] leading-none font-bold tracking-tight text-ink tabular-nums">{fmtMoney(t.total)}</p>
      <p className="mt-1.5 text-[13.5px] text-ink-3">
        {t.lessons} {t.lessons === 1 ? 'lesson' : 'lessons'}
        {t.minutes > 0 && ` · ${fmtHours(t.minutes)}`}
      </p>

      {t.byStudent.length > 0 && (
        <>
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Split by student">
            {t.byStudent.map((s) => (
              <span
                key={s.studentId}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(s.amount / t.total) * 100}%`, background: students.get(s.studentId)?.color ?? 'var(--color-ink-3)' }}
                title={`${students.get(s.studentId)?.name ?? ''}: ${fmtMoney(s.amount)}`}
              />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1">
            {t.byStudent.map((s) => {
              const st = students.get(s.studentId)
              return (
                <li key={s.studentId} className="flex items-center gap-1.5 text-[13px]">
                  <span className="block h-2.5 w-2.5 rounded-full ring-1 ring-black/10" style={{ background: st?.color }} />
                  <span className="font-semibold text-ink">{st ? shortName(st.name) : 'Student'}</span>
                  <span className="text-ink-2 tabular-nums">{fmtMoney(s.amount)}</span>
                  {s.lessons > 1 && <span className="text-ink-3">×{s.lessons}</span>}
                </li>
              )
            })}
          </ul>

          <div className="mt-3">
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${earnedPct}%` }} />
            </div>
            <p className="mt-1 flex flex-wrap justify-between gap-x-3 text-[12.5px]">
              <span className={clsx('font-semibold', t.earned > 0 ? 'text-accent-strong' : 'text-ink-3')}>
                {t.earned >= t.total && t.total > 0 ? 'All earned' : t.earned > 0 ? `${fmtMoney(t.earned)} earned` : 'None earned yet'}
              </span>
              {toCome > 0 && <span className="text-ink-3">{fmtMoney(toCome)} to come</span>}
            </p>
          </div>
        </>
      )}

      {(t.cancelled.lessons > 0 || t.unpriced.length > 0) && (
        <div className="mt-2.5 space-y-1 border-t border-line pt-2 text-[12.5px] text-ink-3">
          {t.cancelled.lessons > 0 && (
            <p>
              {t.cancelled.lessons} cancelled
              {t.cancelled.amount > 0 && <> · <span className="line-through">{fmtMoney(t.cancelled.amount)}</span> not billed</>}
            </p>
          )}
          {t.unpriced.map((id) => (
            <p key={id}>
              No rate for {students.get(id) ? shortName(students.get(id)!.name) : 'a student'} yet ·{' '}
              <button onClick={() => onSetRate(id)} className="font-semibold text-accent-strong underline underline-offset-2">
                Set it
              </button>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
