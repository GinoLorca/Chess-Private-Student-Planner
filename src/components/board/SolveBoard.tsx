import { motion } from 'framer-motion'
import type { Orientation } from '../../lib/fen'
import type { Solve } from '../../hooks/useSolve'
import { MoveBoard } from './MoveBoard'
import { Button, IconButton } from '../ui/Button'
import { Eye, Refresh } from '../ui/Icons'

/** The live board. It owns its pointer, so page swipes don't fight piece drags. */
export function SolveBoardView({ solve, orientation, className }: { solve: Solve; orientation: Orientation; className?: string }) {
  const { current, wrong, misses, solved, tryMove } = solve
  const lastMove = current.from && current.to ? { from: current.from, to: current.to } : null
  return (
    <motion.div
      initial={{ x: 0 }}
      animate={{ x: wrong ? [0, -12, 12, -7, 7, 0] : 0 }}
      transition={{ duration: 0.4 }}
      key={misses}
      className={className}
      data-swipe-own
    >
      <MoveBoard fen={current.fen} orientation={orientation} lastMove={lastMove} onMove={tryMove} disabled={solved} />
    </motion.div>
  )
}

/** The moves played so far, the last wrong try struck through, and the stamp once it's played out. */
export function SolveStatus({
  solve,
  label,
  onReveal,
}: {
  solve: Solve
  /** The move number for a step, e.g. "1." or "1…". */
  label: (index: number) => string
  /** Shown once solved, to bring the answer and explanation back. */
  onReveal?: () => void
}) {
  const { steps, step, wrong, misses, solved, reset } = solve
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-2" aria-live="polite">
      {solved && (
        <span
          className="inline-block shrink-0 -rotate-6 rounded-md border-[3px] px-2 py-px font-display text-[16px] font-bold tracking-[0.12em] uppercase"
          style={{ color: 'var(--stamp-taught)', borderColor: 'var(--stamp-taught)' }}
        >
          Solved
        </span>
      )}
      <p className="min-w-[8rem] flex-1 font-mono text-[15px] leading-snug font-semibold text-ink-2">
        {steps
          .slice(1, step + 1)
          .map((s) => `${label(s.index)} ${s.san}`)
          .join('  ')}
        {wrong && <span className="ml-2 text-danger line-through">{wrong}</span>}
      </p>
      {solved && misses > 0 && <span className="shrink-0 text-[12.5px] text-ink-3 tabular-nums">{misses} ✗</span>}
      {solved && onReveal && (
        <Button size="sm" variant="soft" icon={<Eye size={15} />} onClick={onReveal}>
          Answer
        </Button>
      )}
      {(step > 0 || misses > 0) && (
        <IconButton label="Start again" className="-mr-1 h-9 w-9 shrink-0 text-ink-3" onClick={reset}>
          <Refresh size={17} />
        </IconButton>
      )}
    </div>
  )
}
