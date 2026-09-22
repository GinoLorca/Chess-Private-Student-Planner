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
import { onColor } from '../../lib/colors'
import { CopyLinkButton } from '../ui/CopyLink'

/**
 * The lesson page as an open manila folder: the student's tab on top, the
 * body in their folder colour, dividers for sections, index cards for
 * positions and a sticky note for the agenda. Stationery, not software.
 */

/** A school badge: the logo on a white disc, so it reads on any folder colour. */
export function LogoBadge({ logo, size = 24, className }: { logo: string; size?: number; className?: string }) {
  return (
    <span
      className={clsx('block shrink-0 overflow-hidden rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.25)]', className)}
      style={{ width: size, height: size }}
    >
      <img src={logo} alt="" className="h-full w-full object-cover" draggable={false} />
    </span>
  )
}

export function FolderTab({ color, name, aside, logo }: { color: string; name: string; aside?: ReactNode; logo?: string | null }) {
  const ink = onColor(color)
  return (
    <div className="flex items-end gap-3 pl-4 sm:pl-6">
      <div
        className="folder-tab flex h-8 items-center gap-2.5 rounded-t-xl px-4 shadow-[inset_0_-2px_0_rgba(0,0,0,0.06)] sm:h-9"
        style={{ background: color }}
      >
        {logo ? <LogoBadge logo={logo} size={22} /> : <span className="block h-2.5 w-2.5 rounded-[3px]" style={{ background: ink.dot }} />}
        <span className="text-[12px] font-bold tracking-[0.08em] uppercase sm:text-[13px]" style={{ color: ink.inkSoft }}>
          {name}
        </span>
      </div>
      {aside && <span className="pb-2 text-[13px] text-on-bg-2">{aside}</span>}
    </div>
  )
}

export function FolderBody({ color, children, className }: { color: string; children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx('folder-body relative rounded-r-2xl rounded-bl-2xl px-3 pt-4 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)] sm:px-5 sm:pt-5', className)}
      style={{ background: color }}
    >
      {children}
    </div>
  )
}

/** Planned / In progress / Taught as a rubber stamp; tap it to move on. Read-only without a handler. */
export function StatusStamp({
  status,
  onTap,
  size = 'md',
}: {
  status: LessonStatus | undefined
  onTap?: () => void
  size?: 'sm' | 'md'
}) {
  const s = status ?? 'planned'
  // Ink per status comes from tokens so a skin can restamp it (see skins.css).
  const ink = s === 'taught' ? 'var(--stamp-taught)' : s === 'in_progress' ? 'var(--stamp-progress)' : 'var(--stamp-planned)'
  const cls = clsx(
    'folder-stamp inline-flex -rotate-[4deg] items-center rounded-md border-2 bg-white/35 font-extrabold tracking-[0.14em] uppercase',
    size === 'sm' ? 'h-[26px] px-2 text-[10px]' : 'h-8 px-3 text-[11px] sm:h-[30px] sm:text-[12px]',
    onTap && 'transition active:scale-95',
  )
  const style = { color: ink, borderColor: ink, fontFamily: 'var(--font-stamp, inherit)' }
  if (!onTap) {
    return (
      <span className={cls} style={style}>
        {statusLabel(s)}
      </span>
    )
  }
  return (
    <button type="button" onClick={onTap} title={`Tap to mark ${statusLabel(nextStatus(s))}`} className={cls} style={style}>
      {statusLabel(s)}
    </button>
  )
}

/** A yellow note with a paper clip; whatever goes inside is the agenda. */
export function StickyNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('folder-sticky relative rotate-[1.2deg]', className)}>
      <svg
        width="26"
        height="60"
        viewBox="0 0 26 60"
        fill="none"
        stroke="var(--clip, #7a7a72)"
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden
        className="absolute -top-[26px] left-4 z-10 -rotate-12"
      >
        <path d="M8 52V12a6 6 0 0 1 12 0v36a4 4 0 0 1-8 0V16" />
      </svg>
      <div className="sticky-paper rounded-xs bg-sticky px-4 pt-4 pb-3 pl-12 text-sticky-ink shadow-[0_10px_22px_-14px_rgba(0,0,0,0.5)]">{children}</div>
    </div>
  )
}

export interface DividerTabItem {
  id: string
  title: string
  color: string
  count?: number
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
  /** Omit to leave out the "+ Section" tab. */
  onAdd?: () => void
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
              'divider-tab flex shrink-0 items-center gap-2 rounded-t-xl px-3.5 text-[12px] font-bold tracking-[0.06em] whitespace-nowrap uppercase transition sm:px-4 sm:text-[13px]',
              active ? 'active h-10 text-black/70 shadow-[0_-6px_14px_-10px_rgba(0,0,0,0.35)]' : 'h-[34px] text-black/55 brightness-[0.96]',
            )}
            style={{ background: t.color }}
          >
            {t.title || 'Untitled section'}
            {t.count !== undefined && (
              <span className="inline-grid h-[22px] min-w-[22px] place-items-center rounded-full bg-black/10 px-1.5 text-[12px] tabular-nums">
                {t.count}
              </span>
            )}
            {t.warn && <span className="block h-2 w-2 rounded-full bg-warn" title="An answer doesn't replay" />}
          </button>
        )
      })}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="divider-tab add h-[34px] shrink-0 rounded-t-xl border-2 border-b-0 border-dashed border-black/25 px-3.5 text-[12px] font-bold tracking-[0.06em] whitespace-nowrap text-black/50 uppercase transition active:bg-black/5 sm:text-[13px]"
        >
          + Section
        </button>
      )}
    </div>
  )
}

