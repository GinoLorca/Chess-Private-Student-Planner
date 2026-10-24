import { Link } from 'react-router-dom'
import type { Puzzle } from '../../types/domain'
import { normalizeFen } from '../../lib/fen'
import { hasLevels, levelRun } from '../../lib/levels'
import { Board } from '../board/Board'
import { Button } from '../ui/Button'
import { SectionLabel } from '../ui/Page'
import { Layers } from '../ui/Icons'

/**
 * On the position page: its De-Construct levels at a glance (hidden while the
 * answer is, since an easier version gives the idea away), or the way in.
 */
export function DeconstructCard({ puzzle, to, hidden }: { puzzle: Puzzle; to: string; hidden: boolean }) {
  const run = hasLevels(puzzle) ? levelRun(puzzle) : []
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <SectionLabel className="mb-0">De-Construct</SectionLabel>
        <Link to={to}>
          <Button size="sm" variant={run.length ? 'ghost' : 'secondary'} icon={<Layers size={16} />}>
            {run.length ? 'Open' : 'Break it down'}
          </Button>
        </Link>
      </div>
      {run.length === 0 ? (
        <p className="mt-1 text-[14px] text-ink-2">The same idea at Beginner, Intermediate and Advanced: fewer pieces first, then more to see past.</p>
      ) : hidden ? (
        <p className="mt-1 text-[14px] text-ink-3">{run.length} levels, hidden with the answer.</p>
      ) : (
        <Link to={to} className="mt-2 grid grid-cols-3 gap-2.5">
          {run.map((l) => (
            <span key={l.key} className="min-w-0">
              <Board
                fen={normalizeFen(l.puzzle.starting_fen, l.puzzle.side_to_move)}
                orientation={l.puzzle.side_to_move === 'b' ? 'black' : 'white'}
                coordinates={false}
                className="rounded-[3px] shadow-none"
              />
              <span className="mt-1 block truncate text-center text-[12px] font-semibold text-ink-2">{l.name}</span>
            </span>
          ))}
        </Link>
      )}
    </div>
  )
}
