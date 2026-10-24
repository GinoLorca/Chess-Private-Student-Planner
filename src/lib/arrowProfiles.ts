import { useSyncExternalStore } from 'react'
import { parsePlacement } from './fen'

// ---------------------------------------------------------------------------
// Arrow colour profiles, from Chess Arcade (its ANNO_PROFILES and
// annoResolveColors, kept the same so the apps colour alike). A profile
// decides the colour of the marks the coach draws without a pen key:
//
//   default     the free pen: green, or a held pen key, as always.
//   sequential  arrows take SEQ_COLORS in the order they're drawn on the
//               position, the 11th starting over at green.
//   strategic   by side and captures: White green, Black blue, a White
//               capture red, a Black capture yellow, worked out by playing
//               the arrows on an imagined copy of the position.
//
// In both, a highlight takes the colour of the arrow drawn just before it
// (Sequential: green with none yet; Strategic: the side to move's colour).
// A held pen key still wins and keeps its own colour: in Sequential that
// arrow takes no step, in Strategic it still counts as a move of the line.
//
// Each mark the coach draws carries `seq` (draw order across arrows and
// highlights) and `auto` (the profile that coloured it, or false for a pen
// key or Default). Colours are worked out again whenever the marks change,
// so taking an arrow off recolours the ones after it, and stored: a
// lesson's saved arrows keep the colours they were drawn in, whatever
// profile a device is on later. Marks the app draws (answer arrows, hints)
// carry neither field and are never touched.
// ---------------------------------------------------------------------------

export type ArrowProfile = 'default' | 'sequential' | 'strategic'

export const SEQ_COLORS = ['#2ecc71', '#e8b339', '#3b9cff', '#e5534b', '#f97316', '#8b5cf6', '#f472b6', '#7dd3fc', '#8b5a2b', '#1a1a1a']
export const SEQ_NAMES = ['green', 'yellow', 'blue', 'red', 'orange', 'purple', 'pink', 'light blue', 'brown', 'black']
export const STRATEGIC = { w: '#2ecc71', b: '#3b9cff', wx: '#e5534b', bx: '#e8b339' }
/** The two darkest colours take a light halo, or they sink into dark squares. */
export const LIGHT_HALO = ['#8b5a2b', '#1a1a1a']

export const PROFILES: { id: ArrowProfile; label: string; blurb: string }[] = [
  { id: 'default', label: 'Default', blurb: 'Green, or the pen whose key you hold (Z, R, F, C).' },
  {
    id: 'sequential',
    label: 'Sequential',
    blurb: 'Each arrow on a position takes the next colour, no key needed: green, yellow, blue, red, orange, purple, pink, light blue, brown, black, then green again. A highlight takes the colour of the arrow before it.',
  },
  {
    id: 'strategic',
    label: 'Strategic',
    blurb: "White's moves green, Black's blue, White's captures red, Black's captures yellow, following the line arrow by arrow. A highlight takes the colour of the arrow before it.",
  },
]

/** The halo drawn round a mark with a profile on: dark, or light for the two darkest colours. */
export const haloFor = (color: string) => (LIGHT_HALO.includes(solid(color)) ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.45)')

/** A colour without its alpha: '#2ecc7166' -> '#2ecc71'. */
export const solid = (color: string) => (/^#[0-9a-f]{8}$/i.test(color) ? color.slice(0, 7) : color).toLowerCase()

/**
 * A highlight's fill: 40% in Default, as always; 70% with a profile on, so
 * each step keeps its own colour on a coloured square (black 55%, so a dark
 * piece on it doesn't vanish).
 */
export const highlightAlpha = (color: string, profiled: boolean) => (!profiled ? '66' : solid(color) === '#1a1a1a' ? '8c' : 'b3')

// ---------------------------------------------------------------------------
// The setting: per device, like Sounds.
// ---------------------------------------------------------------------------

const KEY = 'arrow-profile'
const EVENT = 'arrow-profile-change'
let fallback: ArrowProfile = 'default'
const valid = (v: unknown): v is ArrowProfile => v === 'default' || v === 'sequential' || v === 'strategic'

export function arrowProfile(): ArrowProfile {
  try {
    const v = localStorage.getItem(KEY)
    return valid(v) ? v : 'default'
  } catch {
    return fallback
  }
}

export function setArrowProfile(p: ArrowProfile) {
  fallback = p
  try {
    localStorage.setItem(KEY, p)
  } catch {
    // held for this visit
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Default → Sequential → Strategic → Default, as the label by a board cycles them. */
export function cycleArrowProfile() {
  const order: ArrowProfile[] = ['default', 'sequential', 'strategic']
  setArrowProfile(order[(order.indexOf(arrowProfile()) + 1) % order.length])
}

export function useArrowProfile(): ArrowProfile {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb)
      window.addEventListener('storage', cb)
      return () => {
        window.removeEventListener(EVENT, cb)
        window.removeEventListener('storage', cb)
      }
    },
    arrowProfile,
    () => 'default' as ArrowProfile,
  )
}

// ---------------------------------------------------------------------------
// The colouring.
// ---------------------------------------------------------------------------

/** What a drawn mark carries for the profiles (optional on BoardArrow / BoardHighlight). */
export interface ProfileMeta {
  /** The profile that coloured it, or false for a pen key or Default. Absent: the app's own mark. */
  auto?: Exclude<ArrowProfile, 'default'> | false
  /** Draw order, across arrows and highlights. */
  seq?: number
}

export interface ArrowLike extends ProfileMeta {
  startSquare: string
  endSquare: string
  color: string
}
export interface SquareLike extends ProfileMeta {
  square: string
  color: string
}

