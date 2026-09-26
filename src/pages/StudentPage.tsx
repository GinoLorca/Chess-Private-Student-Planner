import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { FOLDER_KINDS } from '../types/domain'
import { useFolderCounts, useStudent, useUscfHistory, useUscfRating } from '../lib/queries'
import { FOLDER_COLORS } from '../lib/colors'
import { ExpandingFile, FolderBody, FolderTab, HangingFile } from '../components/lesson/Folder'
import { Page, LoadingPage, SectionLabel } from '../components/ui/Page'
import { PaperCard } from '../components/lesson/Folder'
import type { UscfEvent } from '../lib/data'
import { ExternalLink, Folder, Knight } from '../components/ui/Icons'

/** The Rated Games file's own colour: a scoresheet yellow, apart from the other files. */
const RATED_GAMES_COLOR = '#e6d27e'

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
          {student.uscf_id && <RatingCard memberId={student.uscf_id} />}
          <div className="space-y-4">
            {student.uscf_id && <RatedGamesFile memberId={student.uscf_id} />}
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
 * The player tracker's summary, above the files: the member's USCF ratings,
 * how many events and the running score, at a glance. Read from US Chess
 * through the app's own lookup, so nothing is typed in by hand.
 */
function RatingCard({ memberId }: { memberId: string }) {
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
      {history.isLoading && <p className="mt-2 text-[14px] text-ink-3">Looking the member up on US Chess…</p>}
      {history.isError && (
        <p className="mt-2 text-[14px] text-warn">
          Couldn't reach US Chess for this ID ({history.error instanceof Error ? history.error.message : 'lookup failed'}). It will try again later.
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
        </>
      )}
    </PaperCard>
  )
}

/** Whether a student's Rated Games file was left open, per student, for this visit. */
function useOpenState(key: string): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  const toggle = () =>
    setOpen((o) => {
      try {
        sessionStorage.setItem(key, o ? '0' : '1')
      } catch {
        // Private browsing: the file just starts closed next time.
      }
      return !o
    })
  return [open, toggle]
}

/**
 * The first file in the folder: every rated event, newest first. It opens in
 * place rather than on a page of its own, so the ratings above stay in view.
 */
function RatedGamesFile({ memberId }: { memberId: string }) {
  const history = useUscfHistory(memberId)
  const [open, toggle] = useOpenState(`rated-games-open-${memberId}`)
  const events = history.data?.events ?? []
  const body = history.isLoading
    ? 'Looking up…'
    : history.isError
      ? "Couldn't read the events"
      : events.length === 0
        ? 'No rated events yet'
        : `${events.length} ${events.length === 1 ? 'event' : 'events'}`
  return (
    <ExpandingFile
      id={`rated-games-${memberId}`}
      color={RATED_GAMES_COLOR}
      label="Rated Games"
      icon={<Knight size={14} />}
      body={body}
      open={open}
      onToggle={toggle}
    >
      {history.isLoading && <p className="py-2 text-[14px] text-ink-3">Looking the events up on US Chess…</p>}
      {history.isError && <p className="py-2 text-[14px] text-warn">The events couldn't be read right now. Pull down to try again.</p>}
      {history.data && events.length === 0 && (
        <p className="py-2 text-[14px] text-ink-3">
          {history.data.eventsError ? `The event list couldn't be read (${history.data.eventsError}).` : 'No rated events on record yet.'}
        </p>
      )}
      {events.length > 0 && (
        <table className="w-full text-[14px]">
          <thead>
            <tr className="text-left text-[11px] font-bold tracking-[0.12em] text-ink-3 uppercase">
              <th className="hidden py-1 pr-2 font-bold sm:table-cell">Date</th>
              <th className="py-1 pr-2 font-bold">Event</th>
              <th className="py-1 pr-2 text-right font-bold">Points</th>
              <th className="py-1 text-right font-bold">Rating</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <EventRow key={`${e.eventId}-${e.section ?? ''}-${e.date}`} event={e} memberId={memberId} />
            ))}
          </tbody>
        </table>
      )}
    </ExpandingFile>
  )
}

/**
 * The event's crosstable on the USCF site: the student's section, with their
 * row picked out and every round's pairings, and links on to the other
 * sections. Built from the event id and the section number ("5: 500-1000").
 */
function crosstableUrl(e: UscfEvent, memberId: string): string | null {
  if (!/^\d{12}$/.test(e.eventId)) return null
  const section = /^(\d{1,3})\s*:/.exec(e.section ?? '')?.[1]
  return section
    ? `https://www.uschess.org/msa/XtblMain.php?${e.eventId}.${section}-${memberId}`
    : `https://www.uschess.org/msa/XtblMain.php?${e.eventId}.0`
}

function EventRow({ event: e, memberId }: { event: UscfEvent; memberId: string }) {
  const delta = e.before != null && e.after != null ? e.after - e.before : null
  const url = crosstableUrl(e, memberId)
  const name = titleCase(e.name)
  return (
    <tr className="border-t border-line align-top">
      <td className="hidden py-2 pr-2 whitespace-nowrap text-ink-2 tabular-nums sm:table-cell">{e.date}</td>
      <td className="py-2 pr-2">
        <div className="flex items-start gap-2">
          <p className="min-w-0 font-semibold text-ink">{name}</p>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${name} on the USCF site`}
              title="Crosstable and pairings on the USCF site"
              className="-my-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-2 transition hover:text-accent active:scale-95"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        <p className="text-[12.5px] text-ink-3">
          <span className="tabular-nums sm:hidden">{e.date}</span>
          {e.section && <span className="sm:hidden"> · </span>}
          {e.section}
        </p>
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
    .replace(/\b(U\d{3,4}|G\/\d+|K-\d+|Ps \d+|Nyc|Usa|Ny|Nj|Ct|Icn)\b/gi, (m) => m.toUpperCase())
}
