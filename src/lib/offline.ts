import { useEffect, useState } from 'react'
import { onlineManager, type QueryClient } from '@tanstack/react-query'
import * as api from './data'
import { keys } from './queries'
import { quietBackground } from './speedCheck'
import { FOLDER_KINDS, type Note } from '../types/domain'

/**
 * Offline support, in three parts:
 *  - reads: everything is fetched ahead of time while online (the schedule,
 *    addresses and codes, reminders, rates and payments, USCF ratings, every
 *    lesson and folder), so it's on the device before the signal drops; the
 *    query cache is saved in IndexedDB by the provider;
 *  - writes: TanStack pauses mutations while offline and resumes them when the
 *    connection returns; the schedule's are saved on the device too, so they
 *    survive the app being closed (see registerOfflineMutations);
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
  if (!onlineManager.isOnline() || quietBackground()) return
  const fresh = { staleTime: 5 * 60_000 }
  const students = await qc.fetchQuery({ queryKey: keys.students, queryFn: api.listStudents, ...fresh })
  await Promise.all([
    qc.prefetchQuery({ queryKey: keys.settings, queryFn: api.getUserSettings, ...fresh }),
    qc.prefetchQuery({ queryKey: keys.pieceSets, queryFn: api.listCustomPieceSets, ...fresh }),
    qc.prefetchQuery({ queryKey: keys.lessonHistory, queryFn: api.getLessonHistory, ...fresh }),
    qc.prefetchQuery({ queryKey: keys.lessonTemplates, queryFn: api.listLessonTemplates, ...fresh }),
  ])
  // The schedule next: lessons this week, addresses and door codes, rates,
  // payments and reminders are what's needed on the way to a lesson.
  await prefetchSchedule(qc)
  // Each student's USCF rating and tracker, for the folders and the player tracker.
  const slow = { staleTime: 6 * 60 * 60_000 }
  await Promise.all(
    students
      .filter((s) => s.uscf_id)
      .flatMap((s) => [
        qc.prefetchQuery({ queryKey: keys.uscf(s.uscf_id!), queryFn: () => api.getUscfRating(s.uscf_id!), ...slow }),
        qc.prefetchQuery({ queryKey: keys.uscfHistory(s.uscf_id!), queryFn: () => api.getUscfHistory(s.uscf_id!), staleTime: 24 * 60 * 60_000 }),
      ]),
  )
  await qc.prefetchQuery({ queryKey: keys.library, queryFn: api.listLibrary, ...fresh })
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
    // The other folders: notes, game reviews, invoices, misc.
    await Promise.all(
      FOLDER_KINDS.filter((f) => f.kind !== 'lesson_plan').map((f) => {
        const kind = f.kind as Note['folder_kind']
        return qc.prefetchQuery({ queryKey: keys.notes(student.id, kind), queryFn: () => api.listNotes(student.id, kind), ...fresh })
      }),
    )
  }
}

/**
 * The schedule's data, if its database tables exist: the week, its changes,
 * reminders, addresses and codes, and (with 0010 / 0011) rates and payments.
 */
async function prefetchSchedule(qc: QueryClient) {
  const fresh = { staleTime: 60_000 }
  const hour = { staleTime: 60 * 60_000 }
  const missing = await qc.fetchQuery({ queryKey: keys.scheduleMissing, queryFn: api.missingScheduleTables, ...hour }).catch(() => ['?'])
  if (missing.length > 0) return
  await Promise.all([
    qc.prefetchQuery({ queryKey: keys.scheduleSlots, queryFn: api.listScheduleSlots, ...fresh }),
    qc.prefetchQuery({ queryKey: keys.scheduleChanges, queryFn: api.listScheduleChanges, ...fresh }),
    qc.prefetchQuery({ queryKey: keys.reminders, queryFn: api.listReminders, ...fresh }),
    qc.prefetchQuery({ queryKey: keys.places, queryFn: api.listStudentPlaces, ...fresh }),
    qc.prefetchQuery({ queryKey: keys.rateMissing, queryFn: api.rateColumnMissing, ...hour }),
  ])
  const paymentsMissing = await qc.fetchQuery({ queryKey: keys.paymentsMissing, queryFn: api.paymentsTableMissing, ...hour }).catch(() => true)
  if (!paymentsMissing) await qc.prefetchQuery({ queryKey: keys.payments, queryFn: api.listPayments, ...fresh })
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