/** The next draw number for a set of marks. */
export const nextSeq = (arrows: ProfileMeta[], highlights: ProfileMeta[]) => Math.max(0, ...arrows.map((a) => a.seq ?? 0), ...highlights.map((h) => h.seq ?? 0)) + 1

const FILES = 'abcdefgh'
// Squares as Arcade numbers them: a1 = 0 … h8 = 63, White moving up a row.
const idx = (sq: string) => (Number(sq[1]) - 1) * 8 + FILES.indexOf(sq[0])

/**
 * The marks with the colours `profile` gives the ones it drew, worked out
 * from draw order on the position `fen`. Marks drawn by another profile, by
 * a pen key or by the app keep theirs. Default changes nothing.
 */
export function recolor<A extends ArrowLike, S extends SquareLike>(profile: ArrowProfile, fen: string, arrows: A[], highlights: S[]): { arrows: A[]; highlights: S[] } {
  if (profile === 'default') return { arrows, highlights }
  const placement = parsePlacement(fen)
  const parts = fen.trim().split(/\s+/)
  const turn: 'w' | 'b' = parts[1] === 'b' ? 'b' : 'w'
  // The imagined board: colour and type per square.
  const B: ('w' | 'b' | null)[] = Array(64).fill(null)
  const T: (string | null)[] = Array(64).fill(null)
  for (const [sq, code] of Object.entries(placement)) {
    if (!code) continue
    B[idx(sq)] = code[0] as 'w' | 'b'
    T[idx(sq)] = code[1].toLowerCase()
  }
  // ep[square] = the side that may take en passant there.
  const ep: Record<number, 'w' | 'b'> = {}
  if (parts[3] && /^[a-h][36]$/.test(parts[3])) ep[idx(parts[3])] = turn
  const left: Record<number, { c: 'w' | 'b'; t: string | null }> = {}
  const landed: Record<number, boolean> = {}
  const under: Record<number, 'w' | 'b' | null> = {}

  type Item = { seq: number; arrow?: number; square?: number }
  const items: Item[] = []
  arrows.forEach((a, i) => a.seq !== undefined && a.auto !== undefined && items.push({ seq: a.seq, arrow: i }))
  highlights.forEach((h, i) => h.seq !== undefined && h.auto !== undefined && items.push({ seq: h.seq, square: i }))
  items.sort((x, y) => x.seq - y.seq)

  const outA = [...arrows]
  const outS = [...highlights]
  let step = 0
  let cur: string | null = null
  let prev: 'w' | 'b' | null = null
  const mine = (m: ProfileMeta) => m.auto === profile

  for (const it of items) {
    if (it.arrow !== undefined) {
      const a = arrows[it.arrow]
      let c: string
      if (profile === 'sequential') {
        // A pen-key arrow, or one another profile coloured, takes no step.
        if (!mine(a)) continue
        c = SEQ_COLORS[step % SEQ_COLORS.length]
        step++
      } else {
        const from = idx(a.startSquare)
        const to = idx(a.endSquare)
        let mover = B[from]
        let kind = T[from]
        // Another idea for a piece an earlier arrow moved off this square: a fork, a fan of hops.
        if (!mover && left[from]) {
          mover = left[from].c
          kind = left[from].t
        }
        if (!mover) {
          mover = prev ? (prev === 'w' ? 'b' : 'w') : turn
          kind = null
        }
        // Your own piece there only because your earlier arrow landed: judged by what that arrow took.
        const ownLanded = B[to] === mover && landed[to]
        const victim = ownLanded ? under[to] : B[to]
        let capture = Boolean(victim) && victim !== mover
        let epTaken: number | null = null
        if (!B[to] && kind === 'p' && ep[to] === mover && Math.abs((from % 8) - (to % 8)) === 1 && Math.floor(to / 8) - Math.floor(from / 8) === (mover === 'w' ? 1 : -1)) {
          const v = Math.floor(from / 8) * 8 + (to % 8)
          if (B[v] && B[v] !== mover && T[v] === 'p') {
            capture = true
            epTaken = v
          }
        }
        c = mover === 'w' ? (capture ? STRATEGIC.wx : STRATEGIC.w) : capture ? STRATEGIC.bx : STRATEGIC.b
        // Played on the imagined copy, with no legality check (arrows are ideas).
        if (B[from] === mover) {
          left[from] = { c: mover, t: kind }
          B[from] = null
          T[from] = null
          landed[from] = false
        }
        if (!ownLanded) under[to] = B[to]
        if (epTaken !== null) {
          B[epTaken] = null
          T[epTaken] = null
        }
        B[to] = mover
        T[to] = kind
        landed[to] = true
        delete left[to]
        if (kind === 'p' && from % 8 === to % 8 && Math.abs(to - from) === 16) ep[(from + to) / 2] = mover === 'w' ? 'b' : 'w'
        prev = mover
      }
      cur = c
      if (mine(a) && a.color !== c) outA[it.arrow] = { ...a, color: c }
    } else if (it.square !== undefined) {
      const h = highlights[it.square]
      if (!mine(h)) continue
      const base = cur ?? (profile === 'sequential' ? SEQ_COLORS[0] : turn === 'w' ? STRATEGIC.w : STRATEGIC.b)
      // Stored at the usual 40%, as every highlight is; a profile's stronger fill is drawn, not stored.
      const color = base + '66'
      if (h.color !== color) outS[it.square] = { ...h, color }
    }
  }
  return { arrows: outA, highlights: outS }
}
