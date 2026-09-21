import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { LoginPage } from './LoginPage'
import { LoadingPage } from '../components/ui/Page'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingPage />
  if (!session) return <LoginPage />
  return <>{children}</>
}
