import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import type { Puzzle, SolutionMove } from '../types/domain'
import type { PuzzlePatch } from '../lib/data'
import { useLesson, usePuzzle, usePuzzleMutations, useStudent } from '../lib/queries'
import { normalizeFen, placementOf, sideToMoveOf } from '../lib/fen'
import { patchFromImported, replayLine } from '../lib/import'
import { Page, Card, LoadingPage, SectionLabel } from '../components/ui/Page'
import { Button } from '../components/ui/Button'
import { SetupBoard } from '../components/board/SetupBoard'
import { AnnotateBoard } from '../components/puzzle/AnnotateBoard'
import { MoveBoard } from '../components/board/MoveBoard'
import { ImportSheet } from '../components/import/ImportSheet'
import { EngineCheck } from '../components/import/EngineCheck'
import { draftExplanation } from '../lib/ai'
import { answerProblem } from '../lib/solution'
import { Check, ChevronDown, Plus, Sparkle, Warning } from '../components/ui/Icons'
import { Chip, ChipRow } from '../components/ui/Chip'
import { defaultQuizPrompt, explanationStarters, quizPromptChips } from '../lib/prompts'

type Tab = 'position' | 'arrows' | 'answer'

/**
 * The editor keeps a local copy of the puzzle and saves patches as the coach
 * works: board changes immediately, text fields on blur. There is no Save
 * button to forget.
 */
export function PuzzleEditorPage() {
  const { studentId = '', lessonPlanId = '', puzzleId = '' } = useParams()
  const { data: student } = useStudent(studentId)
  const { data: lesson } = useLesson(lessonPlanId)
  const { data: loaded, isLoading } = usePuzzle(puzzleId)
  const { update } = usePuzzleMutations(puzzleId, lessonPlanId)
  const base = `/students/${studentId}/lessons/${lessonPlanId}`

  if (isLoading && !loaded) return <LoadingPage />
  if (!loaded) return <Page back={base}>Position not found.</Page>

  const section = lesson?.sections.find((s) => s.id === loaded.section_id)
  return (
    <Editor
      key={loaded.id}
      initial={loaded}
      eyebrow={[student?.name, lesson ? `Lesson ${lesson.plan.number}` : null, section?.title].filter(Boolean).join(' · ')}
      sectionTitle={section?.title}
      back={`${base}/puzzles/${loaded.id}`}
      lessonBase={base}
      save={(patch) => update.mutate(patch)}
      saving={update.isPending}
    />
  )
}

