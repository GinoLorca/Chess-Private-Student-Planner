import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onlineManager, QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider, type PersistedClient } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { del, get, set } from 'idb-keyval'
import { registerOfflineMutations } from '../lib/queries'
import { noteCacheUpdate, noteSave, quietBackground } from '../lib/speedCheck'

// ---------------------------------------------------------------------------
// Data: cached + persisted so an open lesson survives a dead Wi-Fi room.
// ---------------------------------------------------------------------------
const ONE_DAY = 1000 * 60 * 60 * 24
// How long an unwatched lesson stays in memory. Kept under 2^31 ms (about
// 24.8 days): a longer timer overflows setTimeout and fires at once, which
// would throw every prefetched lesson away the moment it arrived.
const CACHE_LIFE = ONE_DAY * 24
// How long the persisted copy on the device is trusted: a lesson looked at
// a month ago still opens on a plane.
const PERSIST_LIFE = ONE_DAY * 35

// The query layer only hears "offline" when the connection drops while the
// app is open; started with no signal it would assume it's online, try to
// send changes and lose them. Start from what the device says.
if (typeof navigator !== 'undefined') onlineManager.setOnline(navigator.onLine)

/** A request that never reached the server (no signal, a dead Wi-Fi) rather than one it refused. */
function isNetworkError(e: unknown): boolean {
  const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed|the internet connection appears to be offline/i.test(message)
}

let recheck: number | undefined
/**
 * A change that couldn't reach the server stays queued: the app counts
 * itself offline (which pauses the queue) and looks again in 20 seconds, or
 * as soon as the device reports the connection back. Anything the server
 * refused gets three tries, as before.
 */
function retryChange(failures: number, error: unknown): boolean {
  if (isNetworkError(error)) {
    onlineManager.setOnline(false)
    window.clearTimeout(recheck)
    recheck = window.setTimeout(() => onlineManager.setOnline(navigator.onLine), 20_000)
    return true
  }
  return failures < 3
}

const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: CACHE_LIFE,
      retry: 1,
      // Coming back to the app re-reads what's stale, but not while a save is
      // still on its way: the server's older copy would wipe the change.
      refetchOnWindowFocus: (): boolean => queryClient.isMutating() === 0 && !quietBackground(),
      // Offline, a query with cached data shows it and waits; one without
      // pauses instead of failing, and runs the moment the connection returns.
      networkMode: 'online',
    },
    mutations: {
      // A stamp or a note made offline waits in the queue and is sent when
      // the connection returns; a flaky reconnect gets a few tries.
      networkMode: 'online',
      retry: retryChange,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
    },
  },
})

// Dev only: lets a test script look at the cache from the page.
if (import.meta.env.DEV) (window as unknown as { __qc?: QueryClient }).__qc = queryClient

// Changes made with no connection are kept on the device and sent later, even
// if the app is closed in between: each kind has its function registered here,
// so a change restored from storage knows how to send itself.
registerOfflineMutations(queryClient)

// Data arriving, counted by the speed check while a piece is pressed.
queryClient.getQueryCache().subscribe((e) => {
  if (e.type === 'updated' && e.action.type === 'success') noteCacheUpdate()
})

/**
 * Where the cache lives on the device: IndexedDB, which holds far more than
 * localStorage's few megabytes (every lesson, the schedule, codes, ratings),
 * with localStorage as the fallback where IndexedDB isn't available. The
 * first read moves a copy saved by the older localStorage version across.
 *
 * Saving is kept off the moments the coach is using the app: the cache is
 * handed over as it is (IndexedDB stores objects, so it isn't turned into
 * one long string first) and written when the page is idle, never in the
 * middle of a tap or a drag. A save still waiting is written at once when
 * the app is put away, so nothing is lost.
 */
const CACHE_KEY = 'lesson-planner-cache'
type Stored = string | object
let pending: { key: string; value: Stored } | null = null
let idleHandle: number | null = null

async function write(key: string, value: Stored) {
  try {
    await set(key, value)
  } catch {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    } catch {
      // Out of room everywhere: the app still works, it just won't remember this copy.
    }
  }
}

function flush() {
  if (idleHandle !== null) {
    if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle)
    else clearTimeout(idleHandle)
    idleHandle = null
  }
  const next = pending
  pending = null
  if (!next) return
  const t0 = performance.now()
  void write(next.key, next.value).then(() => noteSave(performance.now() - t0))
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
}

const deviceStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const value = await get<Stored>(key)
      if (value != null) return value as string
      const legacy = localStorage.getItem(key)
      if (legacy != null) {
        await set(key, legacy)
        localStorage.removeItem(key)
      }
      return legacy
    } catch {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    }
  },
  setItem(key: string, value: string) {
    // The speed check's "Background off" holds saves back while it's on.
    if (quietBackground()) return
    pending = { key, value }
    if (idleHandle === null) {
      // Safari before 18 has no requestIdleCallback: a short wait does instead.
      idleHandle =
        typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(flush, { timeout: 4000 }) : Number(setTimeout(flush, 1500))
    }
  },
  async removeItem(key: string) {
    pending = null
    try {
      await del(key)
    } catch {
      // nothing saved there
    }
    try {
      localStorage.removeItem(key)
    } catch {
      // nothing saved there
    }
  },
}

const persister = createAsyncStoragePersister({
  storage: deviceStorage,
  key: CACHE_KEY,
  throttleTime: 1000,
  // Stored as an object (see deviceStorage); a copy saved as text by an
  // earlier version still reads back.
  serialize: (client) => client as unknown as string,
  deserialize: (stored) => (typeof stored === 'string' ? (JSON.parse(stored) as PersistedClient) : (stored as unknown as PersistedClient)),
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: PERSIST_LIFE, buster: 'v3' }}
      // Changes waiting from last time are sent as soon as the cache is back
      // (they wait again by themselves if there's still no connection).
      onSuccess={() => {
        void queryClient.resumePausedMutations().then(() => queryClient.invalidateQueries())
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}

// ---------------------------------------------------------------------------
// Appearance: system / light / dark, applied as data-theme on <html>.
// index.html applies the saved value before first paint; this keeps it live.
// ---------------------------------------------------------------------------
export type Appearance = 'system' | 'light' | 'dark'

interface AppearanceContextValue {
  appearance: Appearance
  setAppearance: (a: Appearance) => void
  resolved: 'light' | 'dark'
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

function readAppearance(): Appearance {
  try {
    const raw = localStorage.getItem('appearance')
    return raw === 'light' || raw === 'dark' ? raw : 'system'
  } catch {
    return 'system'
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>(readAppearance)
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved: 'light' | 'dark' = appearance === 'system' ? (systemDark ? 'dark' : 'light') : appearance

  useEffect(() => {
    const root = document.documentElement
    if (resolved === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }, [resolved])

  const value = useMemo<AppearanceContextValue>(
    () => ({
      appearance,
      resolved,
      setAppearance: (a) => {
        setAppearanceState(a)
        try {
          localStorage.setItem('appearance', a)
        } catch {
          // preference still applies for this session
        }
      },
    }),
    [appearance, resolved],
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext)
  if (!ctx) throw new Error('useAppearance must be used within AppearanceProvider')
  return ctx
}
