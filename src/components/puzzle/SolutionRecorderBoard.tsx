import { useEffect, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { PieceDropHandlerArgs } from 'react-chessboard'
import type { SolutionMove } from '../../types/domain'

export function SolutionRecorderBoard({
  startingFen,
  solution,
  onSolutionChange,
}: {
  startingFen: string
  solution: SolutionMove[]
  onSolutionChange: (solution: SolutionMove[]) => void
}) {
  const [chess] = useState(() => new Chess())
  const [fen, setFen] = useState(startingFen)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    try {
      chess.load(startingFen)
      for (const move of solution) chess.move(move.san)
      setFen(chess.fen())
      setLoadError(null)
    } catch {
      setLoadError(
        'This position needs both kings and a legal setup to record moves on the board. Use the comment fields below to type the sequence instead.',
      )
    }
    // re-sync only on puzzle switch or move count change (undo/new move), not on comment edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startingFen, solution.length])

  function handleDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare) return false
    try {
      const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
      if (!move) return false
      onSolutionChange([...solution, { san: move.san, fen: chess.fen() }])
      setFen(chess.fen())
      return true
    } catch {
      return false
    }
  }

  function undoLast() {
    chess.undo()
    onSolutionChange(solution.slice(0, -1))
    setFen(chess.fen())
  }

  function updateComment(i: number, comment: string) {
    onSolutionChange(solution.map((m, idx) => (idx === i ? { ...m, comment } : m)))
  }

  const options = {
    id: 'solution-board',
    position: fen,
    boardOrientation: 'white' as const,
    allowDragging: !loadError,
    allowDrawingArrows: false,
    onPieceDrop: handleDrop,
    darkSquareStyle: { backgroundColor: 'var(--color-board-dark)' },
    lightSquareStyle: { backgroundColor: 'var(--color-board-light)' },
  }

  return (
    <div className="space-y-3">
      {loadError && <p className="text-xs text-amber-400">{loadError}</p>}
      <div className="mx-auto max-w-md">
        <Chessboard options={options} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={undoLast}
          disabled={solution.length === 0}
          className="text-xs text-ink-400 hover:text-ink-100 disabled:opacity-40"
        >
          Undo last move
        </button>
      </div>
      {solution.length > 0 && (
        <ol className="space-y-1">
          {solution.map((m, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-9 shrink-0 text-xs text-ink-500">
                {Math.floor(i / 2) + 1}
                {i % 2 === 0 ? '.' : '…'}
              </span>
              <span className="w-14 shrink-0 font-mono text-sm text-ink-100">{m.san}</span>
              <input
                value={m.comment ?? ''}
                onChange={(e) => updateComment(i, e.target.value)}
                placeholder="comment (optional)"
                className="flex-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-ink-200 outline-none focus:border-gold-500"
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
