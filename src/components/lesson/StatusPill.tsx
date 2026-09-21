import clsx from 'clsx'
import type { LessonStatus } from '../../types/domain'
import { nextStatus, statusLabel } from '../../lib/lessonStatus'

const STYLE: Record<LessonStatus, string> = {
  planned: 'bg-surface-2 text-ink-2',
  in_progress: 'bg-warn-soft text-warn',
  taught: 'bg-accent-soft text-accent-strong',
}

/** Planned → In progress → Taught, one tap each. Read-only when there's no handler. */
export function StatusPill({
  status,
  onTap,
  size = 'md',
}: {
  status: LessonStatus | undefined
  onTap?: () => void
  size?: 'sm' | 'md'
}) {
  const s = status ?? 'planned'
  const cls = clsx(
    'inline-flex shrink-0 items-center rounded-full font-semibold whitespace-nowrap',
    size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-9 px-3.5 text-[13px]',
    STYLE[s],
    onTap && 'transition active:scale-95',
  )
  if (!onTap) return <span className={cls}>{statusLabel(s)}</span>
  return (
    <button type="button" onClick={onTap} className={cls} title={`Tap to mark ${statusLabel(nextStatus(s))}`}>
      {statusLabel(s)}
    </button>
  )
}
