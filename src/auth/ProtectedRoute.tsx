import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { LoginPage } from './LoginPage'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-600 border-t-gold-500" />
      </div>
    )
  }

  if (!session) return <LoginPage />

  return <>{children}</>
}
