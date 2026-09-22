import { useEffect, useState } from 'react'
import { onlineManager, type QueryClient } from '@tanstack/react-query'
import * as api from './data'
import { keys } from './queries'

/**
 * Offline support, in three parts:
 *  - reads: every student's lessons are fetched ahead of time while online, so
 *    the whole cabinet is on the device before the Wi-Fi drops (the query
 *    cache is persisted to localStorage by the provider);
 *  - writes: TanStack pauses mutations while offline and resumes them when the
 *    connection returns, so a stamp or a note made at the table syncs later;
 *  - the shell: the service worker precaches the app itself.
 */

/** True while the browser believes it has a connection. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline())
  useEffect(() => onlineManager.subscribe(setOnline), [])
  return online
}

/** Pull every student's lessons into the cache. Cheap when cached; skipped when offline. */
export async function prefetchAll(qc: QueryClient) {
  if (!onlineManager.isOnline()) return
  const fresh = { staleTime: 5 * 60_000 }
  const students = await qc.fetchQuery({ queryKey: keys.students, queryFn: api.listStudents, ...fresh })
  await Promise.all([
    qc.prefetchQuery({ queryKey: keys.settings, queryFn: api.getUserSettings, ...fresh }),
    qc.prefetchQuery({ queryKey: keys.pieceSets, queryFn: api.listCustomPieceSets, ...fresh }),
    qc.prefetchQuery({ queryKey: keys.lessonHistory, queryFn: api.getLessonHistory, ...fresh }),
    qc.prefetchQuery({ queryKey: keys.lessonTemplates, queryFn: api.listLessonTemplates, ...fresh }),
  ])
  // One student at a time keeps this gentle on a phone connection.
  for (const student of students) {
    if (!onlineManager.isOnline()) return
    const [plans] = await Promise.all([
      qc.fetchQuery({ queryKey: keys.lessonPlans(student.id), queryFn: () => api.listLessonPlans(student.id), ...fresh }),
      qc.prefetchQuery({ queryKey: keys.folderCounts(student.id), queryFn: () => api.getFolderCounts(student.id), ...fresh }),
    ])
    for (const plan of plans) {
      if (!onlineManager.isOnline()) return
      await qc.prefetchQuery({ queryKey: keys.lesson(plan.id), queryFn: () => api.getLessonBundle(plan.id), ...fresh })
    }
  }
}

/** Runs the prefetch once after sign-in, and again each time the connection comes back. */
export function usePrefetchAll(qc: QueryClient, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const run = () => {
      if (!cancelled) prefetchAll(qc).catch((e) => console.warn('Prefetch stopped:', e))
    }
    const t = window.setTimeout(run, 1500)
    const unsubscribe = onlineManager.subscribe((online) => {
      if (online) run()
    })
    return () => {
      cancelled = true
      window.clearTimeout(t)
      unsubscribe()
    }
  }, [qc, enabled])
}
