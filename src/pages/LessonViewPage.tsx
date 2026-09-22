import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import type { BoardArrow, BoardHighlight, Puzzle } from '../types/domain'
import { useLesson, usePuzzleMutations, useStudent } from '../lib/queries'
import { lineSteps, stepLabel } from '../lib/solution'
import { pieceList, type Orientation, type SideSetup } from '../lib/fen'
import { useSessionSet } from '../hooks/useSessionSet'
import { useWakeLock } from '../hooks/useWakeLock'
import { useClicker } from '../hooks/useClicker'
import { useSwipeNav } from '../hooks/useSwipeNav'
import { DrawableBoard } from '../components/board/DrawableBoard'
import { MoveBoard } from '../components/board/MoveBoard'
import { effectiveQuizPrompt } from '../lib/prompts'
import { Button, IconButton } from '../components/ui/Button'
import { LoadingPage, Page, SectionLabel } from '../components/ui/Page'
import { PaperCard, StickyNote } from '../components/lesson/Folder'
import { FOLDER_COLORS, onColor } from '../lib/colors'
import { Check, ChevronLeft, ChevronRight, Close, Document, Eye, EyeOff } from '../components/ui/Icons'
import { useHideToggle } from '../hooks/useHideToggle'

type Mode = 'coach' | 'present' | 'learn'

/**
 * The lesson-table views. Coach: everything visible — set-up list, prompt,
 * answer stepper, notes — for the coach's eyes across the board. Present: the
 * student's view, quiz first, answer on reveal. Learn: the board is live and
 * nothing is given away until the line is played out or given up. Same
 * skeleton, different defaults.
 */
