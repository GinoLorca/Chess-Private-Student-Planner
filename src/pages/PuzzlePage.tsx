import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { useLesson, usePuzzle, usePuzzleMutations, useStudent } from '../lib/queries'
import { normalizeFen } from '../lib/fen'
import { lineSteps, stepLabel } from '../lib/solution'
import { useClicker } from '../hooks/useClicker'
import { Page, Card, LoadingPage, SectionLabel } from '../components/ui/Page'
import { effectiveQuizPrompt } from '../lib/prompts'
import { penHint } from '../lib/pens'
import { CopyLinkButton } from '../components/ui/CopyLink'
import { Button, IconButton } from '../components/ui/Button'
import { DrawableBoard } from '../components/board/DrawableBoard'
import { ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, Play } from '../components/ui/Icons'
import { useHideToggle } from '../hooks/useHideToggle'

/**
 * The read view of one position: what the coach glances at right before a
 * lesson. Everything is visible at once — no reveal step — because this is
 * for the coach's eyes, not the student's. The board steps through the
 * answer: click it, click a move, or use the clicker / arrow keys.
 */
export function PuzzlePage() {
  const { studentId = '', lessonPlanId = '', puzzleId = '' } = useParams()
  const { data: student } = useStudent(studentId)
  const { data: lesson } = useLesson(lessonPlanId)
  const { data: puzzle, isLoading } = usePuzzle(puzzleId)
  const { update } = usePuzzleMutations(puzzleId, lessonPlanId)

  const steps = useMemo(() => (puzzle ? lineSteps(puzzle) : []), [puzzle])
  const [step, setStep] = useState(0)
  const last = Math.max(0, steps.length - 1)
  const next = useCallback(() => setStep((s) => Math.min(last, s + 1)), [last])
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), [])
  useClicker({ next, prev })
  // The eye (or the clicker's third button) hides the explanation and move notes.
  const [hidden, toggleHidden] = useHideToggle()

  if (isLoading && !puzzle) return <LoadingPage />
  const base = `/students/${studentId}/lessons/${lessonPlanId}`
  if (!puzzle) return <Page back={base}>Position not found.</Page>

  const section = lesson?.sections.find((s) => s.id === puzzle.section_id)
  const fen = normalizeFen(puzzle.starting_fen, puzzle.side_to_move)
  const toMove = puzzle.side_to_move === 'w' ? 'White' : 'Black'
  const current = steps[Math.min(step, last)]
  const atStart = step === 0
  const lastMove = !atStart && current?.from && current?.to ? { from: current.from, to: current.to } : null

  return (
    <Page
      back={base}
      eyebrow={[student?.name, lesson ? `Lesson ${lesson.plan.number}` : null, section?.title].filter(Boolean).join(' · ')}
      width="full"
      actions={
        <>
          <CopyLinkButton puzzleId={puzzle.id} />
          <Link to={`${base}/coach?p=${puzzle.id}`}>
            <Button variant="ghost" size="sm" icon={<Play size={16} />}>
              Coach view
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
      {/* Desktop (a mouse or trackpad, wide window) gets a board about a third larger; iPad and iPhone keep their layout. */}
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start pointer-fine:min-[1280px]:max-w-[1300px] pointer-fine:min-[1280px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[560px] pointer-fine:min-[1280px]:max-w-[665px]">
          {/* The title sits on its own paper strip so it reads on any skin's background. */}
          <div className="mb-2 flex items-baseline justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-card">
            <h1 className="min-w-0 truncate text-[24px] font-bold tracking-tight text-ink">{puzzle.label || 'Untitled position'}</h1>
            <span className="shrink-0 text-[14px] font-semibold text-ink-2">{toMove} to play</span>
          </div>
          {/* The starting position carries the saved annotations; each answer
              move shows its own arrow. Drawings are saved only on the start. */}
          <DrawableBoard
            fen={atStart || !current ? fen : current.fen}
            arrows={atStart ? puzzle.arrows : current?.arrow ? [current.arrow] : []}
            highlights={atStart ? puzzle.highlights : []}
            lastMove={lastMove}
            orientation={puzzle.side_to_move === 'b' ? 'black' : 'white'}
            onArrowsChange={(arrows) => atStart && update.mutate({ arrows })}
            onHighlightsChange={(highlights) => atStart && update.mutate({ highlights })}
            onClick={last > 0 ? next : undefined}
          />
          {last > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <Button variant="secondary" size="md" icon={<ChevronLeft size={18} />} onClick={prev} disabled={atStart}>
                Back
              </Button>
              <p className="flex-1 text-center font-mono text-[15px] font-semibold text-on-bg">
                {atStart ? 'Start' : `${stepLabel(puzzle, step)} ${current?.san ?? ''}`}
                <span className="ml-2 font-sans text-[12px] font-medium text-on-bg-2 tabular-nums">
                  {step} / {last}
                </span>
              </p>
              <Button variant="soft" size="md" onClick={next} disabled={step >= last}>
                {atStart ? 'Play first move' : step >= last ? 'End of line' : 'Next move'}
                <ChevronRight size={18} />
              </Button>
            </div>
          )}
          <p className="mt-2 text-[12.5px] text-on-bg-2">
            {last > 0 ? 'Click the board, a move, or the clicker (arrow keys) to step through the answer. ' : ''}
            Right-drag for an arrow, right-click a square to highlight it, left-click to clear. Hold {penHint()}.
          </p>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionLabel>Quiz prompt</SectionLabel>
            <p className="text-[17px] leading-snug font-medium text-ink">{effectiveQuizPrompt(puzzle, section?.title)}</p>
          </Card>

          <Card className="p-4">
            <SectionLabel>Answer</SectionLabel>
            {puzzle.solution.length === 0 ? (
              <p className="text-[15px] text-ink-3">No solution recorded yet.</p>
            ) : (
              <ol className="-mx-2 space-y-0.5">
                {puzzle.solution.map((move, i) => (
                  <li key={i}>
                    <button
                      onClick={() => setStep(i + 1)}
                      aria-current={step === i + 1 ? 'step' : undefined}
                      className={clsx(
                        'flex w-full items-baseline gap-3 rounded-lg px-2 py-1 text-left transition',
                        step === i + 1 ? 'bg-accent-soft' : 'hover:bg-surface-2',
                      )}
                    >
                      <span className="w-8 shrink-0 text-right font-mono text-[13px] text-ink-3 tabular-nums">{stepLabel(puzzle, i + 1)}</span>
                      <span className="font-mono text-[17px] font-semibold text-ink">{move.san}</span>
                      {move.comment && !hidden && <span className="text-[14px] text-ink-2">{move.comment}</span>}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {(puzzle.summary || puzzle.solution.some((m) => m.comment)) && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <SectionLabel className="mb-0">Explanation</SectionLabel>
                <IconButton label={hidden ? 'Show explanation' : 'Hide explanation'} onClick={toggleHidden} className="-mr-2">
                  {hidden ? <EyeOff /> : <Eye />}
                </IconButton>
              </div>
              {hidden ? (
                <p className="mt-1 text-[14px] text-ink-3">Hidden. Tap the eye, or the clicker's third button, to show it.</p>
              ) : (
                puzzle.summary && <p className="mt-2 text-[16px] leading-relaxed whitespace-pre-wrap text-ink">{puzzle.summary}</p>
              )}
            </Card>
          )}

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
