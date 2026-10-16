import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import clsx from 'clsx'
import type { BoardArrow, BoardHighlight } from '../types/domain'
import { useLesson, usePuzzle, usePuzzleMutations, useStudent } from '../lib/queries'
import { normalizeFen } from '../lib/fen'
import { lineSteps, stepLabel } from '../lib/solution'
import { useClicker } from '../hooks/useClicker'
import { Page, Card, LoadingPage, SectionLabel } from '../components/ui/Page'
import { effectiveQuizPrompt } from '../lib/prompts'
import { CopyLinkButton } from '../components/ui/CopyLink'
import { Button, IconButton } from '../components/ui/Button'
import { DrawableBoard } from '../components/board/DrawableBoard'
import { SolveBoardView, SolveStatus } from '../components/board/SolveBoard'
import { useSolve } from '../hooks/useSolve'
import { ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, Play, Target } from '../components/ui/Icons'
import { analysisHref } from '../lib/analysisLink'
import { useHideToggle } from '../hooks/useHideToggle'
import { opposite, useFlip } from '../hooks/useFlip'
import { useResumeState } from '../lib/resume'
import { MyNotes } from '../components/lesson/MyNotes'
import { findMentions } from '../lib/moveMentions'
import { useMoveDemo } from '../hooks/useMoveDemo'
import { LineBar, MoveText } from '../components/lesson/MoveText'

/**
 * One position. It opens with the eye closed: the answer and explanation
 * hidden and the board live, to be solved. Open the eye (or solve it) and
 * everything shows; the board then steps through the answer: click it,
 * click a move, or use the clicker / arrow keys.
 */
