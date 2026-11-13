import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import type { Puzzle } from '../../types/domain'
import { LEVELS, levelRun, type LevelKey } from '../../lib/levels'
import { setShownLevel } from '../../lib/shownLevel'
import { Check, ChevronDown, Layers, Pencil, Play } from '../ui/Icons'

const MENU_WIDTH = 240

/**
 * A broken-down position's Level dropdown: Beginner, Intermediate or Advanced
 * (the position itself), shown in place wherever the position is, and
 * remembered on this device. Also: run all three in order, or edit them on
 * the De-Construct page.
 */
export function LevelPicker({
  puzzle,
  value,
  runTo,
  editTo,
  tone = 'paper',
  className,
}: {
  /** The position itself, with its levels. */
  puzzle: Puzzle
  value: LevelKey
  /** Beginner → Advanced in order (Present or Coach view's levels run). */
  runTo: string
  /** The De-Construct page. */
  editTo: string
  /** On a card (paper) or straight on the page's background. */
  tone?: 'paper' | 'page'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // The menu hangs from the button's right edge, unless there isn't room on that side (a phone, the button on the left).
  const [fromLeft, setFromLeft] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  const run = levelRun(puzzle)
  const name = LEVELS.find((l) => l.key === value)?.name ?? 'Advanced'

  // Closes on a press outside it, or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const item = 'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[15px] text-ink hover:bg-surface-2'
  return (
    <span ref={wrap} className={clsx('relative inline-block', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Level: ${name}`}
        title="De-Construct: show this position at Beginner, Intermediate or Advanced"
        onClick={() => {
          const box = wrap.current?.getBoundingClientRect()
          if (box) setFromLeft(box.right < MENU_WIDTH + 8)
          setOpen((o) => !o)
        }}
        className={clsx(
          'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13.5px] font-semibold whitespace-nowrap transition',
          tone === 'page' ? 'hover:bg-black/5' : 'bg-surface hover:bg-surface-2',
          // At an easier level, it says so in the accent colour.
          value !== 'advanced' ? 'border-accent text-accent-strong' : tone === 'page' ? 'border-on-bg-2/40 text-on-bg' : 'border-line-strong text-ink',
        )}
      >
        <Layers size={15} />
        {name}
        <ChevronDown size={15} className={clsx('transition', open && 'rotate-180')} />
      </button>
      {open && (
        <span
          role="menu"
          aria-label="Level"
          style={{ width: MENU_WIDTH }}
          className={clsx('absolute top-full z-50 mt-1.5 block rounded-xl border border-line bg-surface p-1.5 shadow-float', fromLeft ? 'left-0' : 'right-0')}
        >
          {run.map((l) => (
            <button
              key={l.key}
              type="button"
              role="menuitemradio"
              aria-checked={l.key === value}
              className={clsx(item, l.key === value && 'font-semibold')}
              onClick={() => {
                setShownLevel(puzzle.id, l.key)
                setOpen(false)
              }}
            >
              <span className="w-4 shrink-0 text-accent">{l.key === value && <Check size={16} />}</span>
              {l.name}
              {l.key === 'advanced' && <span className="text-[13px] text-ink-3">the position</span>}
            </button>
          ))}
          <span className="my-1 block h-px bg-line" />
          <Link to={runTo} role="menuitem" className={item} onClick={() => setOpen(false)}>
            <Play size={16} className="shrink-0 text-ink-3" /> Run all three
          </Link>
          <Link to={editTo} role="menuitem" className={item} onClick={() => setOpen(false)}>
            <Pencil size={16} className="shrink-0 text-ink-3" /> Edit levels…
          </Link>
        </span>
      )}
    </span>
  )
}
