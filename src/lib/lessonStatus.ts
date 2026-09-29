import { LESSON_STATUS, type LessonStatus } from '../types/domain'

export function statusLabel(status: LessonStatus | undefined): string {
  return LESSON_STATUS.find((s) => s.value === (status ?? 'planned'))?.label ?? 'Planned'
}

/** Planned → In progress → Taught → Planned. */
export function nextStatus(status: LessonStatus | undefined): LessonStatus {
  const order = LESSON_STATUS.map((s) => s.value)
  return order[(order.indexOf(status ?? 'planned') + 1) % order.length]
}

/** The ICN Chess Club Planner's dot: red not given, yellow under way, green taught. */
export const STATUS_DOT: Record<LessonStatus, { color: string; label: string }> = {
  planned: { color: '#d64545', label: 'Not given yet' },
  in_progress: { color: '#e0a800', label: 'In progress' },
  taught: { color: '#2f8f4e', label: 'Taught' },
}

export const dotLabel = (s: LessonStatus | undefined) => STATUS_DOT[s ?? 'planned'].label