export function PuzzlePage() {
  const { studentId = '', lessonPlanId = '', puzzleId = '' } = useParams()
  const location = useLocation()
  const { data: student } = useStudent(studentId)
  const { data: lesson } = useLesson(lessonPlanId)
  const { data: puzzle, isLoading } = usePuzzle(puzzleId)
  const { update } = usePuzzleMutations(puzzleId, lessonPlanId)

  const steps = useMemo(() => (puzzle ? lineSteps(puzzle) : []), [puzzle])
  // The moves and squares named in the explanation and the answer's comments, to show on the board.
  const mentions = useMemo(
    () =>
      puzzle
        ? findMentions(puzzle, [{ text: puzzle.summary, at: 0 }, ...puzzle.solution.map((m, i) => ({ text: m.comment ?? '', at: i + 1 }))])
        : [],
    [puzzle],
  )
  // The move the answer is stepped to, the eye and the flip come back as
  // they were if iOS closes the app while this position is open.
  const [step, setStep] = useResumeState(`pos:${puzzleId}:step`, 0)
  const last = Math.max(0, steps.length - 1)
  const next = useCallback(() => setStep((s) => Math.min(last, s + 1)), [last, setStep])
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), [setStep])
  // The eye hides the answer and explanation: tap it, long-press a clicker button, or press B.
  const [hidden, toggleHidden, setHidden] = useHideToggle(true, `pos:${puzzleId}:eye`)
  // Each position opens with the eye closed: the answer hidden, the board ready to solve.
  const [openedId, setOpenedId] = useState(puzzleId)
  if (openedId !== puzzleId) {
    setOpenedId(puzzleId)
    setHidden(true)
    setStep(0)
  }
  // With the answer hidden the board is live, to play the line out; solving
  // it brings the answer back, at the move the line was played to.
  const solve = useSolve(steps, puzzleId, (at) => {
    setStep(at)
    setHidden(false)
  })
  const boardRef = useRef<HTMLDivElement>(null)
  const demo = useMoveDemo({
    start: puzzle ? normalizeFen(puzzle.starting_fen, puzzle.side_to_move) : '',
    step,
    setStep,
    boardRef,
    reset: `${puzzleId}:${hidden}`,
  })
  // While a side line from the text is up, the clicker and arrow keys walk it.
  const { forward: demoForward, back: demoBack } = demo
  const stepForward = useCallback(() => demoForward() || next(), [demoForward, next])
  const stepBack = useCallback(() => demoBack() || prev(), [demoBack, prev])
  useClicker({ next: stepForward, prev: stepBack, hold: toggleHidden })
  const [flipped] = useFlip(`pos:${puzzleId}:flip`)
  // Marks drawn on the starting position are saved with it; on a move of
  // the answer they're a sketch for that move, gone when the board moves on.
  const [sketch, setSketch] = useState<{ at: string; arrows: BoardArrow[]; highlights: BoardHighlight[] }>({ at: '', arrows: [], highlights: [] })

  if (isLoading && !puzzle) return <LoadingPage />
  const base = `/students/${studentId}/lessons/${lessonPlanId}`
  if (!puzzle) return <Page back={base}>Position not found.</Page>

  const section = lesson?.sections.find((s) => s.id === puzzle.section_id)
  const fen = normalizeFen(puzzle.starting_fen, puzzle.side_to_move)
  const toMove = puzzle.side_to_move === 'w' ? 'White' : 'Black'
  const sideView = puzzle.side_to_move === 'b' ? 'black' : 'white'
  const orientation = flipped ? opposite(sideView) : sideView
  // Hidden = the quiz alone: the start position, no answer arrows, no moves, no label.
  const shownStep = hidden ? 0 : step
  const current = steps[Math.min(shownStep, last)]
  const atStart = shownStep === 0
  const lastMove = !atStart && current?.from && current?.to ? { from: current.from, to: current.to } : null
  // A side line or threat from the text, up in place of the answer.
  const showing = hidden ? null : demo.view
  // Drawings on the starting position are saved with it; anything else is a sketch.
  const editable = atStart && !showing
  const sketchAt = `${puzzle.id}:${showing ? showing.key : shownStep}`
  const here = sketch.at === sketchAt ? sketch : { at: sketchAt, arrows: [], highlights: [] }
  const moveArrow = !atStart && current?.arrow ? current.arrow : null
  const shownArrows = showing ? showing.arrows : moveArrow ? [moveArrow] : []
  const mark = demo.mark
  const unmarked = (list: BoardHighlight[]) => list.filter((h) => !(mark && h.square === mark.square && h.color === mark.color))

  return (
    <Page
      back={base}
      eyebrow={[student?.name, lesson ? `Lesson ${lesson.plan.number}` : null, section?.title].filter(Boolean).join(' · ')}
      width="full"
      actions={
        <>
          <IconButton label={hidden ? 'Show answer and explanation' : 'Hide answer and explanation'} onClick={toggleHidden}>
            {hidden ? <EyeOff /> : <Eye />}
          </IconButton>
          <CopyLinkButton puzzleId={puzzle.id} />
          {/* The position as the student sees it, on Repertoire Lab's analysis board, with its line to step through. */}
          <Link
            to={analysisHref({
              fen,
              orientation,
              back: location.pathname + location.search,
              title: hidden ? '' : puzzle.label,
              line: puzzle.solution.map((m) => m.san),
            })}
          >
            {/* Icons alone on a phone, so the top bar fits. */}
            <Button variant="ghost" size="sm" icon={<Target size={16} />} aria-label="Analyze" title="Analyze">
              <span className="hidden sm:inline">Analyze</span>
            </Button>
          </Link>
          <Link to={`${base}/coach?p=${puzzle.id}`}>
            <Button variant="ghost" size="sm" icon={<Play size={16} />} aria-label="Coach view" title="Coach view">
              <span className="hidden sm:inline">Coach view</span>
            </Button>
          </Link>
          <Link to={`${base}/puzzles/${puzzle.id}/edit`}>
            <Button variant="primary" size="sm" icon={<Pencil size={16} />}>
              Edit
            </Button>
          </Link>
        </>
      }
    >
      {/* iPad and iPhone get the larger board. A Mac (a mouse or trackpad) keeps its own sizes, larger in a wide window, and never
          taller than the window, so the whole board is always in view. */}
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start pointer-fine:lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] pointer-fine:min-[1280px]:max-w-[1300px] pointer-fine:min-[1280px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="mx-auto w-full min-w-0 max-w-[644px] pointer-fine:max-w-[min(560px,calc(100svh-190px))] pointer-fine:min-[1280px]:max-w-[min(665px,calc(100svh-190px))]">
          {/* The title sits on its own paper strip so it reads on any skin's background. */}
          <div className="mb-2 flex items-baseline justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-card">
            <h1 className="min-w-0 truncate text-[24px] font-bold tracking-tight text-ink">{hidden ? 'Position' : puzzle.label || 'Untitled position'}</h1>
            <span className="shrink-0 text-[14px] font-semibold text-ink-2">{toMove} to play</span>
          </div>
          {/* The starting position carries the saved annotations; each answer
              move shows its own arrow. Drawings are saved only on the start. */}
          <div ref={boardRef}>
          {hidden ? (
            // The answer hidden, the board is live: play the line out.
            <SolveBoardView solve={solve} orientation={orientation} />
          ) : (
            <DrawableBoard
              fen={showing ? showing.fen : atStart || !current ? fen : current.fen}
              arrows={editable ? puzzle.arrows : [...shownArrows, ...here.arrows]}
              highlights={[...(editable ? puzzle.highlights : here.highlights), ...(mark ? [mark] : [])]}
              lastMove={showing ? showing.lastMove : lastMove}
              orientation={orientation}
              onArrowsChange={(arrows) =>
                // The move's own arrow is shown, not drawn: it stays out of the sketch.
                editable ? update.mutate({ arrows }) : setSketch({ ...here, arrows: arrows.filter((a) => !shownArrows.includes(a)) })
              }
              onHighlightsChange={(highlights) =>
                editable ? update.mutate({ highlights: unmarked(highlights) }) : setSketch({ ...here, highlights: unmarked(highlights) })
              }
              sketch={!editable}
              onClick={showing ? stepForward : last > 0 ? next : undefined}
            />
          )}
          </div>
          {showing ? (
            <LineBar demo={demo} puzzle={puzzle} className="mt-3" />
          ) : last > 0 && !hidden && (
            <div className="mt-3 flex items-center gap-2">
              <Button variant="secondary" size="md" icon={<ChevronLeft size={18} />} onClick={prev} disabled={atStart}>
                Back
              </Button>
              <p className="min-w-0 flex-1 truncate text-center font-mono text-[15px] font-semibold whitespace-nowrap text-on-bg">
                {atStart ? 'Start' : `${stepLabel(puzzle, shownStep)} ${current?.san ?? ''}`}
                <span className="ml-2 font-sans text-[12px] font-medium whitespace-nowrap text-on-bg-2 tabular-nums">
                  {shownStep} / {last}
                </span>
              </p>
              <Button variant="soft" size="md" onClick={next} disabled={shownStep >= last}>
                {atStart ? 'Play first move' : shownStep >= last ? 'End of line' : 'Next move'}
                <ChevronRight size={18} />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionLabel>Quiz prompt</SectionLabel>
            <p className="text-[17px] leading-snug font-medium text-ink">{effectiveQuizPrompt(puzzle, section?.title)}</p>
          </Card>

          <Card className="p-4">
            <SectionLabel>Answer</SectionLabel>
            {hidden ? (
              solve.step > 0 || solve.misses > 0 ? (
                <SolveStatus solve={solve} label={(i) => stepLabel(puzzle, i)} onReveal={toggleHidden} />
              ) : (
                <p className="text-[14px] text-ink-3">Hidden with the explanation.</p>
              )
            ) : puzzle.solution.length === 0 ? (
              <p className="text-[15px] text-ink-3">No solution recorded yet.</p>
            ) : (
              <ol className="-mx-2 space-y-0.5">
                {puzzle.solution.map((move, i) => {
                  const on = step === i + 1 && !showing
                  return (
                    // The whole row steps the answer there; moves named in its comment sit above that.
                    <li
                      key={i}
                      className={clsx('relative flex items-baseline gap-3 rounded-lg px-2 py-1 transition', on ? 'bg-accent-soft' : 'hover:bg-surface-2')}
                    >
                      <button
                        onClick={() => {
                          demo.close()
                          setStep(i + 1)
                        }}
                        aria-current={on ? 'step' : undefined}
                        className="flex shrink-0 items-baseline gap-3 text-left after:absolute after:inset-0 after:rounded-lg"
                      >
                        <span className="w-8 shrink-0 text-right font-mono text-[13px] text-ink-3 tabular-nums">{stepLabel(puzzle, i + 1)}</span>
                        <span className="font-mono text-[17px] font-semibold text-ink">{move.san}</span>
                      </button>
                      {move.comment && !hidden && (
                        <span className="text-[14px] text-ink-2">
                          <MoveText text={move.comment} mentions={mentions[i + 1] ?? []} demo={demo} />
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
          </Card>

          {(hidden || puzzle.summary || puzzle.solution.some((m) => m.comment)) && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <SectionLabel className="mb-0">Explanation</SectionLabel>
                <IconButton label={hidden ? 'Show explanation' : 'Hide explanation'} onClick={toggleHidden} className="-mr-2">
                  {hidden ? <EyeOff /> : <Eye />}
                </IconButton>
              </div>
              {hidden ? (
                <p className="mt-1 text-[14px] text-ink-3">Answer and explanation hidden.</p>
              ) : (
                puzzle.summary && (
                  <p className="mt-2 text-[16px] leading-relaxed whitespace-pre-wrap text-ink">
                    <MoveText text={puzzle.summary} mentions={mentions[0] ?? []} demo={demo} />
                  </p>
                )
              )}
            </Card>
          )}

          <Card className="p-4">
            <MyNotes key={puzzle.id} puzzle={puzzle} lessonPlanId={lessonPlanId} hidden={hidden} />
          </Card>

          {puzzle.reference_url && (
            <a
              href={puzzle.reference_url}
              target="_blank"
              rel="noreferrer"
              className="block text-[14px] font-medium text-accent-on-bg underline-offset-2 hover:underline"
            >
              {puzzle.reference_label || puzzle.reference_url} ↗
            </a>
          )}
        </div>
      </div>
    </Page>
  )
}
