import clsx from 'clsx'
import type { LessonStatus } from '../../types/domain'
import { nextStatus } from '../../lib/lessonStatus'

/** The ICN Chess Club Planner's colours: red not given, yellow under way, green taught. */
const DOT: Record<LessonStatus, { color: string; label: string }> = {
  planned: { color: '#d64545', label: 'Not given yet' },
  in_progress: { color: '#e0a800', label: 'In progress' },
  taught: { color: '#2f8f4e', label: 'Taught' },
}

export const dotLabel = (s: LessonStatus | undefined) => DOT[s ?? 'planned'].label

/**
 * Red, yellow or green: whether a lesson or a position has been gone over.
 * Tap to move it on (red → yellow → green → red); read-only without a handler.
 * With `label` the words ride alongside.
 */
export function StatusDot({
  status,
  onTap,
  label,
  what = 'Status',
  className,
}: {
  status: LessonStatus | undefined
  onTap?: () => void
  label?: boolean
  /** What the dot is for, for its accessible name: "Lesson", "Position". */
  what?: string
  className?: string
}) {
  const s = status ?? 'planned'
  const { color, label: words } = DOT[s]
  const dot = <span className="block h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 0 2px ${color}33` }} />
  const text = label && <span className="text-[13px] font-semibold whitespace-nowrap text-ink-2">{words}</span>
  if (!onTap) {
    return (
      <span className={clsx('inline-flex items-center gap-1.5', className)} title={words} aria-label={`${what}: ${words}`}>
        {dot}
        {text}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onTap()
      }}
      title={`${words}: tap for ${DOT[nextStatus(s)].label.toLowerCase()}`}
      aria-label={`${what}: ${words}. Tap to change.`}
      className={clsx(
        'inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-full transition active:scale-90',
        label && 'border border-line bg-surface px-3',
        className,
      )}
    >
      {dot}
      {text}
    </button>
  )
}
