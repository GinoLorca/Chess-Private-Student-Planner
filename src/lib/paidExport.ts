import { isDemo, supabase } from './supabase'

/**
 * Optional: after lessons are marked paid or unpaid, the server copies the paid lessons into a file in
 * a private GitHub repository (api/paid-export.js), for another app of the coach's to read. The server
 * holds the key; until it has one, the call does nothing. Nothing here is ever shown or waited for.
 */

/** Marks made close together are sent once. */
const WAIT_MS = 1500
/** At start, at most this often: catches up on marks saved while the server could not be reached. */
const START_EVERY_MS = 10 * 60_000
const LAST_KEY = 'paid-export-at'

let timer: ReturnType<typeof setTimeout> | null = null

export function schedulePaidExport() {
  if (isDemo) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void send()
  }, WAIT_MS)
}

export function paidExportOnStart() {
  if (isDemo) return
  let last = 0
  try {
    last = Number(localStorage.getItem(LAST_KEY)) || 0
  } catch {
    // no storage: send it
  }
  if (Date.now() - last >= START_EVERY_MS) schedulePaidExport()
}

async function send() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    const res = await fetch('/api/paid-export', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      try {
        localStorage.setItem(LAST_KEY, String(Date.now()))
      } catch {
        // fine: the next start sends it again
      }
    }
  } catch {
    // offline or the server is away: the next mark, or the next start, sends it
  }
}