/** The open divider: ruled paper with the tab's colour down the left edge. */
export function DividerPaper({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div
      className="divider-paper -mx-3 -mt-[18px] rounded-t-2xl bg-paper px-3 pt-5 pb-6 shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.4)] sm:-mx-5 sm:px-5"
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
      className="index-card relative min-w-0 rounded-xl border border-line bg-surface shadow-[0_10px_22px_-16px_rgba(0,0,0,0.5)] transition active:scale-[0.99]"
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
          <CopyLinkButton puzzleId={puzzle.id} />
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

/**
 * A hanging file inside the student's folder: one per sub-folder (lesson
 * plans, invoices, ...). The coloured tab carries the name, the count sits on
 * the file itself.
 */
export function HangingFile({
  to,
  color,
  label,
  count,
  icon,
}: {
  to: string
  color: string
  label: string
  count?: number
  icon?: ReactNode
}) {
  const body = count === undefined ? '\u00a0' : count === 0 ? 'Empty' : `${count} ${count === 1 ? 'item' : 'items'}`
  const ink = onColor(color)
  return (
    <Link to={to} className="hanging-file block transition active:scale-[0.99]">
      <span
        className="folder-tab ml-4 flex h-7 w-fit max-w-[70%] items-center gap-2 rounded-t-xl px-3.5 text-[12px] font-bold tracking-[0.08em] uppercase sm:ml-6"
        style={{ background: color, color: ink.inkSoft }}
      >
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span
        className="hanging-body flex h-[52px] items-center justify-between rounded-r-xl rounded-bl-xl px-4 shadow-[0_10px_22px_-16px_rgba(0,0,0,0.5)] sm:px-5"
        style={{ background: color }}
      >
        <span className="text-[15px] font-semibold" style={{ color: ink.ink }}>
          {body}
        </span>
        <span className="rounded-full px-3 py-1 text-[13px] font-bold" style={{ background: ink.chip, color: ink.inkSoft }}>
          Open ›
        </span>
      </span>
    </Link>
  )
}

/** One lesson as a ruled index card on the lesson-plans divider. */
export function LessonCard({
  number,
  title,
  theme,
  status,
  taughtOn,
  to,
  onDelete,
}: {
  number: number
  title?: string
  theme?: string
  status: LessonStatus | undefined
  taughtOn?: string | null
  to: string
  onDelete: () => void
}) {
  return (
    <div
      className="index-card relative rounded-xl border border-line bg-surface shadow-[0_10px_22px_-16px_rgba(0,0,0,0.5)] transition active:scale-[0.99]"
      style={{
        transform: `rotate(${number % 2 === 0 ? 0.4 : -0.5}deg)`,
        backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 27px, var(--paper-rule) 27px 28px)',
        backgroundPosition: '0 44px',
      }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-10 h-px bg-paper-head-rule" />
      <Link to={to} className="block p-4 pb-2">
        <div className="flex items-start gap-3.5">
          <div className="flex shrink-0 items-baseline gap-1.5">
            <span className="text-[11px] font-bold tracking-[0.14em] text-ink-3 uppercase">Lesson</span>
            <span className="font-display text-[40px] leading-none font-bold tracking-[-0.02em] text-ink">{number}</span>
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <p className="truncate font-display text-[20px] leading-tight font-semibold text-ink">{title || (theme ? '\u00a0' : 'Untitled')}</p>
            {theme && <p className="mt-0.5 truncate text-[13px] text-ink-2">{theme}</p>}
          </div>
          <StatusStamp status={status} size="sm" />
        </div>
      </Link>
      <div className="flex items-center justify-between px-4 pb-2.5">
        <span className="text-[12px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
          {taughtOn ? `Taught ${formatShortDate(taughtOn)}` : '\u00a0'}
        </span>
        <div className="flex items-center gap-1">
          <IconButton label="Delete lesson" className="h-9 w-9 text-ink-3" onClick={onDelete}>
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

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Index-card stock for panels that aren't a position: the coach view's
 * call-outs, the editor's fields. `ruled` draws the lines behind reading text;
 * leave it off behind inputs.
 */
export function PaperCard({
  children,
  className,
  ruled,
  tilt,
}: {
  children: ReactNode
  className?: string
  ruled?: boolean
  tilt?: number
}) {
  return (
    <div
      className={clsx('index-card relative rounded-xl border border-line bg-surface shadow-[0_10px_22px_-16px_rgba(0,0,0,0.5)]', className)}
      style={{
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        backgroundImage: ruled ? 'repeating-linear-gradient(to bottom, transparent 0 27px, var(--paper-rule) 27px 28px)' : undefined,
        backgroundPosition: ruled ? '0 44px' : undefined,
      }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-10 h-px bg-paper-head-rule" />
      {children}
    </div>
  )
}
