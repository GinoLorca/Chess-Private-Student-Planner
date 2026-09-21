import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { isDemo, supabase } from '../lib/supabase'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Demo mode has no auth server; a stand-in session unlocks the app.
const DEMO_SESSION = {
  access_token: 'demo',
  refresh_token: 'demo',
  expires_in: 0,
  token_type: 'bearer',
  user: { id: 'demo', email: 'coach@example.com', app_metadata: {}, user_metadata: {}, aud: 'demo', created_at: '' },
} as unknown as Session

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(isDemo ? DEMO_SESSION : null)
  const [loading, setLoading] = useState(!isDemo)

  useEffect(() => {
    if (isDemo) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    if (isDemo) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, signInWithPassword, signOut }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
