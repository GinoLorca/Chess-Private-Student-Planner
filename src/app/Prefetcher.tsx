import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { usePrefetchAll } from '../lib/offline'

/** Mounted once, signed in: pulls every lesson onto the device so the cabinet works with no connection. */
export function Prefetcher() {
  const qc = useQueryClient()
  const { session } = useAuth()
  usePrefetchAll(qc, Boolean(session))
  return null
}
