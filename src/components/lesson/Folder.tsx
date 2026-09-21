import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LessonStatus, Puzzle } from '../../types/domain'
import { normalizeFen } from '../../lib/fen'
import { statusLabel, nextStatus } from '../../lib/lessonStatus'
import { answerProblem } from '../../lib/solution'
import { Board } from '../board/Board'
import { Trash, Warning } from '../ui/Icons'
import { IconButton } from '../ui/Button'

/**
 * The lesson page as an open manila folder: the student's tab on top, the
 * body in their folder colour, dividers for sections, index cards for
 * positions and a sticky note for the agenda. Stationery, not software.
 */

export function FolderTab({ color, name, aside }: { color: string; name: string; aside?: ReactNode }) {
  return (
    <div className="flex items-end gap-3 pl-4 sm:pl-6">
      <div
        className="flex h-8 items-center gap-2.5 rounded-t-xl px-4 shadow-[inset_0_-2px_0_rgba(0,0,0,0.06)] sm:h-9"
        style={{ background: color }}
      >
        <span className="block h-2.5 w-2.5 rounded-[3px] bg-black/35" />
        <span className="text-[12px] font-bold tracking-[0.08em] text-black/60 uppercase sm:text-[13px]">{name}</span>
      </div>
      {aside && <span className="pb-2 text-[13px] text-ink-3">{aside}</span>}
    </div>
  )
}

export function FolderBody({ color, children, className }: { color: string; children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx('relative rounded-r-2xl rounded-bl-2xl px-3 pt-4 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)] sm:px-5 sm:pt-5', className)}
      style={{ background: color }}
    >
      {children}
    </div>
  )
}

/** Planned / In progress / Taught as a rubber stamp; tap it to move on. */
export function StatusStamp({ status, onTap }: { status: LessonStatus | undefined; onTap: () => void }) {
  const s = status ?? 'planned'
  const tone =
    s === 'taught'
      ? 'border-[#2e7d5b] text-[#2e7d5b]'
      : s === 'in_progress'
        ? 'border-[#b26a00] text-[#b26a00]'
        : 'border-black/55 text-black/60'
  return (
    <button
      type="button"
      onClick={onTap}
      title={`Tap to mark ${statusLabel(nextStatus(s))}`}
      className={clsx(
        'inline-flex h-8 -rotate-[4deg] items-center rounded-md border-2 bg-white/35 px-3 text-[11px] font-extrabold tracking-[0.14em] uppercase transition active:scale-95 sm:h-[30px] sm:text-[12px]',
        tone,
      )}
    >
      {statusLabel(s)}
    </button>
  )
}

/** A yellow note with a paper clip; whatever goes inside is the agenda. */
export function StickyNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('relative rotate-[1.2deg]', className)}>
      <svg
        width="26"
        height="60"
        viewBox="0 0 26 60"
        fill="none"
        stroke="#7a7a72"
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden
        className="absolute -top-[26px] left-4 z-10 -rotate-12"
      >
        <path d="M8 52V12a6 6 0 0 1 12 0v36a4 4 0 0 1-8 0V16" />
      </svg>
      <div className="rounded-[3px] bg-sticky px-4 pt-4 pb-3 pl-12 text-sticky-ink shadow-[0_10px_22px_-14px_rgba(0,0,0,0.5)]">{children}</div>
    </div>
  )
}

export interface DividerTabItem {
  id: string
  title: string
  color: string
  count: number
  warn?: boolean
}

