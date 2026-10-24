import { useId, type ReactNode } from 'react'
import clsx from 'clsx'

/**
 * Marks on whichever board is inside, by square, without the board knowing:
 * a ring under the pieces a harder level shares with the easiest (the core),
 * and a fade-in for the pieces a level adds. Works for every board the app
 * has (still, drawable, solvable), since each square carries data-square.
 */
export function LevelMarks({ core = [], fresh = [], className, children }: { core?: string[]; fresh?: string[]; className?: string; children: ReactNode }) {
  const scope = `lv${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const sel = (squares: string[], tail: string) => squares.map((sq) => `.${scope} [data-square="${sq}"]${tail}`).join(',')
  const css = [
    core.length
      ? `${sel(core, '::before')}{content:'';position:absolute;inset:7%;border-radius:9999px;pointer-events:none;box-shadow:inset 0 0 0 max(2px,0.55cqw) var(--accent),0 0 max(3px,1cqw) color-mix(in srgb,var(--accent) 45%,transparent)}`
      : '',
    fresh.length ? `${sel(fresh, ' .board-piece')}{animation:level-piece-in 520ms cubic-bezier(.2,.7,.3,1) 260ms both}` : '',
  ].join('')
  return (
    <div className={clsx(scope, className)}>
      {css && <style>{css}</style>}
      {children}
    </div>
  )
}
