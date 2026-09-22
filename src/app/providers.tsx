import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: CACHE_LIFE,
      retry: 1,
      refetchOnWindowFocus: true,
      // Offline, a query with cached data shows it and waits; one without
      // pauses instead of failing, and runs the moment the connection returns.
      networkMode: 'online',
    },
    mutations: {
      // A stamp or a note made offline waits in the queue and is sent when
      // the connection returns; a flaky reconnect gets a few tries.
      networkMode: 'online',
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
    },
  },
})

// Dev only: lets a test script look at the cache from the page.
if (import.meta.env.DEV) (window as unknown as { __qc?: QueryClient }).__qc = queryClient

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'lesson-planner-cache',
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: PERSIST_LIFE, buster: 'v3' }}>
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