/** The section tabs along the top of the folder; the open one stands taller. */
export function DividerTabs({
  tabs,
  activeId,
  onPick,
  onAdd,
}: {
  tabs: DividerTabItem[]
  activeId: string | null
  onPick: (id: string) => void
  onAdd: () => void
}) {
  return (
    <div className="-mx-3 flex items-end gap-1.5 overflow-x-auto px-3 pt-1 pl-5 [scrollbar-width:none] sm:-mx-5 sm:px-5 sm:pl-7">
      {tabs.map((t) => {
        const active = t.id === activeId
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            aria-pressed={active}
            className={clsx(
              'flex shrink-0 items-center gap-2 rounded-t-xl px-3.5 text-[12px] font-bold tracking-[0.06em] whitespace-nowrap uppercase transition sm:px-4 sm:text-[13px]',
              active ? 'h-10 text-black/70 shadow-[0_-6px_14px_-10px_rgba(0,0,0,0.35)]' : 'h-[34px] text-black/55 brightness-[0.96]',
            )}
            style={{ background: t.color }}
          >
            {t.title || 'Untitled section'}
            <span className="inline-grid h-[22px] min-w-[22px] place-items-center rounded-full bg-black/10 px-1.5 text-[12px] tabular-nums">
              {t.count}
            </span>
            {t.warn && <span className="block h-2 w-2 rounded-full bg-warn" title="An answer doesn't replay" />}
          </button>
        )
      })}
      <button
        type="button"
        onClick={onAdd}
        className="h-[34px] shrink-0 rounded-t-xl border-2 border-b-0 border-dashed border-black/25 px-3.5 text-[12px] font-bold tracking-[0.06em] whitespace-nowrap text-black/50 uppercase transition active:bg-black/5 sm:text-[13px]"
      >
        + Section
      </button>
    </div>
  )
}

/** The open divider: ruled paper with the tab's colour down the left edge. */
export function DividerPaper({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div
      className="-mx-3 -mt-[18px] rounded-t-[14px] bg-paper px-3 pt-5 pb-6 shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.4)] sm:-mx-5 sm:px-5"
      style={{ borderLeft: `10px solid ${color}` }}
    >
      {children}
    </div>
  )
}

/** One position as a ruled index card. */
export function IndexCard({
  puzzle,
  index,
  to,
  onDelete,
}: {
  puzzle: Puzzle
  index: number
  to: string
  onDelete: () => void
}) {
  const excerpt = puzzle.summary.replace(/\s+/g, ' ').trim()
  const broken = answerProblem(puzzle)
  const toMove = puzzle.side_to_move === 'w' ? 'White' : 'Black'
  return (
    <div
      className="relative rounded-[10px] border border-line bg-surface shadow-[0_10px_22px_-16px_rgba(0,0,0,0.5)] transition active:scale-[0.99]"
      style={{
        transform: `rotate(${index % 2 === 0 ? -0.4 : 0.5}deg)`,
        backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 27px, var(--paper-rule) 27px 28px)',
        backgroundPosition: '0 44px',
      }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-10 h-px bg-paper-head-rule" />
      <Link to={to} className="block p-4 pb-3">
        <div className="flex items-start gap-3.5">
          <div className="w-[88px] shrink-0 sm:w-[104px]">
            <Board
              fen={normalizeFen(puzzle.starting_fen, puzzle.side_to_move)}
              arrows={puzzle.arrows}
              highlights={puzzle.highlights}
              coordinates={false}
              className="rounded-[3px] shadow-none"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[13px] font-bold text-ink-3 tabular-nums">#{index + 1}</span>
              <span className="font-display text-[22px] leading-none font-semibold text-ink sm:text-[24px]">{puzzle.label || 'Untitled'}</span>
              {puzzle.solution.length > 0 && (
                <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-ink-2">
                  {puzzle.solution.length} move{puzzle.solution.length === 1 ? '' : 's'}
                </span>
              )}
              {broken && (
                <span
                  title={broken}
                  className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn"
                >
                  <Warning size={12} /> answer doesn't replay
                </span>
              )}
            </div>
            {excerpt ? (
              <p className="mt-1.5 line-clamp-3 text-[14px] leading-[1.45] text-ink-2">{excerpt}</p>
            ) : (
              <p className="mt-1.5 text-[13.5px] text-ink-3 italic">No explanation yet</p>
            )}
          </div>
        </div>
      </Link>
      <div className="flex items-center justify-between px-4 pb-3">
        <span className="text-[12px] font-semibold tracking-[0.1em] text-ink-3 uppercase">{toMove} to move</span>
        <div className="flex items-center gap-1">
          <IconButton label="Delete position" className="h-9 w-9 text-ink-3" onClick={onDelete}>
            <Trash size={16} />
          </IconButton>
          <Link to={to} className="text-[13px] font-semibold text-accent">
            Open ›
          </Link>
        </div>
      </div>
    </div>
  )
}
