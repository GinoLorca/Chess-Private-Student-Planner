import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import type { BoardArrow, BoardHighlight, Puzzle } from '../types/domain'
import { useLesson, usePuzzleMutations, useStudent } from '../lib/queries'
import { lineSteps, stepLabel } from '../lib/solution'
import { pieceList, type Orientation } from '../lib/fen'
import { useSessionSet } from '../hooks/useSessionSet'
import { useWakeLock } from '../hooks/useWakeLock'
import { DrawableBoard } from '../components/board/DrawableBoard'
import { effectiveQuizPrompt } from '../lib/prompts'
import { Button, IconButton } from '../components/ui/Button'
import { LoadingPage, Page, SectionLabel } from '../components/ui/Page'
import { Check, ChevronLeft, ChevronRight, Close, Document, Eye } from '../components/ui/Icons'

type Mode = 'coach' | 'present'

/**
 * The two lesson-table views. Coach: everything visible — set-up list, prompt,
 * answer stepper, notes — for the coach's eyes across the board. Present: the
 * student's view, quiz first, answer on reveal. Same skeleton, different defaults.
 */
export function LessonViewPage({ mode }: { mode: Mode }) {
  const { studentId = '', lessonPlanId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: student } = useStudent(studentId)
  const { data: lesson, isLoading } = useLesson(lessonPlanId)
  useWakeLock()

  const items = useMemo(() => {
    if (!lesson) return []
    return lesson.sections.flatMap((section) =>
      (lesson.puzzlesBySection[section.id] ?? []).map((puzzle) => ({ puzzle, sectionTitle: section.title })),
    )
  }, [lesson])

  const startId = params.get('p')
  const [index, setIndex] = useState(() => Math.max(0, items.findIndex((i) => i.puzzle.id === startId)))
  const [direction, setDirection] = useState(1)
  const { set: reviewed, toggle: toggleReviewed } = useSessionSet(`reviewed-${lessonPlanId}`)

  // Once the lesson loads, land on the requested puzzle (deep link from a position page).
  useEffect(() => {
    if (!startId || items.length === 0) return
    const i = items.findIndex((it) => it.puzzle.id === startId)
    if (i >= 0) setIndex(i)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= items.length) return
      setDirection(next > index ? 1 : -1)
      setIndex(next)
      setParams({ p: items[next].puzzle.id }, { replace: true })
    },
    [index, items, setParams],
  )

  const base = `/students/${studentId}/lessons/${lessonPlanId}`

  if (isLoading && !lesson) return <LoadingPage />
  if (!lesson || items.length === 0) {
    return (
      <Page back={base} title="Nothing to show yet">
        <p className="text-ink-2">Add a position to this lesson first.</p>
      </Page>
    )
  }

  const current = items[Math.min(index, items.length - 1)]

  return (
    <div className="flex min-h-svh flex-col bg-bg">
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-2">
          <IconButton label="Exit" onClick={() => navigate(base)}>
            <Close />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">
              {mode === 'coach' ? "Coach's view" : 'Presenting'}
              <span className="text-ink-3"> · {student?.name} · Lesson {lesson.plan.number}</span>
            </p>
          </div>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] font-semibold text-ink-2 tabular-nums">
            {index + 1} / {items.length}
          </span>
          {mode === 'coach' && (
            <Link to={`${base}/sheet`}>
              <IconButton label="Lesson sheet">
                <Document />
              </IconButton>
            </Link>
          )}
        </div>
        <div className="mx-auto flex max-w-7xl gap-1 px-3 pb-2">
          {items.map((it, i) => (
            <button
              key={it.puzzle.id}
              onClick={() => go(i)}
              aria-label={`Position ${i + 1}`}
              className={clsx(
                'h-1.5 flex-1 rounded-full transition',
                i === index ? 'bg-accent' : reviewed.has(it.puzzle.id) ? 'bg-accent/40' : 'bg-line-strong',
              )}
            />
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-3 pb-28">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={`${mode}-${current.puzzle.id}`}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.18 }}
          >
            <PuzzleView
              key={`${mode}-${current.puzzle.id}`}
              puzzle={current.puzzle}
              sectionTitle={current.sectionTitle}
              position={index + 1}
              mode={mode}
              onSwipe={(dir) => go(index + dir)}
            />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2">
          <Button variant="secondary" icon={<ChevronLeft size={18} />} onClick={() => go(index - 1)} disabled={index === 0}>
            Previous
          </Button>
          <div className="flex-1" />
          {mode === 'coach' && (
            <Button
              variant={reviewed.has(current.puzzle.id) ? 'soft' : 'ghost'}
              icon={<Check size={18} />}
              onClick={() => toggleReviewed(current.puzzle.id)}
            >
              {reviewed.has(current.puzzle.id) ? 'Reviewed' : 'Mark reviewed'}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="primary" onClick={() => go(index + 1)} disabled={index === items.length - 1}>
            Next
            <ChevronRight size={18} />
          </Button>
        </div>
      </nav>
    </div>
  )
}

function PuzzleView({
  puzzle,
  sectionTitle,
  position,
  mode,
  onSwipe,
}: {
  puzzle: Puzzle
  sectionTitle: string
  position: number
  mode: Mode
  onSwipe: (dir: 1 | -1) => void
}) {
  const { lessonPlanId = '' } = useParams()
  const { update } = usePuzzleMutations(puzzle.id, lessonPlanId)
  const steps = useMemo(() => lineSteps(puzzle), [puzzle])
  const [step, setStep] = useState(0)
  // Right-drag drawings: on the starting position they're saved with the
  // puzzle; mid-line they're a sketch for this step only.
  const [sketch, setSketch] = useState<{ step: number; arrows: BoardArrow[]; highlights: BoardHighlight[] } | null>(null)
  const [revealed, setRevealed] = useState(mode === 'coach')
  const [flipped, setFlipped] = useState(false)
  const sideOrientation: Orientation = puzzle.side_to_move === 'b' ? 'black' : 'white'
  const orientation: Orientation = flipped ? (sideOrientation === 'white' ? 'black' : 'white') : sideOrientation
  const current = steps[step]
  const atStart = step === 0
  const list = useMemo(() => pieceList(puzzle.starting_fen), [puzzle.starting_fen])
  const toMove = puzzle.side_to_move === 'w' ? 'White' : 'Black'

  // Answer annotations are hints; the student only sees them once revealed.
  const showAnnotations = revealed && atStart
  const sketchHere = sketch && sketch.step === step ? sketch : null
  const boardArrows = showAnnotations
    ? puzzle.arrows
    : [...(current.arrow && revealed ? [current.arrow] : []), ...(sketchHere?.arrows ?? [])]
  const boardHighlights = showAnnotations ? puzzle.highlights : (sketchHere?.highlights ?? [])
  const setArrows = (arrows: BoardArrow[]) =>
    atStart ? update.mutate({ arrows }) : setSketch({ step, arrows, highlights: sketchHere?.highlights ?? [] })
  const setHighlights = (highlights: BoardHighlight[]) =>
    atStart ? update.mutate({ highlights }) : setSketch({ step, highlights, arrows: sketchHere?.arrows ?? [] })
  const lastMove = !atStart && current.from && current.to ? { from: current.from, to: current.to } : null

  const next = useCallback(() => setStep((s) => Math.min(steps.length - 1, s + 1)), [steps.length])
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        if (!revealed) setRevealed(true)
        else next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === ']') onSwipe(1)
      else if (e.key === '[') onSwipe(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onSwipe, revealed])

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
      {/* Square board, so cap its width by the viewport height: on an iPad in
          landscape the whole board plus its caption must fit above the nav. */}
      <div className="mx-auto w-full" style={{ maxWidth: 'min(640px, calc(100svh - 236px))' }}>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-[13px] font-semibold tracking-wider text-accent-strong uppercase">
            {sectionTitle}
          </p>
          <button onClick={() => setFlipped((f) => !f)} className="shrink-0 text-[13px] font-medium text-ink-3 hover:text-ink">
            Flip board
          </button>
        </div>
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, info) => {
            if (info.offset.x < -70 || info.velocity.x < -500) onSwipe(1)
            else if (info.offset.x > 70 || info.velocity.x > 500) onSwipe(-1)
          }}
          className="touch-pan-y"
        >
          <DrawableBoard
            fen={current.fen}
            orientation={orientation}
            arrows={boardArrows}
            highlights={boardHighlights}
            lastMove={lastMove}
            onArrowsChange={setArrows}
            onHighlightsChange={setHighlights}
            onClick={() => (revealed ? next() : undefined)}
            className="shadow-float"
          />
        </motion.div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[15px] font-semibold text-ink">
            <span className="text-ink-3">#{position}</span> {revealed ? puzzle.label : ''}
          </p>
          <p className="text-[15px] font-semibold text-ink-2">{toMove} to play</p>
        </div>
      </div>

      <div className="space-y-3">
        {mode === 'coach' && (
          <section className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <SectionLabel>Set up the board</SectionLabel>
            <PieceLine label="White" pieces={list.white} />
            <PieceLine label="Black" pieces={list.black} />
          </section>
        )}

        <section className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <SectionLabel>Ask</SectionLabel>
          <p className="text-[18px] leading-snug font-medium text-ink">{effectiveQuizPrompt(puzzle, sectionTitle)}</p>
        </section>

        {!revealed ? (
          <Button variant="primary" size="lg" block icon={<Eye size={20} />} onClick={() => setRevealed(true)}>
            Reveal answer
          </Button>
        ) : (
          <section className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between">
              <SectionLabel className="mb-0">Answer</SectionLabel>
              {step > 0 && (
                <button onClick={() => setStep(0)} className="text-[13px] font-medium text-ink-3 hover:text-ink">
                  Reset
                </button>
              )}
            </div>
            {steps.length === 1 ? (
              <p className="mt-2 text-[15px] text-ink-3">No answer recorded.</p>
            ) : (
              <>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {steps.slice(1).map((s) => (
                    <button
                      key={s.index}
                      onClick={() => setStep(s.index)}
                      className={clsx(
                        'h-10 rounded-xl px-3 font-mono text-[16px] font-semibold transition',
                        s.index === step
                          ? 'bg-accent text-accent-ink'
                          : s.index < step
                            ? 'bg-surface-2 text-ink-3'
                            : 'bg-surface-2 text-ink hover:bg-surface-3',
                      )}
                    >
                      <span className="mr-1 text-[12px] font-normal opacity-70">{stepLabel(puzzle, s.index)}</span>
                      {s.san}
                    </button>
                  ))}
                </div>
                {current.comment && <p className="mt-3 text-[15px] leading-relaxed text-ink">{current.comment}</p>}
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" size="md" onClick={prev} disabled={atStart} icon={<ChevronLeft size={18} />}>
                    Back
                  </Button>
                  <Button
                    variant="soft"
                    size="md"
                    className="flex-1"
                    onClick={next}
                    disabled={step === steps.length - 1}
                  >
                    {atStart ? 'Play first move' : step === steps.length - 1 ? 'End of line' : 'Next move'}
                    <ChevronRight size={18} />
                  </Button>
                </div>
              </>
            )}
          </section>
        )}

        {revealed && puzzle.summary && (
          <section className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <SectionLabel>{mode === 'coach' ? 'Your notes' : 'Explanation'}</SectionLabel>
            <p className="text-[16px] leading-relaxed whitespace-pre-wrap text-ink">{puzzle.summary}</p>
          </section>
        )}

        {mode === 'coach' && puzzle.reference_url && (
          <a
            href={puzzle.reference_url}
            target="_blank"
            rel="noreferrer"
            className="block px-1 text-[13px] font-medium text-accent underline-offset-2 hover:underline"
          >
            {puzzle.reference_label || puzzle.reference_url} ↗
          </a>
        )}
      </div>
    </div>
  )
}

function PieceLine({ label, pieces }: { label: string; pieces: string[] }) {
  return (
    <p className="flex items-baseline gap-2 py-0.5 text-[17px] leading-relaxed">
      <span className="w-12 shrink-0 text-[13px] font-semibold text-ink-3 uppercase">{label}</span>
      <span className="font-mono font-semibold tracking-wide text-ink">{pieces.length ? pieces.join('  ') : '—'}</span>
    </p>
  )
}
