import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import type { Puzzle } from '../../types/domain'
import type { Mention } from '../../lib/moveMentions'
import type { MoveDemo } from '../../hooks/useMoveDemo'
import { stepLabel } from '../../lib/solution'
import { ChevronLeft, ChevronRight, Close } from '../ui/Icons'
import { IconButton } from '../ui/Button'

/**
 * Text with the moves and squares it names made tappable: a move shows on
 * the board, a square lights up there. The one the board is showing stays lit.
 */
export function MoveText({ text, mentions, demo }: { text: string; mentions: Mention[]; demo: MoveDemo }) {
  const parts: ReactNode[] = []
  let at = 0
  mentions.forEach((m, i) => {
    if (m.start > at) parts.push(<Fragment key={`t${i}`}>{text.slice(at, m.start)}</Fragment>)
    const on = demo.isOn(m.target)
    const square = m.target.kind === 'square'
    parts.push(
      <button
        key={`m${i}`}
        type="button"
        onClick={(e) => {
          // A tap or click lets go of focus (a keyboard press keeps it), so the
          // clicker's keys walk the board instead of pressing this again.
          if (e.detail > 0) e.currentTarget.blur()
          demo.pick(m.target)
        }}
        title={square ? `Light up ${text.slice(m.start, m.end)}` : 'Show on the board'}
        className={clsx(
          // Above a row's own tap area, so the move is what's tapped.
          'relative z-10 -mx-[2px] rounded-[5px] px-[2px] underline decoration-1 underline-offset-[3px] transition',
          // A threat's underline is wavy, a move's dotted: told apart on any skin, whatever its colours.
          square
            ? 'text-inherit decoration-dotted hover:decoration-solid'
            : m.target.kind === 'threat'
              ? 'font-semibold text-danger decoration-wavy'
              : 'font-semibold text-accent-strong decoration-dotted hover:decoration-solid',
          on && (square ? 'bg-warn-soft no-underline' : 'bg-accent-soft no-underline'),
        )}
      >
        {text.slice(m.start, m.end)}
      </button>,
    )
    at = m.end
  })
  if (at < text.length) parts.push(<Fragment key="end">{text.slice(at)}</Fragment>)
  return <>{parts}</>
}

/**
 * Under the board while a side line or threat from the text is up: its moves
 * (tap one to go there), Back / Next through it, and ✕ for the answer again.
 */
export function LineBar({ demo, puzzle, className }: { demo: MoveDemo; puzzle: Puzzle; className?: string }) {
  const d = demo.demo
  // The move the board is on stays in view in the strip, however long the line.
  const strip = useRef<HTMLDivElement>(null)
  const at = d?.kind === 'line' ? `${d.line.id}:${d.ply}` : ''
  useEffect(() => {
    const box = strip.current
    const chip = box?.querySelector<HTMLElement>('[aria-current="step"]')
    if (!box || !chip) return
    // The strip is the chips' offset parent: offsetLeft is within it.
    const left = chip.offsetLeft
    if (left < box.scrollLeft || left + chip.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: left - (box.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' })
    }
  }, [at])
  if (!d) return null
  return (
    <div className={clsx('flex items-center gap-1 rounded-xl border border-line bg-surface py-1 pr-1 pl-3 shadow-card', className)}>
      {/* On a phone the moves need the room; a threat keeps its word. */}
      <span className={clsx('shrink-0 text-[11px] font-bold tracking-[0.1em] text-ink-3 uppercase', d.kind === 'line' && 'hidden sm:inline')}>
        {d.kind === 'threat' ? 'Threat' : 'Line'}
      </span>
      <div ref={strip} className="relative flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
        {d.kind === 'threat' ? (
          <span className="rounded-lg bg-danger-soft px-2 py-1 font-mono text-[15px] font-semibold whitespace-nowrap text-ink ring-1 ring-danger/50">
            {d.black ? '…' : ''}
            {d.san}
          </span>
        ) : (
          d.line.plies.slice(d.line.branch).map((p, i) => {
            const ply = d.line.branch + i
            return (
              <button
                key={ply}
                type="button"
                onClick={() => demo.goTo(ply)}
                aria-current={ply === d.ply ? 'step' : undefined}
                className={clsx(
                  'shrink-0 rounded-lg px-2 py-1 font-mono text-[15px] font-semibold whitespace-nowrap transition',
                  ply === d.ply ? 'bg-accent text-accent-ink' : ply < d.ply ? 'text-ink-3 hover:bg-surface-2' : 'text-ink hover:bg-surface-2',
                )}
              >
                <span className="mr-1 text-[11px] font-normal opacity-70">{stepLabel(puzzle, ply + 1)}</span>
                {p.san}
              </button>
            )
          })
        )}
      </div>
      {d.kind === 'line' && (
        <>
          <IconButton label="Back" onClick={demo.back} disabled={d.ply <= d.line.branch - 1}>
            <ChevronLeft />
          </IconButton>
          <IconButton label="Next" onClick={demo.forward} disabled={d.ply >= d.line.plies.length - 1}>
            <ChevronRight />
          </IconButton>
        </>
      )}
      <IconButton label="Back to the answer" onClick={demo.close}>
        <Close />
      </IconButton>
    </div>
  )
}
