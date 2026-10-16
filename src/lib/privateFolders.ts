import { useSyncExternalStore } from 'react'

// ---------------------------------------------------------------------------
// Settings → Private folders: folders hidden on this device, such as the
// coach's own study folder kept out of sight while teaching. Per device, so
// it can stay hidden on the iPad used at lessons and show on the Mac at home.
// Hidden means gone from Students, the Schedule, the Library and the folder
// pickers; links into it open Students instead. Switching it back shows it.
// ---------------------------------------------------------------------------

const KEY = 'private-folders'
const EVENT = 'private-folders-change'
const NONE: string[] = []

// The same list back until it changes, as useSyncExternalStore needs.
let cache: { raw: string | null; ids: string[] } = { raw: null, ids: NONE }

function read(): string[] {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    // No storage (private browsing): what was set this visit.
    return cache.ids
  }
  if (raw === cache.raw) return cache.ids
  let ids = NONE
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]')
    if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    ids = NONE
  }
  cache = { raw, ids }
  return ids
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

export function setFolderPrivate(studentId: string, hidden: boolean) {
  const ids = read().filter((id) => id !== studentId)
  if (hidden) ids.push(studentId)
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // Private browsing: it holds for this visit only.
    cache = { raw: JSON.stringify(ids), ids }
  }
  window.dispatchEvent(new Event(EVENT))
}

/** The ids of the folders hidden on this device. */
export function usePrivateFolders(): string[] {
  return useSyncExternalStore(subscribe, read, () => NONE)
}
