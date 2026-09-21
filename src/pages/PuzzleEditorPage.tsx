import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPuzzle, updatePuzzle } from '../lib/data'
import type { BoardArrow, BoardHighlight, Puzzle, SolutionMove } from '../types/domain'
import { sideToMoveFromFen } from '../lib/chessboardUtils'
import { PositionSetupBoard } from '../components/puzzle/PositionSetupBoard'
import { AnnotateBoard } from '../components/puzzle/AnnotateBoard'
import { SolutionRecorderBoard } from '../components/puzzle/SolutionRecorderBoard'

type Tab = 'setup' | 'annotate' | 'solution'

export function PuzzleEditorPage() {
  const { studentId, lessonPlanId, puzzleId } = useParams<{
    studentId: string
    lessonPlanId: string
    puzzleId: string
  }>()
  const navigate = useNavigate()
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [tab, setTab] = useState<Tab>('setup')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!puzzleId) return
    getPuzzle(puzzleId).then(setPuzzle)
  }, [puzzleId])

  async function persist(patch: Partial<Puzzle>) {
    if (!puzzle) return
    setSaving(true)
    await updatePuzzle(puzzle.id, patch)
    setSaving(false)
  }

  function setAndSave<K extends keyof Puzzle>(key: K, value: Puzzle[K]) {
    if (!puzzle) return
    setPuzzle({ ...puzzle, [key]: value })
    persist({ [key]: value } as Partial<Puzzle>)
  }

  if (!puzzle) return null

  const backHref = `/students/${studentId}/lessons/${lessonPlanId}`

  return (
    <div className="mx-auto min-h-svh max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => navigate(backHref)} className="text-xs text-ink-400 hover:text-ink-100">
          ← Back to lesson plan
        </button>
        {saving && <span className="text-xs text-ink-500">saving…</span>}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={puzzle.label}
          onChange={(e) => setPuzzle({ ...puzzle, label: e.target.value })}
          onBlur={(e) => persist({ label: e.target.value })}
          placeholder="Short label, e.g. Kg7"
          className="font-marker min-w-0 flex-1 bg-transparent text-2xl text-gold-500 outline-none"
        />
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-ink-800 p-1">
        {(
          [
            ['setup', 'Setup position'],
            ['annotate', 'Annotate answer'],
            ['solution', 'Record solution'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              tab === key ? 'bg-gold-500 text-ink-950' : 'text-ink-300 hover:text-ink-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-8 rounded-xl border border-ink-800 bg-ink-900/50 p-4">
        {tab === 'setup' && (
          <PositionSetupBoard
            fen={puzzle.starting_fen}
            sideToMove={puzzle.side_to_move}
            onChange={(fen) => {
              const side = sideToMoveFromFen(fen)
              setPuzzle({ ...puzzle, starting_fen: fen, side_to_move: side })
              persist({ starting_fen: fen, side_to_move: side })
            }}
            onSideToMoveChange={(side) => {
              setPuzzle({ ...puzzle, side_to_move: side })
              persist({ side_to_move: side })
            }}
          />
        )}
        {tab === 'annotate' && (
          <AnnotateBoard
            fen={puzzle.starting_fen}
            arrows={puzzle.arrows}
            highlights={puzzle.highlights}
            onArrowsChange={(arrows: BoardArrow[]) => setAndSave('arrows', arrows)}
            onHighlightsChange={(highlights: BoardHighlight[]) => setAndSave('highlights', highlights)}
          />
        )}
        {tab === 'solution' && (
          <SolutionRecorderBoard
            startingFen={puzzle.starting_fen}
            solution={puzzle.solution}
            onSolutionChange={(solution: SolutionMove[]) => setAndSave('solution', solution)}
          />
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
            Quiz prompt (shown to the student before the answer)
          </label>
          <input
            value={puzzle.quiz_prompt}
            onChange={(e) => setPuzzle({ ...puzzle, quiz_prompt: e.target.value })}
            onBlur={(e) => persist({ quiz_prompt: e.target.value })}
            placeholder="e.g. How should Black react against White's last move?"
            className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-gold-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
            Summary / context (your explanation of the position)
          </label>
          <textarea
            value={puzzle.summary}
            onChange={(e) => setPuzzle({ ...puzzle, summary: e.target.value })}
            onBlur={(e) => persist({ summary: e.target.value })}
            rows={4}
            placeholder="Explain the idea so future-you can teach it again without re-deriving it."
            className="w-full resize-y rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-ink-200 outline-none focus:border-gold-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
              Reference link (optional)
            </label>
            <input
              value={puzzle.reference_url ?? ''}
              onChange={(e) => setPuzzle({ ...puzzle, reference_url: e.target.value })}
              onBlur={(e) => persist({ reference_url: e.target.value || null })}
              placeholder="https://lichess.org/training/… or chess.com/…"
              className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-xs text-ink-100 outline-none focus:border-gold-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
              Link label (optional)
            </label>
            <input
              value={puzzle.reference_label ?? ''}
              onChange={(e) => setPuzzle({ ...puzzle, reference_label: e.target.value })}
              onBlur={(e) => persist({ reference_label: e.target.value || null })}
              placeholder="e.g. Lichess puzzle #482913"
              className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-xs text-ink-100 outline-none focus:border-gold-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
