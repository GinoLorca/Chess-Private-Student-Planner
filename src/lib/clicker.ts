/**
 * The presentation clicker's buttons. Next and back are fixed (Page Down /
 * Page Up, the arrow keys, space: what every clicker sends). The third
 * button, the one clickers use for a pointer or a blank screen, differs
 * per model, so the coach can teach it to the app once in Settings and it
 * becomes the hide / show key for the answer. Without teaching, the keys
 * clickers send on a long press (F5, Shift+F5) and for a blank screen do
 * the job.
 */
export type Trigger = { kind: 'key'; key: string; code: string } | { kind: 'mouse'; button: number }

const STORE = 'clicker-toggle'

/**
 * Keys that hide / show the answer without teaching: F5 and Shift+F5 are
 * what presentation clickers send on a long press (PowerPoint's "start
 * the show"); B, period and H are their "blank screen" keys.
 */
export const DEFAULT_TOGGLE_KEYS = ['f5', 'b', '.', 'h']

export function loadToggle(): Trigger | null {
  try {
    const raw = localStorage.getItem(STORE)
    return raw ? (JSON.parse(raw) as Trigger) : null
  } catch {
    return null
  }
}

export function saveToggle(trigger: Trigger | null) {
  try {
    if (trigger) localStorage.setItem(STORE, JSON.stringify(trigger))
    else localStorage.removeItem(STORE)
  } catch {
    // Private browsing or a full store: the defaults still work.
  }
}

export function keyLabel(key: string, code = ''): string {
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toUpperCase()
  if (key === 'Unidentified' && code) return code
  return key
}

export function describeTrigger(t: Trigger): string {
  return t.kind === 'key' ? `the ${keyLabel(t.key, t.code)} key` : `mouse button ${t.button}`
}

/** True for a text field, where keys must keep typing. */
export function isTextTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

export function isToggleKey(e: KeyboardEvent, custom: Trigger | null): boolean {
  if (custom?.kind === 'key' && (e.code === custom.code || (custom.key !== 'Unidentified' && e.key === custom.key))) return true
  return DEFAULT_TOGGLE_KEYS.includes(e.key.toLowerCase())
}

export function isToggleMouse(e: MouseEvent, custom: Trigger | null): boolean {
  return custom?.kind === 'mouse' && e.button === custom.button
}
