/**
 * The board speed check: measurements taken in the coach's own browser, on
 * real data, of what happens between pressing a piece and the screen
 * answering. Off unless switched on in Settings (or with #speedcheck in the
 * address); when off, every call here is a no-op.
 *
 * Two switches ride along, for trying causes one at a time on the device:
 *  - plain: the skin's effects off on the board (piece glows and filters,
 *    square textures, the backdrop);
 *  - quiet: background work off (the offline download and its saves, and
 *    re-reading data when the app comes back to the front).
 */

const KEY = 'speed-check'
const PLAIN_KEY = 'speed-check-plain'
const QUIET_KEY = 'speed-check-quiet'

const read = (k: string) => {
  try {
    return localStorage.getItem(k) === '1'
  } catch {
    return false
  }
}
const write = (k: string, on: boolean) => {
  try {
    if (on) localStorage.setItem(k, '1')
    else localStorage.removeItem(k)
  } catch {
    // storage off: the switch lasts until the page is reloaded
  }
}

export const speedCheckOn = () => read(KEY) || (typeof location !== 'undefined' && location.hash.includes('speedcheck'))
export const setSpeedCheck = (on: boolean) => write(KEY, on)
export const plainBoard = () => speedCheckOn() && read(PLAIN_KEY)
export const quietBackground = () => speedCheckOn() && read(QUIET_KEY)
export function setPlainBoard(on: boolean) {
  write(PLAIN_KEY, on)
  document.documentElement.classList.toggle('speed-plain', on)
}
export const setQuietBackground = (on: boolean) => write(QUIET_KEY, on)

/** One press of a piece, from the pointer going down to it coming up. */
export interface Press {
  at: number
  /** How late the browser delivered the press to the page. */
  pressDelay: number
  /** Press → the selection drawn (the frame after it rendered). */
  selectedPainted?: number
  /** Press → the lifted piece drawn. */
  liftedPainted?: number
  /** Press → the first pointer move the page received while held. */
  firstMove?: number
  /** Moves received while held, and the longest wait between two of them. */
  moves: number
  longestMoveGap: number
  /** Frames that took longer than 50 ms while it lasted: [ms after press, length]. */
  stalls: [number, number][]
  /** Data arriving and saves to the device while it lasted. */
  cacheUpdates: number
  saves: number
  saveMs: number
  held?: number
}

const presses: Press[] = []
let current: Press | null = null
let lastMoveAt = 0
let listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())
export const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const getPresses = () => presses

/** Called from the board: the selection / the lifted piece has rendered. */
export function markRendered(what: 'selected' | 'lifted') {
  const press = current
  if (!press) return
  // Two frames on, the rendered change has been drawn.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const ms = performance.now() - press.at
      if (what === 'selected' && press.selectedPainted === undefined) press.selectedPainted = ms
      if (what === 'lifted' && press.liftedPainted === undefined) press.liftedPainted = ms
      notify()
    }),
  )
}

export function noteCacheUpdate() {
  if (current) current.cacheUpdates++
}
export function noteSave(ms: number) {
  if (!current) return
  current.saves++
  current.saveMs += ms
}

let started = false
/** Start listening, once. */
export function startSpeedCheck() {
  if (started || !speedCheckOn()) return
  started = true
  if (read(PLAIN_KEY)) document.documentElement.classList.add('speed-plain')

  const onDown = (e: PointerEvent) => {
    if (!(e.target instanceof Element) || !e.target.closest('[data-square]')) return
    const now = performance.now()
    current = { at: e.timeStamp || now, pressDelay: Math.max(0, now - (e.timeStamp || now)), moves: 0, longestMoveGap: 0, stalls: [], cacheUpdates: 0, saves: 0, saveMs: 0 }
    lastMoveAt = current.at
    presses.unshift(current)
    presses.length = Math.min(presses.length, 12)
    notify()
  }
  const onMove = (e: PointerEvent) => {
    const press = current
    if (!press) return
    const t = e.timeStamp || performance.now()
    if (press.firstMove === undefined) press.firstMove = t - press.at
    press.moves++
    press.longestMoveGap = Math.max(press.longestMoveGap, t - lastMoveAt)
    lastMoveAt = t
  }
  const onUp = () => {
    const press = current
    if (!press) return
    press.held = performance.now() - press.at
    // Let a beat pass so the frames after letting go are counted too.
    setTimeout(() => {
      if (current === press) current = null
      notify()
    }, 400)
  }
  window.addEventListener('pointerdown', onDown, true)
  window.addEventListener('pointermove', onMove, true)
  window.addEventListener('pointerup', onUp, true)
  window.addEventListener('pointercancel', onUp, true)

  // A frame heartbeat: any gap over 50 ms is the page frozen.
  let last = performance.now()
  const beat = (t: number) => {
    const gap = t - last
    last = t
    if (current && gap > 50) current.stalls.push([Math.round(t - gap - current.at), Math.round(gap)])
    requestAnimationFrame(beat)
  }
  requestAnimationFrame(beat)
}

/** The report to paste back: the device, the switches and the last presses. */
export function speedReport(skin: string): string {
  const r = (n: number | undefined) => (n === undefined ? '-' : `${Math.round(n)}`)
  const lines = [
    `Board speed check · ${new Date().toISOString()}`,
    `Browser: ${navigator.userAgent}`,
    `Screen: ${innerWidth}x${innerHeight} @${devicePixelRatio}x · skin: ${skin} · plain: ${read(PLAIN_KEY) ? 'on' : 'off'} · quiet: ${read(QUIET_KEY) ? 'on' : 'off'}`,
    'press delay / selected drawn / lifted drawn / first move / moves / longest move gap / held / stalls / data updates / saves (ms)',
    ...presses.map(
      (p) =>
        `${r(p.pressDelay)} / ${r(p.selectedPainted)} / ${r(p.liftedPainted)} / ${r(p.firstMove)} / ${p.moves} / ${r(p.longestMoveGap)} / ${r(p.held)} / ${
          p.stalls.length ? p.stalls.map(([at, len]) => `${len}@${at}`).join(' ') : 'none'
        } / ${p.cacheUpdates} / ${p.saves}${p.saves ? ` (${Math.round(p.saveMs)} ms)` : ''}`,
    ),
  ]
  return lines.join('\n')
}

// Tests can reset between runs.
export function resetSpeedCheck() {
  presses.length = 0
  current = null
  listeners = new Set()
}