function Editor({
  initial,
  eyebrow,
  sectionTitle,
  back,
  lessonBase,
  save,
  saving,
}: {
  initial: Puzzle
  eyebrow: string
  sectionTitle?: string
  back: string
  lessonBase: string
  save: (patch: PuzzlePatch) => void
  saving: boolean
}) {
  const navigate = useNavigate()
  const [puzzle, setPuzzle] = useState<Puzzle>(initial)
  const [showMore, setShowMore] = useState(Boolean(initial.reference_url || initial.reference_label))
  const [tab, setTab] = useState<Tab>(initial.starting_fen === 'start' && initial.solution.length === 0 ? 'position' : 'answer')
  const [importing, setImporting] = useState(false)
  const [typedLine, setTypedLine] = useState('')
  const [lineError, setLineError] = useState<string | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const summaryRef = useRef<HTMLTextAreaElement>(null)

  async function draft() {
    if (puzzle.solution.length === 0) {
      setDraftError('Record the answer first — the draft is written from the position and the line.')
      return
    }
    if (summaryRef.current?.value.trim() && !window.confirm('Replace the current explanation with a draft?')) return
    setDrafting(true)
    setDraftError(null)
    try {
      const text = await draftExplanation(fen, puzzle.solution, puzzle.quiz_prompt)
      if (summaryRef.current) summaryRef.current.value = text
      apply({ summary: text })
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : String(e))
    } finally {
      setDrafting(false)
    }
  }
  const fen = useMemo(() => normalizeFen(puzzle.starting_fen, puzzle.side_to_move), [puzzle.starting_fen, puzzle.side_to_move])
  const orientation = puzzle.side_to_move === 'b' ? 'black' : 'white'

  function apply(patch: PuzzlePatch) {
    setPuzzle((p) => ({ ...p, ...patch }))
    save(patch)
  }

  // Position edits arrive on every tap; coalesce them so a fast set-up is one write.
  const pending = useRef<PuzzlePatch>({})
  const timer = useRef<number | null>(null)
  function applyDebounced(patch: PuzzlePatch) {
    setPuzzle((p) => ({ ...p, ...patch }))
    pending.current = { ...pending.current, ...patch }
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      save(pending.current)
      pending.current = {}
      timer.current = null
    }, 500)
  }
  useEffect(
    () => () => {
      if (timer.current) {
        window.clearTimeout(timer.current)
        save(pending.current)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // The answer board sits at the end of the recorded line.
  const answerFen = puzzle.solution.length ? puzzle.solution[puzzle.solution.length - 1].fen : fen
  const answerWarning = useMemo(() => answerProblem(puzzle), [puzzle])
  const lastMove = useMemo(() => {
    const last = puzzle.solution[puzzle.solution.length - 1]
    if (!last) return null
    const m = /([a-h][1-8])[^a-h]*$/.exec(last.san.replace(/[+#]/g, ''))
    return m ? { from: '', to: m[1] } : null
  }, [puzzle.solution])

  function setPosition(nextFen: string, side: 'w' | 'b') {
    // A different position (or side to move) invalidates the recorded line.
    const changed = placementOf(nextFen) !== placementOf(fen) || side !== puzzle.side_to_move
    applyDebounced(changed ? { starting_fen: nextFen, side_to_move: side, solution: [] } : { starting_fen: nextFen })
  }

  // A blank or placeholder label ("#3") becomes the first answer move automatically.
  const autoLabel = (line: SolutionMove[]) =>
    puzzle.label && !/^#\d+$/.test(puzzle.label) ? puzzle.label : line[0]?.san || puzzle.label

  function addMove(san: string, resultFen: string) {
    const solution = [...puzzle.solution, { san, fen: resultFen }]
    apply({ solution, label: autoLabel(solution) })
  }

  function insertStarter(text: string) {
    const el = summaryRef.current
    const current = el?.value ?? puzzle.summary
    const next = current.trim() ? `${current.replace(/\s+$/, '')} ${text}` : text
    if (el) {
      el.value = next
      el.focus()
    }
    apply({ summary: next })
  }

  function finish(addAnother: boolean) {
    // Flush anything still coalescing, then leave.
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = null
      save(pending.current)
      pending.current = {}
    }
    navigate(addAnother ? `${lessonBase}?quickadd=${puzzle.section_id}` : lessonBase)
  }

  function setComment(i: number, comment: string) {
    apply({ solution: puzzle.solution.map((m, j) => (j === i ? { ...m, comment } : m)) })
  }

  function useLine(line: SolutionMove[]) {
    apply({ solution: line, label: autoLabel(line) })
  }

  function applyTypedLine() {
    const sans = typedLine.trim().split(/\s+/).filter((t) => !/^\d+\.+$/.test(t))
    const { moves, error } = replayLine(fen, sans)
    if (error) {
      setLineError(error)
      return
    }
    setLineError(null)
    setTypedLine('')
    apply({ solution: moves, label: autoLabel(moves) })
  }

  const promptDefault = defaultQuizPrompt(sectionTitle, puzzle.side_to_move)
  const starters = explanationStarters(sectionTitle, puzzle.solution[0]?.san)

  const field =
    'w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-[16px] outline-none focus:border-accent'

  return (
    <Page
      back={back}
      eyebrow={eyebrow}
      width="wide"
      actions={<span className="pr-2 text-[13px] text-ink-3">{saving ? 'Saving…' : 'Saved'}</span>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={puzzle.label}
          onChange={(e) => setPuzzle({ ...puzzle, label: e.target.value })}
          onBlur={(e) => e.target.value !== initial.label && apply({ label: e.target.value })}
          placeholder="Label, e.g. Kg7"
          className="min-w-0 flex-1 bg-transparent text-[28px] font-bold tracking-tight text-ink outline-none placeholder:text-ink-3"
        />
        <Button variant="soft" onClick={() => setImporting(true)}>
          Import…
        </Button>
      </div>

      <div className="mb-4 flex rounded-xl bg-surface-2 p-1">
        {(
          [
            ['position', 'Position'],
            ['arrows', 'Arrows'],
            ['answer', 'Answer'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'h-11 flex-1 rounded-lg text-[15px] font-semibold transition',
              tab === key ? 'bg-surface text-ink shadow-card' : 'text-ink-2',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <Card className="p-4">
          {tab === 'position' && <SetupBoard fen={fen} side={puzzle.side_to_move} onChange={setPosition} />}
          {tab === 'arrows' && (
            <AnnotateBoard
              fen={fen}
              orientation={orientation}
              arrows={puzzle.arrows}
              highlights={puzzle.highlights}
              onArrowsChange={(arrows) => apply({ arrows })}
              onHighlightsChange={(highlights) => apply({ highlights })}
            />
          )}
          {tab === 'answer' && (
            <div className="space-y-3">
              <div className="mx-auto w-full max-w-[560px]">
                <MoveBoard
                  fen={answerFen}
                  orientation={orientation}
                  arrows={puzzle.solution.length === 0 ? puzzle.arrows : undefined}
                  highlights={puzzle.solution.length === 0 ? puzzle.highlights : undefined}
                  lastMove={lastMove}
                  onMove={addMove}
                />
              </div>
              <p className="text-[13px] text-ink-3">
                Play the answer on the board — tap a piece, then where it goes. Each move is added to the line below.
              </p>
            </div>
          )}
        </Card>

        <div className="min-w-0 space-y-4">
          {tab === 'answer' && (
            <>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <SectionLabel className="mb-0">Answer line</SectionLabel>
                  {puzzle.solution.length > 0 && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => apply({ solution: puzzle.solution.slice(0, -1) })}>
                        Undo move
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => apply({ solution: [] })}>
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
                {answerWarning && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-warn-soft px-2.5 py-1.5 text-[13px] text-warn">
                    <Warning size={15} className="mt-0.5 shrink-0" /> {answerWarning}
                  </p>
                )}
                {puzzle.solution.length === 0 ? (
                  <p className="mt-2 text-[14px] text-ink-3">No moves yet.</p>
                ) : (
                  <ol className="mt-2 space-y-1.5">
                    {puzzle.solution.map((m, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-right font-mono text-[12px] text-ink-3 tabular-nums">{i + 1}.</span>
                        <span className="w-14 shrink-0 font-mono text-[16px] font-semibold text-ink">{m.san}</span>
                        <input
                          defaultValue={m.comment ?? ''}
                          onBlur={(e) => e.target.value !== (m.comment ?? '') && setComment(i, e.target.value)}
                          placeholder="Comment on this move (optional)"
                          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] outline-none focus:border-accent"
                        />
                      </li>
                    ))}
                  </ol>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    applyTypedLine()
                  }}
                  className="mt-3 flex gap-2"
                >
                  <input
                    value={typedLine}
                    onChange={(e) => setTypedLine(e.target.value)}
                    placeholder="Or type the line: Rf8 Bxh4 b4"
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface-2 px-3 font-mono text-[13px] outline-none focus:border-accent"
                  />
                  <Button type="submit" size="sm" variant="secondary" disabled={!typedLine.trim()}>
                    Set
                  </Button>
                </form>
                {lineError && <p className="mt-1.5 text-[13px] text-danger">{lineError}</p>}
              </Card>
              <EngineCheck fen={fen} solution={puzzle.solution} onUseLine={useLine} />
            </>
          )}

          <Card className="space-y-5 p-4">
            <div>
              <SectionLabel>Quiz prompt</SectionLabel>
              <input
                key={puzzle.quiz_prompt}
                defaultValue={puzzle.quiz_prompt}
                onBlur={(e) => e.target.value !== puzzle.quiz_prompt && apply({ quiz_prompt: e.target.value })}
                placeholder={promptDefault}
                className={`${field} h-12`}
              />
              <p className="mt-1.5 text-[12.5px] text-ink-3">
                Blank asks the default above, worked out from the section and who's to move. Or tap one:
              </p>
              <ChipRow className="mt-2" scroll>
                {quizPromptChips(puzzle.side_to_move).map((text) => (
                  <Chip
                    key={text}
                    selected={puzzle.quiz_prompt === text}
                    className="h-9 text-[13px]"
                    onClick={() => apply({ quiz_prompt: puzzle.quiz_prompt === text ? '' : text })}
                  >
                    {text}
                  </Chip>
                ))}
              </ChipRow>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <SectionLabel>Explanation</SectionLabel>
                <button
                  type="button"
                  onClick={draft}
                  disabled={drafting}
                  className="mb-2 flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-accent hover:bg-accent-soft disabled:opacity-50"
                >
                  <Sparkle size={15} /> {drafting ? 'Drafting…' : 'Draft with AI'}
                </button>
              </div>
              {draftError && <p className="mb-2 text-[13px] text-danger">{draftError}</p>}
              <textarea
                ref={summaryRef}
                defaultValue={puzzle.summary}
                onBlur={(e) => e.target.value !== puzzle.summary && apply({ summary: e.target.value })}
                rows={5}
                placeholder="The idea, in the words you'd use at the board."
                className={`${field} resize-y py-3 leading-relaxed`}
              />
              <p className="mt-1.5 text-[12.5px] text-ink-3">Tap a starter to add it, then finish the sentence:</p>
              <ChipRow className="mt-2" scroll>
                {starters.map((text) => (
                  <Chip key={text} className="h-9 text-[13px]" icon={<Plus size={13} />} onClick={() => insertStarter(text)}>
                    {text}
                  </Chip>
                ))}
              </ChipRow>
            </div>

            <div className="border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className="flex h-9 w-full items-center gap-1.5 text-left text-[14px] font-semibold text-ink-2"
              >
                <ChevronDown size={16} className={clsx('transition', showMore ? '' : '-rotate-90')} />
                More
                {!showMore && (puzzle.reference_label || puzzle.reference_url) && (
                  <span className="ml-1 truncate font-normal text-ink-3">· {puzzle.reference_label || puzzle.reference_url}</span>
                )}
                {!showMore && puzzle.themes && puzzle.themes.length > 0 && (
                  <span className="ml-1 truncate font-normal text-ink-3">· {puzzle.themes.join(', ')}</span>
                )}
              </button>
              {showMore && (
                <div className="mt-2 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <SectionLabel>Reference link</SectionLabel>
                      <input
                        defaultValue={puzzle.reference_url ?? ''}
                        onBlur={(e) => (e.target.value || null) !== puzzle.reference_url && apply({ reference_url: e.target.value || null })}
                        placeholder="https://lichess.org/…"
                        className={`${field} h-11 text-[14px]`}
                      />
                    </label>
                    <label className="block">
                      <SectionLabel>Link label</SectionLabel>
                      <input
                        defaultValue={puzzle.reference_label ?? ''}
                        onBlur={(e) => (e.target.value || null) !== puzzle.reference_label && apply({ reference_label: e.target.value || null })}
                        placeholder="e.g. Lichess puzzle #482913"
                        className={`${field} h-11 text-[14px]`}
                      />
                    </label>
                  </div>
                  {puzzle.themes && puzzle.themes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {puzzle.themes.map((t) => (
                        <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] text-ink-2">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          <div className="flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1" icon={<Check size={18} />} onClick={() => finish(false)}>
              Done
            </Button>
            <Button variant="primary" size="lg" className="flex-1" icon={<Plus size={18} />} onClick={() => finish(true)}>
              Done, add another
            </Button>
          </div>
        </div>
      </div>

      <ImportSheet
        open={importing}
        mode="replace"
        onClose={() => setImporting(false)}
        onImport={async (position) => {
          const patch = patchFromImported(position)
          if (!position.label) delete patch.label
          if (!position.summary) delete patch.summary
          if (!position.quizPrompt) delete patch.quiz_prompt
          apply({ ...patch, side_to_move: sideToMoveOf(position.fen) })
          setTab(position.solution.length ? 'answer' : 'position')
        }}
      />
    </Page>
  )
}
