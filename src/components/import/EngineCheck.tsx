import { useState } from 'react'
import type { SolutionMove } from '../../types/domain'
import { fetchCloudEval, type CloudEval } from '../../lib/import/lichess'
import { Button } from '../ui/Button'

interface EngineCheckProps {
  fen: string
  solution: SolutionMove[]
  onUseLine: (line: SolutionMove[]) => void
}

function formatScore(ev: CloudEval, sideToMove: 'w' | 'b'): string {
  if (ev.mate !== undefined) {
    const m = sideToMove === 'w' ? ev.mate : -ev.mate
    return m > 0 ? `Mate in ${m}` : `Gets mated in ${-m}`
  }
  const cp = (ev.cp ?? 0) * (sideToMove === 'w' ? 1 : -1)
  const pawns = (cp / 100).toFixed(1)
  return cp > 0 ? `+${pawns} for the side to move` : `${pawns} for the side to move`
}

/**
 * One tap asks Lichess's cloud for the engine line. The coach still solves the
 * puzzle himself; this is the "did I miss something" safety net before the lesson.
 */
export function EngineCheck({ fen, solution, onUseLine }: EngineCheckProps) {
  const [state, setState] = useState<{ status: 'idle' } | { status: 'loading' } | { status: 'done'; ev: CloudEval | null } | { status: 'error'; message: string }>({
    status: 'idle',
  })
  const sideToMove = (fen.split(' ')[1] as 'w' | 'b') ?? 'w'

  async function check() {
    setState({ status: 'loading' })
    try {
      setState({ status: 'done', ev: await fetchCloudEval(fen) })
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const ev = state.status === 'done' ? state.ev : null
  const first = solution[0]?.san
  const engineFirst = ev?.line[0]?.san
  const verdict =
    ev && first && engineFirst
      ? first === engineFirst
        ? { tone: 'good', text: 'Matches your first move.' }
        : { tone: 'warn', text: `Engine prefers ${engineFirst} over ${first}.` }
      : null

  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">Engine check</p>
          <p className="text-[12.5px] text-ink-3">Lichess cloud analysis — no account needed.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={check} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Checking…' : state.status === 'done' ? 'Check again' : 'Check'}
        </Button>
      </div>

      {state.status === 'error' && <p className="mt-2 text-[13px] text-danger">{state.message}</p>}

      {state.status === 'done' && !ev && (
        <p className="mt-2 text-[13px] text-ink-2">
          No cloud analysis for this exact position yet. Open it on lichess.org/analysis once and the engine result will
          be there next time.
        </p>
      )}

      {ev && (
        <div className="mt-2 space-y-1.5">
          <p className="text-[14px] text-ink">
            <span className="font-semibold">{formatScore(ev, sideToMove)}</span>
            <span className="text-ink-3"> · depth {ev.depth}</span>
          </p>
          <p className="font-mono text-[14px] text-ink-2">{ev.line.map((m) => m.san).join(' ')}</p>
          {verdict && (
            <p className={verdict.tone === 'good' ? 'text-[13px] font-medium text-accent-strong' : 'text-[13px] font-medium text-warn'}>
              {verdict.text}
            </p>
          )}
          <Button size="sm" variant="ghost" onClick={() => onUseLine(ev.line)}>
            Use engine line as the answer
          </Button>
        </div>
      )}
    </div>
  )
}
