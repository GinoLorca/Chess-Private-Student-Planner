import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

// ---------------------------------------------------------------------------
// Data: cached + persisted so an open lesson survives a dead Wi-Fi room.
// ---------------------------------------------------------------------------
const ONE_WEEK = 1000 * 60 * 60 * 24 * 7

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: ONE_WEEK,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'lesson-planner-cache',
})

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: ONE_WEEK, buster: 'v2' }}>
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
