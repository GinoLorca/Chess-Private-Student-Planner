/**
 * The Repertoire Lab pen system, so drawing feels the same in both apps:
 * four pens, a key HELD while dragging picks the colour for that one arrow,
 * green when nothing is held, and a plain left click wipes the lot.
 */
export interface Pen {
  id: 'green' | 'red' | 'blue' | 'yellow'
  name: string
  value: string
  /** Held during the drag to draw in this colour. */
  key: string
}

export const PENS: Pen[] = [
  { id: 'green', name: 'Green', value: '#2ecc71', key: 'z' },
  { id: 'red', name: 'Red', value: '#e5534b', key: 'r' },
  { id: 'blue', name: 'Blue', value: '#3b9cff', key: 'f' },
  { id: 'yellow', name: 'Yellow', value: '#e8b339', key: 'c' },
]

export const DEFAULT_PEN = PENS[0]

/** Square highlights are the pen colour at 40% so the piece stays readable. */
export const HIGHLIGHT_ALPHA = '66'

// Which pen keys are down right now, tracked once for the whole app. A key
// held while the pointer is busy dragging never reaches a text field, and the
// set empties when the window loses focus so a key can't get "stuck".
const held = new Set<string>()
let listening = false

function listen() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    held.add(e.key.toLowerCase())
  })
  window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()))
  window.addEventListener('blur', () => held.clear())
}

/** The pen a drag ending now would use: a held pen key wins, else the default. */
export function currentPen(): Pen {
  listen()
  return PENS.find((p) => held.has(p.key)) ?? DEFAULT_PEN
}

export function penHint(): string {
  return PENS.map((p) => `${p.key.toUpperCase()} ${p.name.toLowerCase()}`).join(' · ')
}

listen()
