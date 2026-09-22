import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import type { Puzzle, SolutionMove } from '../types/domain'
import type { PuzzlePatch } from '../lib/data'
import { useLesson, usePuzzleMutations, useStudent } from '../lib/queries'
import { normalizeFen } from '../lib/fen'
import { defaultQuizPrompt } from '../lib/prompts'
import { FOLDER_COLORS } from '../lib/colors'
import { Board } from '../components/board/Board'
import { MoveBoard } from '../components/board/MoveBoard'
import { PaperCard } from '../components/lesson/Folder'
import { Button, IconButton } from '../components/ui/Button'
import { LoadingPage, Page, SectionLabel } from '../components/ui/Page'
import { Check, ChevronRight, Close } from '../components/ui/Icons'

/**
 * The annotation workbench: one position at a time, the rest queued on the
 * right. Play the answer on the board, right-drag arrows, write the question
 * and the note, then "Save, done" stamps it and brings up the next one.
 */
export function AnnotatePage() {
  const { studentId = '', lessonPlanId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: student } = useStudent(studentId)
  const { data: lesson, isLoading } = useLesson(lessonPlanId)
  const base = `/students/${studentId}/lessons/${lessonPlanId}`

  const items = useMemo(
    () =>
      lesson
        ? lesson.sections.flatMap((section) =>
            (lesson.puzzlesBySection[section.id] ?? []).map((puzzle) => ({ puzzle, sectionTitle: section.title })),
          )
        : [],
    [lesson],
  )
  const todo = items.filter((it) => !it.puzzle.done)
  const doneCount = items.length - todo.length

  // The position on the bench: the one asked for, else the first not done.
  const requested = params.get('p')
  const current = items.find((it) => it.puzzle.id === requested) ?? todo[0] ?? null
  const upNext = todo.filter((it) => it.puzzle.id !== current?.puzzle.id)
  const doneItems = items.filter((it) => it.puzzle.done && it.puzzle.id !== current?.puzzle.id)

  function show(id: string) {
    setParams({ p: id }, { replace: true })
  }

  /** After a save or a skip: the next one still to do, or back to the folder when the queue is empty. */
  function advance(fromId: string) {
    const next = todo.find((it) => it.puzzle.id !== fromId)
    if (next) show(next.puzzle.id)
    else navigate(base)
  }

  if (isLoading && !lesson) return <LoadingPage />
  if (!lesson) return <Page back={base}>Lesson not found.</Page>

  const color = student?.color ?? FOLDER_COLORS[0]

  return (
    <div className="flex min-h-svh flex-col bg-bg">
      <header className="page-header pt-safe sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-2">
          <IconButton label="Back to the lesson" onClick={() => navigate(base)}>
            <Close />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-on-bg">
              Annotate
              <span className="text-on-bg-2">
                {' '}
                · {student?.name} · Lesson {lesson.plan.number}
              </span>
            </p>
          </div>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] font-semibold text-ink-2 tabular-nums">
            {doneCount} / {items.length} done
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-28">
        {current ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
            <Bench
              key={current.puzzle.id}
              puzzle={current.puzzle}
              sectionTitle={current.sectionTitle}
              position={items.indexOf(current) + 1}
              planId={lessonPlanId}
              color={color}
              onSkip={() => advance(current.puzzle.id)}
              onDone={() => advance(current.puzzle.id)}
            />
            <Queue upNext={upNext} done={doneItems} onPick={(id) => show(id)} />
          </div>
        ) : (
          <div className="mx-auto max-w-md py-16 text-center">
            <p className="font-display text-[30px] font-semibold text-on-bg">All done</p>
            <p className="mt-2 text-[15px] text-on-bg-2">
              {items.length === 0 ? 'This lesson has no positions yet.' : 'Every position in this lesson is annotated.'}
            </p>
            <Button variant="primary" size="lg" className="mt-6" onClick={() => navigate(base)}>
              Back to the lesson
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}

/** The current position and its fields. Keyed on the puzzle id by the page, so each one starts fresh. */
function Bench({
  puzzle: initial,
  sectionTitle,
  position,
  planId,
  color,
  onSkip,
  onDone,
}: {
  puzzle: Puzzle
  sectionTitle: string
  position: number
  planId: string
  color: string
  onSkip: () => void
  onDone: () => void
}) {
  const { update } = usePuzzleMutations(initial.id, planId)
  const [puzzle, setPuzzle] = useState<Puzzle>(initial)
  const [step, setStep] = useState(initial.solution.length)
  const [flipped, setFlipped] = useState(false)
  const summaryRef = useRef<HTMLTextAreaElement>(null)

  const fen = useMemo(() => normalizeFen(puzzle.starting_fen, puzzle.side_to_move), [puzzle.starting_fen, puzzle.side_to_move])
  const sideOrientation = puzzle.side_to_move === 'b' ? 'black' : 'white'
  const orientation = flipped ? (sideOrientation === 'white' ? 'black' : 'white') : sideOrientation
  const atStart = step === 0
  const viewFen = atStart ? fen : puzzle.solution[step - 1].fen
  const lastMove = useMemo(() => {
    const move = puzzle.solution[step - 1]
    if (!move) return null
    const m = /([a-h][1-8])[^a-h]*$/.exec(move.san.replace(/[+#]/g, ''))
    return m ? { from: '', to: m[1] } : null
  }, [puzzle.solution, step])

  function apply(patch: PuzzlePatch) {
    setPuzzle((p) => ({ ...p, ...patch }))
    update.mutate(patch)
  }

  // A blank or placeholder label ("#3") becomes the first answer move.
  const autoLabel = (line: SolutionMove[]) =>
    puzzle.label && !/^#\d+$/.test(puzzle.label) ? puzzle.label : line[0]?.san || puzzle.label

  // Playing from the end extends the line; playing from an earlier step starts the line over from there.
  function addMove(san: string, resultFen: string) {
    const solution = [...puzzle.solution.slice(0, step), { san, fen: resultFen }]
    apply({ solution, label: autoLabel(solution) })
    setStep(solution.length)
  }

  function clearLine() {
    apply({ solution: [] })
    setStep(0)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1))
      if (e.key === 'ArrowRight') setStep((s) => Math.min(puzzle.solution.length, s + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [puzzle.solution.length])

  const field = 'w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-[16px] outline-none focus:border-accent'
  const toMove = puzzle.side_to_move === 'w' ? 'White' : 'Black'

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] md:items-start">
      <div className="mx-auto w-full max-w-[560px] md:mx-0">
        <div className="flex items-end justify-between gap-3 pl-3">
          <p
            className="folder-tab flex h-8 min-w-0 items-center gap-2 rounded-t-xl px-3.5 text-[12px] font-bold tracking-[0.08em] text-black/60 uppercase"
            style={{ background: color }}
          >
            <span className="block h-2 w-2 shrink-0 rounded-[2px] bg-black/35" />
            <span className="truncate">
              #{position} · {sectionTitle}
            </span>
          </p>
          <button onClick={() => setFlipped((f) => !f)} className="shrink-0 pb-1.5 text-[13px] font-medium text-on-bg-2 hover:text-on-bg">
            Flip board
          </button>
        </div>
        <MoveBoard
          fen={viewFen}
          orientation={orientation}
          arrows={atStart ? puzzle.arrows : undefined}
          highlights={atStart ? puzzle.highlights : undefined}
          lastMove={lastMove}
          onMove={addMove}
          onArrowsChange={atStart ? (arrows) => apply({ arrows }) : undefined}
          onHighlightsChange={atStart ? (highlights) => apply({ highlights }) : undefined}
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[13px] text-on-bg-2">
            {atStart ? 'Play the answer on the board. Right-drag for arrows, right-click to highlight.' : 'Keep playing to extend the line.'}
          </p>
          <p className="shrink-0 text-[12px] font-semibold tracking-[0.1em] text-on-bg-2 uppercase">{toMove} to play</p>
        </div>

        {/* The line: Start, then one chip per move; tap to view that moment. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStep(0)}
            className={clsx(
              'h-9 rounded-lg px-3 text-[13px] font-semibold transition',
              atStart ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2 hover:bg-surface-3',
            )}
          >
            Start
          </button>
          {puzzle.solution.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i + 1)}
              className={clsx(
                'h-9 rounded-lg px-2.5 font-mono text-[14px] font-semibold transition',
                step === i + 1 ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink hover:bg-surface-3',
              )}
            >
              <span className="mr-1 text-[11px] font-normal opacity-70">{moveNumber(puzzle.side_to_move, i)}</span>
              {m.san}
            </button>
          ))}
          {puzzle.solution.length > 0 && (
            <button type="button" onClick={clearLine} className="ml-auto h-9 px-2 text-[13px] font-medium text-ink-3 hover:text-ink">
              Clear line
            </button>
          )}
        </div>
      </div>

      <PaperCard className="space-y-4 p-4">
        <div>
          <SectionLabel>Label</SectionLabel>
          <input
            key={`label-${puzzle.label}`}
            defaultValue={puzzle.label}
            onBlur={(e) => e.target.value !== puzzle.label && apply({ label: e.target.value })}
            placeholder={puzzle.solution[0]?.san || 'e.g. Rf8'}
            className={`${field} h-11 font-display text-[20px] font-semibold`}
          />
        </div>
        <div>
          <SectionLabel>Question</SectionLabel>
          <input
            key={`q-${puzzle.quiz_prompt}`}
            defaultValue={puzzle.quiz_prompt}
            onBlur={(e) => e.target.value !== puzzle.quiz_prompt && apply({ quiz_prompt: e.target.value })}
            placeholder={defaultQuizPrompt(sectionTitle, puzzle.side_to_move)}
            className={`${field} h-11`}
          />
        </div>
        <div>
          <SectionLabel>Notes</SectionLabel>
          <textarea
            ref={summaryRef}
            defaultValue={puzzle.summary}
            onBlur={(e) => e.target.value !== puzzle.summary && apply({ summary: e.target.value })}
            rows={5}
            placeholder="The idea, in the words you'd use at the board."
            className={`${field} resize-y py-3 leading-relaxed`}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <SectionLabel>Source</SectionLabel>
            {puzzle.reference_url && (
              <a href={puzzle.reference_url} target="_blank" rel="noreferrer" className="mb-2 text-[12px] font-semibold text-accent">
                Open ↗
              </a>
            )}
          </div>
          <input
            key={`src-${puzzle.reference_url ?? ''}`}
            defaultValue={puzzle.reference_url ?? ''}
            onBlur={(e) => {
              const url = e.target.value.trim() || null
              if (url !== puzzle.reference_url) apply({ reference_url: url, reference_label: url ? hostOf(url) : null })
            }}
            placeholder="https://…"
            inputMode="url"
            spellCheck={false}
            autoCapitalize="off"
            className={`${field} h-10 text-[14px]`}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" size="lg" onClick={onSkip}>
            Skip for now
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            icon={<Check size={18} />}
            onClick={() => {
              // Flush the notes if the coach taps straight from the textarea.
              const text = summaryRef.current?.value ?? puzzle.summary
              apply(text !== puzzle.summary ? { summary: text, done: true } : { done: true })
              onDone()
            }}
          >
            {puzzle.done ? 'Save' : 'Save, done'}
          </Button>
        </div>
      </PaperCard>
    </div>
  )
}

interface QueueItem {
  puzzle: Puzzle
  sectionTitle: string
}

/** What's left, as small boards, then what's done. */
function Queue({ upNext, done, onPick }: { upNext: QueueItem[]; done: QueueItem[]; onPick: (id: string) => void }) {
  const [showDone, setShowDone] = useState(false)
  return (
    <aside className="min-w-0">
      <SectionLabel tone="page">Up next · {upNext.length}</SectionLabel>
      {upNext.length === 0 ? (
        <p className="text-[13px] text-on-bg-2">This is the last one.</p>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {upNext.map((it, i) => (
            <QueueCard key={it.puzzle.id} item={it} first={i === 0} onClick={() => onPick(it.puzzle.id)} />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1 text-[12px] font-semibold tracking-wider text-on-bg-2 uppercase"
          >
            <ChevronRight size={14} className={clsx('transition', showDone && 'rotate-90')} />
            Done · {done.length}
          </button>
          {showDone && (
            <div className="mt-2 -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
              {done.map((it) => (
                <QueueCard key={it.puzzle.id} item={it} done onClick={() => onPick(it.puzzle.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

function QueueCard({ item, first, done, onClick }: { item: QueueItem; first?: boolean; done?: boolean; onClick: () => void }) {
  const { puzzle } = item
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'index-card flex w-[200px] shrink-0 items-center gap-3 rounded-xl border bg-surface p-2.5 text-left shadow-[0_10px_22px_-16px_rgba(0,0,0,0.5)] transition active:scale-[0.98] lg:w-full',
        first ? 'border-accent' : 'border-line',
        done && 'opacity-80',
      )}
    >
      <div className="w-[72px] shrink-0">
        <Board
          fen={normalizeFen(puzzle.starting_fen, puzzle.side_to_move)}
          orientation={puzzle.side_to_move === 'b' ? 'black' : 'white'}
          coordinates={false}
          className="rounded-[3px] shadow-none"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[16px] leading-tight font-semibold text-ink">{puzzle.label || 'Untitled'}</p>
        <p className="mt-0.5 text-[12px] text-ink-3">
          {done ? (
            <span className="inline-flex items-center gap-1 text-accent-strong">
              <Check size={12} /> Done
            </span>
          ) : first ? (
            'Next up'
          ) : (
            `${puzzle.side_to_move === 'w' ? 'White' : 'Black'} to play`
          )}
        </p>
      </div>
    </button>
  )
}

function moveNumber(side: 'w' | 'b', i: number): string {
  const n = Math.floor(i / 2) + 1
  return side === 'w' ? (i % 2 === 0 ? `${n}.` : '') : i % 2 === 0 ? `${n}…` : `${n + 1}.`
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
