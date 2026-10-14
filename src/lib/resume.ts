import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * Coming back to the same screen after iOS closes the app in the background.
 *
 * An installed app on the iPhone or iPad that sits behind other apps (or a
 * locked screen) for a while is shut down by iOS to free memory, and the
 * next time it's opened it starts again from its front page: the student
 * folders. Nothing tells the app that happened, and nothing tells it apart
 * from the coach swiping the app away in the app switcher: both look like a
 * fresh launch.
 *
 * So the app keeps a note of where it is: the screen, how far it's scrolled,
 * the little bits of state that make it that screen (the eye open or closed,
 * the move the answer is stepped to, the board flipped) and the visit's
 * session memory (an open section, positions ticked as gone over). Opened
 * again at its front page within KEEP_MS of being put away, it goes straight
 * back to that screen. Opened later than that, it starts fresh.
 *
 * Only for the installed app: a browser tab keeps its own address, and
 * typing the site's address into a new tab should land on the front page.
 */

const KEY = 'resume-v1'
/** How long after being put away the app still comes back to where it was. */
export const KEEP_MS = 12 * 60 * 60 * 1000

interface Snapshot {
  /** The screen: the router path plus its query, e.g. /students/x/lessons/y/coach?p=z. */
  route: string
  /** When the app was last on screen (put away, or last changed). */
  at: number
  scroll: number
  /** State registered by the screen through useResumeState, by key. */
  view: Record<string, unknown>
  /** The visit's sessionStorage, which iOS loses along with the app. */
  session: Record<string, string>
}

let current: Snapshot = { route: '/', at: 0, scroll: 0, view: {}, session: {} }
/** What this launch came back to, until the coach moves on from that screen. */
let restored: Snapshot | null = null
let started = false
/** Keys registered by the screens now showing. */
const live = new Set<string>()

export function isInstalledApp(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

/** The router path in the address bar (the part after #), '/' at the front page. */
function routeInAddress(): string {
  const hash = window.location.hash.replace(/^#/, '')
  return hash === '' ? '/' : hash
}

function read(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Snapshot
    return s && typeof s.route === 'string' && typeof s.at === 'number' ? s : null
  } catch {
    return null
  }
}

function sessionContents(): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k) out[k] = sessionStorage.getItem(k) ?? ''
    }
  } catch {
    // no session storage: nothing to carry over
  }
  return out
}

let timer = 0
function writeNow() {
  window.clearTimeout(timer)
  timer = 0
  current.at = Date.now()
  current.scroll = Math.round(window.scrollY)
  current.session = sessionContents()
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // storage full or off: the app just starts at the front page next time
  }
}
/** Written a moment later, so a burst of changes is one write. */
function write() {
  if (!timer) timer = window.setTimeout(writeNow, 400)
}

/**
 * Run once before the app first draws: opened at the front page soon after
 * being put away, go back to the screen it was on. Also starts keeping the
 * note up to date.
 */
export function restoreOnLaunch() {
  if (started) return
  started = true
  const saved = read()
  if (
    saved &&
    isInstalledApp() &&
    routeInAddress() === '/' &&
    saved.route !== '/' &&
    Date.now() - saved.at < KEEP_MS
  ) {
    window.history.replaceState(window.history.state, '', `#${saved.route}`)
    restored = saved
    // iOS dropped the visit's session memory along with the app: put it back.
    try {
      if (sessionStorage.length === 0) for (const [k, v] of Object.entries(saved.session ?? {})) sessionStorage.setItem(k, v)
    } catch {
      // no session storage
    }
  }
  current = { route: routeInAddress(), at: Date.now(), scroll: 0, view: { ...(restored?.view ?? {}) }, session: {} }

  // Put away (another app, the lock button, the app switcher): note where it
  // is right now, and save anything half-typed, since iOS may not wake the
  // app again before shutting it down.
  const away = () => {
    const el = document.activeElement
    if (isInstalledApp() && el instanceof HTMLElement && (el.matches('input, textarea, select') || el.isContentEditable)) el.blur()
    writeNow()
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') away()
  })
  window.addEventListener('pagehide', away)
  window.addEventListener('scroll', write, { passive: true })
}

/** The router moved to another screen (called by ResumeTracker). */
export function noteRoute(route: string) {
  if (route === current.route) return
  current.route = route
  // The screen restored at launch has been left: its saved state no longer
  // applies, and what it saved for screens no longer showing goes with it.
  if (restored && route !== restored.route) {
    restored = null
    for (const k of Object.keys(current.view)) if (!live.has(k)) delete current.view[k]
  }
  write()
}

/** The screen this launch came back to, while it's still the one showing. */
export const restoredSnapshot = () => restored

/** Forget the note (signing out). */
export function clearResume() {
  restored = null
  current = { route: '/', at: 0, scroll: 0, view: {}, session: {} }
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing saved anyway
  }
}

/**
 * useState that comes back with the screen. Pass a key naming what it is
 * and whose (e.g. `pos:${id}:eye`); while the screen is showing its value is
 * kept in the note, and when the app is reopened onto this screen after iOS
 * closed it, it starts from the kept value instead of `initial`. A null key
 * is plain useState.
 */
export function useResumeState<T>(key: string | null, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const kept = key && restored ? restored.view[key] : undefined
    if (kept !== undefined) return kept as T
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })
  useEffect(() => {
    if (!key) return
    current.view[key] = value
    write()
  }, [key, value])
  useEffect(() => {
    if (!key) return
    live.add(key)
    return () => {
      live.delete(key)
      delete current.view[key]
      write()
    }
  }, [key])
  return [value, setValue]
}
