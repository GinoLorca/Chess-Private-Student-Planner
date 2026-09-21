/** The square under a pointer event, or null when the pointer is off the board. */
export function squareAtPoint(x: number, y: number, within?: HTMLElement | null): string | null {
  const el = document.elementFromPoint(x, y)
  const sq = el?.closest?.('[data-square]') as HTMLElement | null
  if (!sq) return null
  if (within && !within.contains(sq)) return null
  return sq.dataset.square ?? null
}

/** Pointer events from a mouse's right button (the desktop arrow gesture). */
export function isSecondaryButton(e: { pointerType: string; button: number }) {
  return e.pointerType === 'mouse' && e.button === 2
}

/** Distance a pointer must travel before a press counts as a drag, not a tap. */
export const DRAG_THRESHOLD = 6
