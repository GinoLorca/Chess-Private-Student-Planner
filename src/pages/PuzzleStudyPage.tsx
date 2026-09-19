import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { getPuzzle } from '../lib/api'
import type { Puzzle } from '../types/domain'
import { DisplayBoard } from '../components/puzzle/DisplayBoard'

const SWIPE_THRESHOLD = 60

export function PuzzleStudyPage() {
  const { studentId, lessonPlanId, puzzleId } = useParams<{
    studentId: string
    lessonPlanId: string
    puzzleId: string
  }>()
  const navigate = useNavigate()
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)

  useEffect(() => {
    if (!puzzleId) return
    getPuzzle(puzzleId).then(setPuzzle)
  }, [puzzleId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Escape') navigate(backHref)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, puzzle])

  if (!puzzle) return null

  const backHref = `/students/${studentId}/lessons/${lessonPlanId}`
  const lastStep = puzzle.solution.length
  const atIntro = step === 0
  const move = atIntro ? null : puzzle.solution[step - 1]
  const boardFen = atIntro ? puzzle.starting_fen : move!.fen

  function go(delta: number) {
    setDirection(delta)
    setStep((s) => Math.min(Math.max(s + delta, 0), lastStep))
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_THRESHOLD) go(1)
    else if (info.offset.x > SWIPE_THRESHOLD) go(-1)
  }

  return (
    <div className="flex min-h-svh flex-col bg-ink-950">
      <div className="flex items-center justify-between px-4 pt-4">
        <button onClick={() => navigate(backHref)} className="text-xs text-ink-400 hover:text-ink-100">
          ← Exit
        </button>
        <span className="rounded-full bg-ink-800 px-3 py-1 text-xs font-medium text-ink-300">
          {atIntro ? 'Start' : `Move ${step} / ${lastStep}`}
        </span>
      </div>

      <div className="mb-2 mt-3 flex gap-1 px-4">
        {Array.from({ length: lastStep + 1 }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-gold-500' : 'bg-ink-800'}`}
          />
        ))}
      </div>

      <div className="relative flex-1 overflow-hidden px-4 pb-4">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 60 : -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -60 : 60 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={onDragEnd}
            className="mx-auto flex h-full max-w-md flex-col justify-center"
          >
            <div className="mx-auto w-full">
              <DisplayBoard
                fen={boardFen}
                arrows={atIntro ? puzzle.arrows : []}
                highlights={atIntro ? puzzle.highlights : []}
              />
            </div>

            <div className="mt-5 min-h-[7rem] text-center">
              {atIntro ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {puzzle.side_to_move === 'w' ? 'White' : 'Black'} to play
                  </p>
                  <h1 className="font-marker mt-1 text-2xl text-gold-500">{puzzle.label || 'Untitled'}</h1>
                  {puzzle.quiz_prompt && <p className="mt-2 text-base text-ink-100">{puzzle.quiz_prompt}</p>}
                  {puzzle.summary && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-300">{puzzle.summary}</p>
                  )}
                  {!puzzle.quiz_prompt && !puzzle.summary && (
                    <p className="mt-3 text-sm text-ink-500">Swipe to step through the solution →</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {Math.floor((step - 1) / 2) + 1}
                    {step % 2 === 1 ? '.' : '…'}
                  </p>
                  <h1 className="font-mono text-4xl font-bold text-ink-50">{move!.san}</h1>
                  <p className="mt-3 min-h-[2.5rem] whitespace-pre-wrap text-base leading-relaxed text-ink-200">
                    {move!.comment || 'No explanation added for this move.'}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 pb-6">
        <button
          onClick={() => go(-1)}
          disabled={step === 0}
          className="flex-1 rounded-xl border border-ink-700 py-3 text-sm font-medium text-ink-200 disabled:opacity-30"
        >
          ← Back
        </button>
        <button
          onClick={() => go(1)}
          disabled={step === lastStep}
          className="flex-1 rounded-xl bg-gold-500 py-3 text-sm font-semibold text-ink-950 disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