export function LessonViewPage({ mode }: { mode: Mode }) {
  const { studentId = '', lessonPlanId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: student } = useStudent(studentId)
  const { data: lesson, isLoading } = useLesson(lessonPlanId)
  useWakeLock()

  const startId = params.get('p')
  // A shared link (solo) shows one position and nothing about whose lesson it
  // is: no student name, no lesson number, no neighbours to swipe to.
  const solo = params.get('solo') === '1'

  const items = useMemo(() => {
    if (!lesson) return []
    const all = lesson.sections.flatMap((section) =>
      (lesson.puzzlesBySection[section.id] ?? []).map((puzzle) => ({ puzzle, sectionTitle: section.title })),
    )
    return solo ? all.filter((it) => it.puzzle.id === startId) : all
  }, [lesson, solo, startId])

  const [index, setIndex] = useState(() => Math.max(0, items.findIndex((i) => i.puzzle.id === startId)))
  const [direction, setDirection] = useState(1)
  const { set: reviewed, toggle: toggleReviewed } = useSessionSet(`reviewed-${lessonPlanId}`)
  // Learn view keeps a tally for the session: solved on the board, or shown.
  const solved = useSessionSet(`learn-solved-${lessonPlanId}`)
  const shown = useSessionSet(`learn-shown-${lessonPlanId}`)
  // The eye in the top bar (or the clicker's third button) hides the notes across positions.
  const [notesHidden, toggleNotes] = useHideToggle()

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
  const exitTo = solo ? '/' : base
  // A sideways swipe anywhere on the screen turns the page, as in Photos.
  const swipe = useSwipeNav((dir) => go(index + dir))

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
    <div className="flex min-h-svh touch-pan-y flex-col bg-bg" {...swipe}>
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-2">
          <IconButton label="Exit" onClick={() => navigate(exitTo)}>
            <Close />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-on-bg">
              {mode === 'coach' ? "Coach's view" : mode === 'learn' ? 'Learn' : 'Presenting'}
              {!solo && (
                <span className="text-on-bg-2">
                  {' '}
                  · {student?.name} · Lesson {lesson.plan.number}
                </span>
              )}
            </p>
          </div>
          {mode === 'learn' && (
            <span className="hidden rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] font-semibold text-ink-2 tabular-nums sm:inline">
              {solved.set.size} solved · {shown.set.size} shown
            </span>
          )}
          {!solo && (
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] font-semibold text-ink-2 tabular-nums">
              {index + 1} / {items.length}
            </span>
          )}
          <IconButton label={notesHidden ? 'Show explanation' : 'Hide explanation'} onClick={toggleNotes}>
            {notesHidden ? <EyeOff /> : <Eye />}
          </IconButton>
          {mode === 'coach' && (
            <Link to={`${base}/sheet`}>
              <IconButton label="Lesson sheet">
                <Document />
              </IconButton>
            </Link>
          )}
        </div>
        <div className={clsx('mx-auto flex max-w-7xl gap-1 px-3 pb-2', solo && 'hidden')}>
          {items.map((it, i) => (
            <button
              key={it.puzzle.id}
              onClick={() => go(i)}
              aria-label={`Position ${i + 1}`}
              className={clsx(
                'h-1.5 flex-1 rounded-full transition',
                i === index
                  ? 'bg-accent'
                  : (mode === 'learn' ? solved.set.has(it.puzzle.id) : reviewed.has(it.puzzle.id))
                    ? 'bg-accent/40'
                    : mode === 'learn' && shown.set.has(it.puzzle.id)
                      ? 'bg-ink-3/50'
                      : 'bg-line-strong',
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
              color={student?.color ?? FOLDER_COLORS[0]}
              onSwipe={(dir) => go(index + dir)}
              onExit={() => navigate(exitTo)}
              onResult={(kind) => (kind === 'solved' ? solved.add : shown.add)(current.puzzle.id)}
              notesHidden={notesHidden}
              onToggleNotes={toggleNotes}
            />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className={clsx('pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-md', solo && 'hidden')}>
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
  color,
  onSwipe,
  onExit,
  onResult,
  notesHidden,
  onToggleNotes,
}: {
  puzzle: Puzzle
  sectionTitle: string
  position: number
  mode: Mode
  /** The student's folder colour: the section tab above the board takes it. */
  color: string
  onSwipe: (dir: 1 | -1) => void
  onExit: () => void
  /** Learn view: the position was solved on the board, or given up. */
  onResult?: (kind: 'solved' | 'shown') => void
  notesHidden: boolean
  onToggleNotes: () => void
}) {
  const { lessonPlanId = '' } = useParams()
  const { update } = usePuzzleMutations(puzzle.id, lessonPlanId)
  const steps = useMemo(() => lineSteps(puzzle), [puzzle])
  const [step, setStep] = useState(0)
  // Right-drag drawings: on the starting position they're saved with the
  // puzzle; mid-line they're a sketch for this step only.
  const [sketch, setSketch] = useState<{ step: number; arrows: BoardArrow[]; highlights: BoardHighlight[] } | null>(null)
  const [revealed, setRevealed] = useState(mode === 'coach')
  // Learn view: the answer stays hidden and the board is live until the line
  // is played out (solved) or given up (shown). Needs a legal recorded line.
  const canSolve = mode === 'learn' && steps.length > 1 && steps.every((s) => s.index === 0 || Boolean(s.from))
  const solving = canSolve && !revealed
  const [outcome, setOutcome] = useState<'solved' | 'shown' | null>(null)
  const [wrong, setWrong] = useState<string | null>(null)
  const [misses, setMisses] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const sideOrientation: Orientation = puzzle.side_to_move === 'b' ? 'black' : 'white'
  const orientation: Orientation = flipped ? (sideOrientation === 'white' ? 'black' : 'white') : sideOrientation
  const current = steps[step]
  const atStart = step === 0
  const list = useMemo(() => pieceList(puzzle.starting_fen), [puzzle.starting_fen])
  const toMove = puzzle.side_to_move === 'w' ? 'White' : 'Black'

  // Answer annotations are hints; the student only sees them once revealed.
  // The eye closed = the quiz alone, whatever the step: start position, no arrows, no moves.
  const showAnnotations = revealed && atStart && !notesHidden
  const sketchHere = sketch && sketch.step === step ? sketch : null
  const boardArrows = showAnnotations
    ? puzzle.arrows
    : [...(current.arrow && revealed && !notesHidden ? [current.arrow] : []), ...(sketchHere?.arrows ?? [])]
  const boardHighlights = showAnnotations ? puzzle.highlights : (sketchHere?.highlights ?? [])
  const setArrows = (arrows: BoardArrow[]) =>
    atStart ? update.mutate({ arrows }) : setSketch({ step, arrows, highlights: sketchHere?.highlights ?? [] })
  const setHighlights = (highlights: BoardHighlight[]) =>
    atStart ? update.mutate({ highlights }) : setSketch({ step, highlights, arrows: sketchHere?.arrows ?? [] })
  const lastMove = !atStart && !notesHidden && current.from && current.to ? { from: current.from, to: current.to } : null

  const last = steps.length - 1
  const finish = (kind: 'solved' | 'shown') => {
    setOutcome(kind)
    onResult?.(kind)
    if (kind === 'shown') {
      setStep(0)
      setRevealed(true)
    }
  }
  const tryMove = (san: string) => {
    if (!solving || outcome) return
    const expected = steps[step + 1]
    if (!expected || !sameMove(san, expected.san ?? '')) {
      setWrong(san)
      setMisses((n) => n + 1)
      return
    }
    setWrong(null)
    const after = step + 1
    setStep(after)
    if (after >= last) return finish('solved')
    // The other side answers after a beat, then it's the solver's move again.
    window.setTimeout(() => {
      setStep(after + 1)
      if (after + 1 >= last) finish('solved')
    }, 550)
  }

  const next = useCallback(() => setStep((s) => Math.min(steps.length - 1, s + 1)), [steps.length])
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), [])

  // One clicker button walks the whole lesson: reveal, each answer move,
  // then the next position. The other button walks it back.
  const atEnd = step === steps.length - 1
  const forward = useCallback(() => {
    if (solving) {
      // While solving, the clicker never gives the answer away: it moves on
      // to the explanation once solved, or to the next position.
      if (outcome === 'solved') {
        setStep(0)
        setRevealed(true)
      } else onSwipe(1)
    } else if (!revealed) setRevealed(true)
    else if (!atEnd) next()
    else onSwipe(1)
  }, [solving, outcome, revealed, atEnd, next, onSwipe])
  const backward = useCallback(() => {
    if (step > 0) prev()
    else onSwipe(-1)
  }, [step, prev, onSwipe])
  useClicker({ next: forward, prev: backward, exit: onExit })

  // Square brackets jump a whole position either way, whatever the step.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === ']') onSwipe(1)
      else if (e.key === '[') onSwipe(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSwipe])

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
      {/* Square board, so cap its width by the viewport height: on an iPad in
          landscape the whole board plus its caption must fit above the nav. */}
      <div className="mx-auto w-full" style={{ maxWidth: 'min(640px, calc(100svh - 236px))' }}>
        <div className="flex items-end justify-between gap-3 pl-3">
          <p
            className="folder-tab flex h-8 min-w-0 items-center gap-2 rounded-t-xl px-3.5 text-[12px] font-bold tracking-[0.08em] uppercase"
            style={{ background: color, color: onColor(color).inkSoft }}
          >
            <span className="block h-2 w-2 shrink-0 rounded-[2px]" style={{ background: onColor(color).dot }} />
            <span className="truncate">{sectionTitle}</span>
          </p>
          <button onClick={() => setFlipped((f) => !f)} className="shrink-0 pb-1.5 text-[13px] font-medium text-on-bg-2 hover:text-on-bg">
            Flip board
          </button>
        </div>
        {solving ? (
          // A live board: a swipe container would fight piece drags, so the
          // board owns its pointer and the page turns from anywhere else.
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: wrong ? [0, -12, 12, -7, 7, 0] : 0 }}
            transition={{ duration: 0.4 }}
            key={misses}
            data-swipe-own
          >
            <MoveBoard fen={current.fen} orientation={orientation} lastMove={lastMove} onMove={tryMove} disabled={Boolean(outcome)} />
          </motion.div>
        ) : (
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, info) => {
            if (info.offset.x < -70 || info.velocity.x < -500) onSwipe(1)
            else if (info.offset.x > 70 || info.velocity.x > 500) onSwipe(-1)
          }}
          className="touch-pan-y"
          data-swipe-own
        >
          <DrawableBoard
            fen={notesHidden ? steps[0].fen : current.fen}
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
        )}
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[15px] font-semibold text-on-bg">
            <span className="text-on-bg-2">#{position}</span>{' '}
            <span className="font-display text-[19px]">{revealed && !notesHidden ? puzzle.label : ''}</span>
          </p>
          <p className="text-[12px] font-semibold tracking-[0.1em] text-on-bg-2 uppercase">{toMove} to play</p>
        </div>
      </div>

      <div className="space-y-3">
        {mode === 'coach' && (
          <StickyNote className="mt-5 lg:mt-6">
            <p className="mb-1 text-[12px] font-bold tracking-[0.12em] uppercase opacity-70">Set up the board</p>
            <PieceLine label="White" pieces={list.white} />
            <PieceLine label="Black" pieces={list.black} />
          </StickyNote>
        )}

        <PaperCard className="p-4" tilt={-0.3}>
          <SectionLabel>Ask</SectionLabel>
          <p className="font-display text-[22px] leading-snug font-medium text-ink">{effectiveQuizPrompt(puzzle, sectionTitle)}</p>
        </PaperCard>

        {solving ? (
          outcome === 'solved' ? (
            <PaperCard className="p-4" tilt={0.4}>
              <div className="flex items-center gap-4">
                <span
                  className="inline-block -rotate-6 rounded-md border-[3px] px-3 py-0.5 font-display text-[22px] font-bold tracking-[0.12em] uppercase"
                  style={{ color: 'var(--stamp-taught)', borderColor: 'var(--stamp-taught)' }}
                >
                  Solved
                </span>
                <p className="text-[15px] text-ink-2">
                  {misses === 0 ? 'First try.' : `${misses} wrong ${misses === 1 ? 'try' : 'tries'} along the way.`}
                </p>
              </div>
              <Button
                variant="primary"
                size="lg"
                block
                className="mt-4"
                icon={<Eye size={20} />}
                onClick={() => {
                  setStep(0)
                  setRevealed(true)
                }}
              >
                Show explanation
              </Button>
            </PaperCard>
          ) : (
            <PaperCard className="p-4" tilt={0.4}>
              <SectionLabel>Your move</SectionLabel>
              <p className="text-[17px] leading-snug text-ink">
                {wrong ? `${wrong}? Not that one, try again.` : step === 0 ? `Play ${toMove}'s move on the board.` : 'Good. Keep going.'}
              </p>
              {step > 0 && (
                <p className="mt-2 font-mono text-[15px] font-semibold text-ink-2">
                  {steps
                    .slice(1, step + 1)
                    .map((s) => `${stepLabel(puzzle, s.index)} ${s.san}`)
                    .join('  ')}
                </p>
              )}
              <button onClick={() => finish('shown')} className="mt-3 text-[13px] font-medium text-ink-3 hover:text-ink">
                Show me the answer
              </button>
            </PaperCard>
          )
        ) : !revealed ? (
          <Button variant="primary" size="lg" block icon={<Eye size={20} />} onClick={() => setRevealed(true)}>
            Reveal answer
          </Button>
        ) : notesHidden ? (
          <PaperCard className="p-4" tilt={0.4}>
            <div className="flex items-center justify-between">
              <SectionLabel className="mb-0">Answer</SectionLabel>
              <IconButton label="Show answer and explanation" onClick={onToggleNotes} className="-mr-2">
                <EyeOff />
              </IconButton>
            </div>
            <p className="text-[14px] text-ink-3">Answer and explanation hidden. Tap the eye, or the clicker's third button, to show them.</p>
          </PaperCard>
        ) : (
          <PaperCard className="p-4" tilt={0.4}>
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
                {current.comment && !notesHidden && <p className="mt-3 text-[15px] leading-relaxed text-ink">{current.comment}</p>}
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
          </PaperCard>
        )}

        {revealed && puzzle.summary && !notesHidden && (
          <PaperCard className="p-4" ruled tilt={-0.4}>
            <div className="flex items-center justify-between">
              <SectionLabel className="mb-0">{mode === 'coach' ? 'Your notes' : 'Explanation'}</SectionLabel>
              <IconButton label={notesHidden ? 'Show explanation' : 'Hide explanation'} onClick={onToggleNotes} className="-mr-2">
                {notesHidden ? <EyeOff /> : <Eye />}
              </IconButton>
            </div>
            {notesHidden ? (
              <p className="text-[14px] text-ink-3">Hidden. Tap the eye, or the clicker's third button, to show it.</p>
            ) : (
              <p className="mt-1 text-[16px] leading-[28px] whitespace-pre-wrap text-ink">{puzzle.summary}</p>
            )}
          </PaperCard>
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

/** "Nf4+" and "Nf4" are the same move; so are O-O and 0-0. */
function sameMove(a: string, b: string) {
  const norm = (s: string) => s.replace(/[+#!?]/g, '').replace(/0/g, 'O').trim()
  return norm(a) === norm(b)
}

/** One side's set-up: the pieces on one line, the pawns on the next, so it reads like a real call-out. */
function PieceLine({ label, pieces }: { label: string; pieces: SideSetup }) {
  return (
    <div className="flex items-baseline gap-2 py-1 text-[17px] leading-relaxed">
      <span className="w-12 shrink-0 text-[13px] font-semibold uppercase opacity-60">{label}</span>
      <div className="min-w-0">
        <p className="font-mono font-semibold tracking-wide">{pieces.pieces.length ? pieces.pieces.join('  ') : '—'}</p>
        <p className="font-mono font-medium tracking-wide opacity-80">
          <span className="mr-2 text-[12px] font-semibold uppercase opacity-70">Pawns</span>
          {pieces.pawns.length ? pieces.pawns.join('  ') : 'none'}
        </p>
      </div>
    </div>
  )
}
