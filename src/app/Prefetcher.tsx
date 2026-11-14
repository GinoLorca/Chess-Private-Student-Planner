import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { usePrefetchAll } from '../lib/offline'
import { paidExportOnStart } from '../lib/paidExport'

/**
 * Mounted once, signed in: pulls every lesson onto the device so the cabinet works with no connection,
 * and brings the paid-lessons file up to date (api/paid-export.js; nothing happens until it is set up).
 */
export function Prefetcher() {
  const qc = useQueryClient()
  const { session } = useAuth()
  const signedIn = Boolean(session)
  usePrefetchAll(qc, signedIn)
  useEffect(() => {
    if (signedIn) paidExportOnStart()
  }, [signedIn])
  return null
}
