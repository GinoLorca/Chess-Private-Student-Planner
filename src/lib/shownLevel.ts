import { useSyncExternalStore } from 'react'
import type { Puzzle } from '../types/domain'
import { levelPuzzle, type LevelKey } from './levels'

// ---------------------------------------------------------------------------
// Which De-Construct level a broken-down position is shown at: Beginner,
// Intermediate or Advanced (the position itself). Picked from the Level
// dropdown wherever the position is shown and remembered per position on this
// device, so it comes back the way it was left. Advanced unless picked.
// ---------------------------------------------------------------------------

const KEY = 'shown-levels'
const EVENT = 'shown-level-change'
const NONE: Record<string, LevelKey> = {}

// The same map back until it changes, as useSyncExternalStore needs.
let cache: { raw: string | null; map: Record<string, LevelKey> } = { raw: null, map: NONE }
let fallback: Record<string, LevelKey> = NONE

function read(): Record<string, LevelKey> {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return fallback
  }
  if (raw === cache.raw) return cache.map
  let map = NONE
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}')
    if (parsed && typeof parsed === 'object') {
      map = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, v]) => v === 'beginner' || v === 'intermediate')) as Record<string, LevelKey>
    }
  } catch {
    map = NONE
  }
  cache = { raw, map }
  return map
}

export function setShownLevel(puzzleId: string, key: LevelKey) {
  const next = { ...read() }
  if (key === 'advanced') delete next[puzzleId]
  else next[puzzleId] = key
  fallback = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // held for this visit
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** Every position's picked level on this device (the ones at Advanced aren't listed). */
export function useShownLevels(): Record<string, LevelKey> {
  return useSyncExternalStore(subscribe, read, () => NONE)
}

/** The level a position is shown at: the one picked, while it still has that level; else Advanced. */
export function levelShown(p: Pick<Puzzle, 'id' | 'levels'>, levels: Record<string, LevelKey>): LevelKey {
  const key = levels[p.id]
  return key && key !== 'advanced' && p.levels?.[key] ? key : 'advanced'
}

/** The position as it's shown: its picked level as a position of its own, or itself. */
export function shownPuzzle(p: Puzzle, levels: Record<string, LevelKey>): Puzzle {
  return levelPuzzle(p, levelShown(p, levels))
}
