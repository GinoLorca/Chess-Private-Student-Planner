import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { getLessonPlan, listPuzzles, listSections } from '../lib/api'
import type { LessonPlan, Puzzle } from '../types/domain'
import { DisplayBoard } from '../components/puzzle/DisplayBoard'

type FlatPuzzle = Puzzle & { sectionTitle: string }

export function ViewerPage({ mode }: { mode: 'present' | 'coach' }) {
  const { studentId, lessonPlanId } = useParams<{ studentId: string; lessonPlanId: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<LessonPlan | null>(null)
  const [items, setItems] = useState<FlatPuzzle[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(mode === 'coach')

  const backHref = `/students/${studentId}/lessons/${lessonPlanId}`

  useEffect(() => {
    if (!lessonPlanId) return
    ;(async () => {
      const [p, sections] = await Promise.all([getLessonPlan(lessonPlanId), listSections(lessonPlanId)])
      setPlan(p)
      const all: FlatPuzzle[] = []
      for (const section of sections) {
        const puzzles = await listPuzzles(section.id)
        for (const puzzle of puzzles) all.push({ ...puzzle, sectionTitle: section.title })
      }
      setItems(all)
    })()
  }, [lessonPlanId])

  useEffect(() => {
    setRevealed(mode === 'coach')
  }, [index, mode])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!items || items.length === 0) return
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, items.length - 1))
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
      else if (e.key === ' ' && mode === 'present') {
        e.preventDefault()
        setRevealed((r) => !r)
      } else if (e.key === 'Escape') navigate(backHref)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items, mode, backHref, navigate])

  if (!items || !plan) return null

  if (items.length === 0) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-ink-950 text-center">
        <p className="text-ink-300">This lesson plan doesn't have any positions yet.</p>
        <button onClick={() => navigate(backHref)} className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-ink-950">
          Back to lesson plan
        </button>
      </div>
    )
  }

  const current = items[index]

  return (
    <div className="min-h-svh bg-ink-950">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => navigate(backHref)} className="text-xs text-ink-400 hover:text-ink-100">
            ← Exit {mode === 'present' ? 'presentation' : "coach's view"}
          </button>
          <span className="rounded-full bg-ink-800 px-3 py-1 text-xs font-medium text-ink-300">
            {index + 1} / {items.length}
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-1">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i === index ? 'bg-gold-500' : 'bg-ink-700 hover:bg-ink-600'}`}
              aria-label={`Go to position ${i + 1}`}
            />
          ))}
        </div>

        {current.sectionTitle && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gold-500">{current.sectionTitle}</p>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            {mode === 'present' ? (
              <PresentPanel puzzle={current} revealed={revealed} onReveal={() => setRevealed(true)} />
            ) : (
              <CoachPanel puzzle={current} />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            disabled={index === 0}
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-200 hover:border-gold-500 hover:text-gold-400 disabled:opacity-30"
          >
            ← Previous
          </button>
          <button
            onClick={() => setIndex((i) => Math.min(i + 1, items.length - 1))}
            disabled={index === items.length - 1}
            className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-gold-400 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

function PresentPanel({
  puzzle,
  revealed,
  onReveal,
}: {
  puzzle: FlatPuzzle
  revealed: boolean
  onReveal: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1fr]">
      <div className="mx-auto w-full max-w-md">
        <DisplayBoard
          fen={puzzle.starting_fen}
          arrows={revealed ? puzzle.arrows : []}
          highlights={revealed ? puzzle.highlights : []}
        />
      </div>
      <div className="flex flex-col justify-center space-y-4">
        {puzzle.quiz_prompt && (
          <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              {puzzle.side_to_move === 'w' ? 'White' : 'Black'} to play
            </p>
            <p className="mt-1 text-lg text-ink-100">{puzzle.quiz_prompt}</p>
          </div>
        )}

        {!revealed ? (
          <button
            onClick={onReveal}
            className="w-full rounded-xl bg-gold-500 py-3 text-sm font-semibold text-ink-950 hover:bg-gold-400"
          >
            Reveal answer (space)
          </button>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {puzzle.summary && (
              <div className="rounded-xl border border-gold-600/30 bg-gold-500/5 p-4">
                <p className="text-sm leading-relaxed text-ink-200">{puzzle.summary}</p>
              </div>
            )}
            {puzzle.solution.length > 0 && (
              <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Solution</p>
                <p className="font-mono text-sm text-ink-100">
                  {puzzle.solution
                    .map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m.san}` : m.san))
                    .join(' ')}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

function CoachPanel({ puzzle }: { puzzle: FlatPuzzle }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1fr]">
      <div className="mx-auto w-full max-w-md">
        <DisplayBoard fen={puzzle.starting_fen} arrows={puzzle.arrows} highlights={puzzle.highlights} />
      </div>
      <div className="space-y-3">
        <div>
          <h2 className="font-marker text-2xl text-gold-500">{puzzle.label || 'Untitled'}</h2>
          <p className="text-xs text-ink-400">{puzzle.side_to_move === 'w' ? 'White' : 'Black'} to move</p>
        </div>

        {puzzle.quiz_prompt && (
          <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Ask the student</p>
            <p className="mt-1 text-sm text-ink-100">{puzzle.quiz_prompt}</p>
          </div>
        )}

        {puzzle.summary && (
          <div className="rounded-xl border border-gold-600/30 bg-gold-500/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-500">Your notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-200">{puzzle.summary}</p>
          </div>
        )}

        {puzzle.solution.length > 0 && (
          <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Answer</p>
            <p className="font-mono text-sm text-ink-100">
              {puzzle.solution
                .map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m.san}` : m.san))
                .join(' ')}
            </p>
            {puzzle.solution.some((m) => m.comment) && (
              <ul className="mt-2 space-y-0.5 text-xs text-ink-400">
                {puzzle.solution
                  .filter((m) => m.comment)
                  .map((m, i) => (
                    <li key={i}>
                      <span className="font-mono text-ink-200">{m.san}:</span> {m.comment}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {puzzle.reference_url && (
          <a
            href={puzzle.reference_url}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-xs text-gold-500 hover:text-gold-400"
          >
            {puzzle.reference_label || puzzle.reference_url} ↗
          </a>
        )}
      </div>
    </div>
  )
}
