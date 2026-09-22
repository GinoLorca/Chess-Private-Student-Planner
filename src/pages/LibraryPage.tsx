import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LibraryEntry } from '../lib/data'
import { useLibrary } from '../lib/queries'
import { normalizeFen } from '../lib/fen'
import { copyText, puzzleLink } from '../lib/links'
import { Board } from '../components/board/Board'
import { CopyLinkButton } from '../components/ui/CopyLink'
import { Button } from '../components/ui/Button'
import { EmptyState, LoadingPage, Page } from '../components/ui/Page'
import { Eye } from '../components/ui/Icons'

/**
 * Every position across every student, searchable, each with its link.
 * Built for borrowing: a position taught to one student last year is a
 * search away when it fits a class this year, and the link pastes straight
 * into the club planner's puzzle rows.
 */
export function LibraryPage() {
  const { data: entries, isLoading } = useLibrary()
  const [query, setQuery] = useState('')
  const [copiedLesson, setCopiedLesson] = useState<string | null>(null)

  const groups = useMemo(() => groupByLesson(filter(entries ?? [], query)), [entries, query])
  const total = entries?.length ?? 0
  const shown = groups.reduce((n, g) => n + g.entries.length, 0)

  async function copyLesson(group: LessonGroup) {
    const lines = group.entries.map((e, i) => `${e.puzzle.label || `#${i + 1}`} — ${puzzleLink(e.puzzle.id)}`)
    if (await copyText(lines.join('\n'))) {
      setCopiedLesson(group.key)
      window.setTimeout(() => setCopiedLesson(null), 1600)
    }
  }

  if (isLoading && !entries) return <LoadingPage />

  return (
    <Page back="/" eyebrow="Every student, every lesson" title="Position library" width="wide">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a label, theme, question, note, student or lesson…"
          className="h-12 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-4 text-[16px] outline-none focus:border-accent"
          autoCapitalize="off"
        />
        <span className="text-[13px] text-on-bg-2 tabular-nums">
          {query ? `${shown} of ${total}` : `${total} position${total === 1 ? '' : 's'}`}
        </span>
      </div>

      {groups.length === 0 ? (
        <EmptyState title={query ? 'Nothing matches' : 'No positions yet'} body={query ? 'Try a shorter word, or a theme like "back rank".' : undefined} />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-1">
                <span className="folder-tab inline-flex h-7 items-center gap-2 rounded-t-xl px-3 text-[12px] font-bold tracking-[0.08em] text-black/60 uppercase" style={{ background: group.studentColor }}>
                  <span className="block h-2 w-2 rounded-[2px] bg-black/35" />
                  {group.studentName}
                </span>
                <Link to={`/students/${group.studentId}/lessons/${group.lessonPlanId}`} className="text-[14px] font-semibold text-on-bg hover:underline">
                  Lesson {group.lessonNumber}
                  {group.lessonTitle && <span className="font-normal text-on-bg-2"> · {group.lessonTitle}</span>}
                </Link>
                <span className="text-[12px] text-on-bg-2 tabular-nums">{group.entries.length}</span>
                <div className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => copyLesson(group)}>
                  {copiedLesson === group.key ? 'Copied all' : 'Copy all links'}
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.entries.map((entry) => (
                  <PositionRow key={entry.puzzle.id} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Page>
  )
}

function PositionRow({ entry }: { entry: LibraryEntry }) {
  const { puzzle } = entry
  const present = `/students/${entry.studentId}/lessons/${entry.lessonPlanId}/present?p=${puzzle.id}`
  const text = (puzzle.summary || puzzle.quiz_prompt || '').replace(/\s+/g, ' ').trim()
  return (
    <div className="index-card flex gap-3 rounded-xl border border-line bg-surface p-3 shadow-[0_10px_22px_-16px_rgba(0,0,0,0.5)]">
      <Link to={present} className="w-[84px] shrink-0">
        <Board
          fen={normalizeFen(puzzle.starting_fen, puzzle.side_to_move)}
          orientation={puzzle.side_to_move === 'b' ? 'black' : 'white'}
          arrows={puzzle.arrows}
          highlights={puzzle.highlights}
          coordinates={false}
          className="rounded-[3px] shadow-none"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link to={present} className="truncate font-display text-[18px] leading-tight font-semibold text-ink">
            {puzzle.label || 'Untitled'}
          </Link>
          <span className="shrink-0 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{entry.sectionTitle}</span>
        </div>
        {text ? <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-2">{text}</p> : <p className="mt-1 text-[13px] text-ink-3 italic">No note yet</p>}
        {puzzle.themes && puzzle.themes.length > 0 && <p className="mt-1 truncate text-[12px] text-ink-3">{puzzle.themes.join(' · ')}</p>}
        <div className="mt-1.5 -ml-2 flex items-center gap-1">
          <CopyLinkButton puzzleId={puzzle.id} />
          <Link to={present} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold text-ink-3 hover:bg-surface-2 hover:text-ink">
            <Eye size={16} /> Present
          </Link>
        </div>
      </div>
    </div>
  )
}

interface LessonGroup {
  key: string
  studentId: string
  studentName: string
  studentColor: string
  lessonPlanId: string
  lessonNumber: number
  lessonTitle: string
  entries: LibraryEntry[]
}

function groupByLesson(entries: LibraryEntry[]): LessonGroup[] {
  const groups: LessonGroup[] = []
  for (const e of entries) {
    const last = groups[groups.length - 1]
    if (last && last.lessonPlanId === e.lessonPlanId) last.entries.push(e)
    else {
      groups.push({
        key: e.lessonPlanId,
        studentId: e.studentId,
        studentName: e.studentName,
        studentColor: e.studentColor,
        lessonPlanId: e.lessonPlanId,
        lessonNumber: e.lessonNumber,
        lessonTitle: e.lessonTitle,
        entries: [e],
      })
    }
  }
  return groups
}

/** Every word typed must appear somewhere in the position or where it lives. */
function filter(entries: LibraryEntry[], query: string): LibraryEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return entries
  return entries.filter((e) => {
    const hay = [
      e.puzzle.label,
      e.puzzle.quiz_prompt,
      e.puzzle.summary,
      (e.puzzle.themes ?? []).join(' '),
      e.sectionTitle,
      e.lessonTitle,
      `lesson ${e.lessonNumber}`,
      e.studentName,
      e.puzzle.reference_label ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
