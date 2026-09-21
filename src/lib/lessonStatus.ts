import { LESSON_STATUS, type LessonStatus } from '../types/domain'

export function statusLabel(status: LessonStatus | undefined): string {
  return LESSON_STATUS.find((s) => s.value === (status ?? 'planned'))?.label ?? 'Planned'
}

/** Planned → In progress → Taught → Planned. */
export function nextStatus(status: LessonStatus | undefined): LessonStatus {
  const order = LESSON_STATUS.map((s) => s.value)
  return order[(order.indexOf(status ?? 'planned') + 1) % order.length]
}
