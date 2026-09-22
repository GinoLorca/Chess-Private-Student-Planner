import { useParams } from 'react-router-dom'
import { FOLDER_KINDS } from '../types/domain'
import { useFolderCounts, useStudent, useUscfHistory, useUscfRating } from '../lib/queries'
import { FOLDER_COLORS } from '../lib/colors'
import { FolderBody, FolderTab, HangingFile } from '../components/lesson/Folder'
import { Page, LoadingPage, SectionLabel } from '../components/ui/Page'
import { PaperCard } from '../components/lesson/Folder'
import type { UscfEvent } from '../lib/data'
import { Folder } from '../components/ui/Icons'

/** The student's folder, opened: one hanging file per sub-folder inside it. */
export function StudentPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { data: student, isLoading } = useStudent(studentId)
  const { data: counts } = useFolderCounts(studentId)
  const rating = useUscfRating(student?.uscf_id)

  if (isLoading && !student) return <LoadingPage />
  if (!student) return <Page back="/">Student not found.</Page>

  // The files take the palette in order, skipping the folder's own colour.
  const palette = FOLDER_COLORS.filter((c) => c !== student.color)

  return (
    <Page back="/" className="pt-6">
      <FolderTab
        color={student.color}
        name={student.name}
        aside={rating.data?.regular ? `USCF ${rating.data.regular}` : 'Student folder'}
        logo={student.logo}
      />
      <FolderBody color={student.color} className="pb-5">
        <div
          className="divider-paper -mx-3 rounded-t-2xl bg-paper px-3 pt-5 pb-6 sm:-mx-5 sm:px-5"
          style={{ borderLeft: `10px solid ${palette[0]}` }}
        >
          <h1 className="mb-4 font-display text-[28px] leading-none font-bold text-ink sm:text-[32px]">{student.name}</h1>
          {student.uscf_id && <PlayerTracker memberId={student.uscf_id} />}
          <div className="space-y-4">
            {FOLDER_KINDS.map((f, i) => (
              <HangingFile
                key={f.kind}
                to={f.kind === 'lesson_plan' ? `/students/${student.id}/lessons` : `/students/${student.id}/notes/${f.kind}`}
                color={palette[(i + 1) % palette.length]}
                label={f.label}
                count={counts?.[f.kind]}
                icon={<Folder size={14} />}
              />
            ))}
          </div>
        </div>
      </FolderBody>
    </Page>
  )
}

/**
 * The player tracker: the member's USCF ratings and every rated event with
 * the score they took from it and what it did to their rating. Read from the
 * USCF site through the app's own lookup, so nothing is typed in by hand.
 */
function PlayerTracker({ memberId }: { memberId: string }) {
  const history = useUscfHistory(memberId)
  const data = history.data
  const events = data?.events ?? []
  const totalPoints = events.reduce((n, e) => n + (e.points ?? 0), 0)
  const totalGames = events.reduce((n, e) => n + (e.games ?? 0), 0)
  return (
    <PaperCard className="mb-5 p-4" tilt={-0.2}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionLabel className="mb-0">Player tracker · USCF {memberId}</SectionLabel>
        {data?.fetchedAt && (
          <span className="text-[12px] text-ink-3">
            Checked {new Date(data.fetchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      {history.isLoading && <p className="mt-2 text-[14px] text-ink-3">Looking the member up on the USCF site…</p>}
      {history.isError && (
        <p className="mt-2 text-[14px] text-warn">
          Couldn't reach the USCF site for this ID ({history.error instanceof Error ? history.error.message : 'lookup failed'}). It will try again later.
        </p>
      )}
      {data && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <Stat label="Regular" value={data.regular} big />
            <Stat label="Quick" value={data.quick} />
            <Stat label="Blitz" value={data.blitz} />
            {events.length > 0 && <Stat label="Events" value={events.length} />}
            {totalGames > 0 && <Stat label="Score" text={`${fmtPoints(totalPoints)} / ${totalGames}`} />}
          </div>
          {data.name && (
            <p className="mt-2 text-[13px] text-ink-3">
              {data.name}
              {data.expires ? ` · membership to ${data.expires}` : ''}
            </p>
          )}
          {events.length === 0 ? (
            <p className="mt-3 text-[14px] text-ink-3">
              {data.eventsError ? `The event list couldn't be read (${data.eventsError}).` : 'No rated events on record yet.'}
            </p>
          ) : (
            <table className="mt-3 w-full text-[14px]">
              <thead>
                <tr className="text-left text-[11px] font-bold tracking-[0.12em] text-ink-3 uppercase">
                  <th className="py-1 pr-2 font-bold">Date</th>
                  <th className="py-1 pr-2 font-bold">Event</th>
                  <th className="py-1 pr-2 text-right font-bold">Points</th>
                  <th className="py-1 text-right font-bold">Rating</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <EventRow key={`${e.eventId}-${e.date}`} event={e} />
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </PaperCard>
  )
}

function EventRow({ event: e }: { event: UscfEvent }) {
  const delta = e.before != null && e.after != null ? e.after - e.before : null
  return (
    <tr className="border-t border-line align-top">
      <td className="py-2 pr-2 whitespace-nowrap text-ink-2 tabular-nums">{e.date}</td>
      <td className="py-2 pr-2">
        <p className="font-semibold text-ink">{titleCase(e.name)}</p>
        {e.section && <p className="text-[12.5px] text-ink-3">{e.section}</p>}
      </td>
      <td className="py-2 pr-2 text-right whitespace-nowrap tabular-nums">
        {e.points != null ? (
          <span className="font-semibold text-ink">
            {fmtPoints(e.points)}
            {e.games ? <span className="text-ink-3"> / {e.games}</span> : null}
          </span>
        ) : (
          <span className="text-ink-3">—</span>
        )}
      </td>
      <td className="py-2 text-right whitespace-nowrap tabular-nums">
        {e.after != null ? <span className="font-semibold text-ink">{e.after}</span> : <span className="text-ink-3">—</span>}
        {delta != null && delta !== 0 && (
          <span className={delta > 0 ? 'ml-1.5 text-[12.5px] font-semibold text-accent' : 'ml-1.5 text-[12.5px] font-semibold text-danger'}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
        {e.before == null && e.after != null && <span className="ml-1.5 text-[12.5px] text-ink-3">first rating</span>}
      </td>
    </tr>
  )
}

function Stat({ label, value, text, big }: { label: string; value?: number | null; text?: string; big?: boolean }) {
  const shown = text ?? (value == null ? '—' : String(value))
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-1.5">
      <p className="text-[10.5px] font-bold tracking-[0.12em] text-ink-3 uppercase">{label}</p>
      <p className={big ? 'font-display text-[24px] leading-tight font-bold text-ink tabular-nums' : 'text-[16px] font-semibold text-ink tabular-nums'}>{shown}</p>
    </div>
  )
}

function fmtPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** USCF prints names and events in capitals; ease them for reading. */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(U\d{3,4}|G\/\d+|K-\d+|Ps \d+|Nyc|Usa|Ny|Nj|Ct)\b/gi, (m) => m.toUpperCase())
}
