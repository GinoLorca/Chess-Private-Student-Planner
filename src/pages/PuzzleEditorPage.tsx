import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { usePieceSet } from '../state/PieceSetContext'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import type { BoardArrow, BoardHighlight, LevelId, MoveGlyph, Puzzle, PuzzleLevels, SolutionMove } from '../types/domain'
import type { PuzzlePatch } from '../lib/data'
import { useLesson, usePuzzle, usePuzzleMutations, useStudent } from '../lib/queries'
import { normalizeFen, parsePlacement, placementOf, serializePlacement, sideToMoveOf, type PieceCode } from '../lib/fen'
import { patchFromImported, typedLine as readTypedLine } from '../lib/import'
import { Page, LoadingPage, SectionLabel } from '../components/ui/Page'
import { DividerPaper, DividerTabs, FolderBody, FolderTab, PaperCard } from '../components/lesson/Folder'
import { FOLDER_COLORS } from '../lib/colors'
import { Button } from '../components/ui/Button'
import { SetupBoard } from '../components/board/SetupBoard'
import { AnnotateBoard } from '../components/puzzle/AnnotateBoard'
import { MoveBoard } from '../components/board/MoveBoard'
import { ImportSheet } from '../components/import/ImportSheet'
import { EngineCheck } from '../components/import/EngineCheck'
import { draftExplanation } from '../lib/ai'
import { answerProblem, lineSteps, stepLabel } from '../lib/solution'
import { GLYPHS, marksOf, moveExtras, sanWithGlyph, withMarks } from '../lib/glyphs'
import { useClicker } from '../hooks/useClicker'
import { opposite, useFlip } from '../hooks/useFlip'
import { Check, ChevronDown, ChevronRight, Pencil, Plus, Sparkle, Target, Teach, Warning } from '../components/ui/Icons'
import { SendToTeachSheet } from '../components/teach/SendToTeachSheet'
import { isTeach } from '../lib/teach'
import { levelFromPatch, levelName, levelPuzzle, levelPuzzleId, withLevel } from '../lib/levels'
import { analysisHref } from '../lib/analysisLink'
import { Chip, ChipRow } from '../components/ui/Chip'
import { defaultQuizPrompt, explanationStarters, quizPromptChips } from '../lib/prompts'

type Tab = 'position' | 'arrows' | 'answer'

/**
 * The editor keeps a local copy of the puzzle and saves patches as the coach
 * works: board changes immediately, text fields on blur. There is no Save
 * button to forget.
 */
export function PuzzleEditorPage() {
  const { studentId = '', lessonPlanId = '', puzzleId = '', level: levelParam } = useParams()
  const { data: student } = useStudent(studentId)
  const { data: lesson } = useLesson(lessonPlanId)
  const { data: loaded, isLoading } = usePuzzle(puzzleId)
  const { update } = usePuzzleMutations(puzzleId, lessonPlanId)
  const base = `/students/${studentId}/lessons/${lessonPlanId}`
  // De-Construct: one of the easier versions, edited like a position and saved into its levels.
  const levelKey = levelParam === 'beginner' || levelParam === 'intermediate' ? levelParam : null

  if (isLoading && !loaded) return <LoadingPage />
  if (!loaded) return <Page back={base}>Position not found.</Page>

  if (levelKey) {
    const deconstruct = `${base}/puzzles/${loaded.id}/deconstruct`
    if (!loaded.levels?.[levelKey]) return <Page back={deconstruct}>This version isn't there any more.</Page>
    const section = lesson?.sections.find((s) => s.id === loaded.section_id)
    return (
      <LevelEditor
        key={levelPuzzleId(loaded.id, levelKey)}
        puzzle={loaded}
        levelKey={levelKey}
        studentName={student?.name ?? 'Student'}
        color={student?.color ?? FOLDER_COLORS[0]}
        aside={[lesson ? `Lesson ${lesson.plan.number}` : null, section?.title, `${loaded.label || 'Position'}: ${levelName(levelKey)}`].filter(Boolean).join(' · ')}
        sectionTitle={section?.title}
        deconstruct={deconstruct}
        lessonBase={base}
        save={(levels) => update.mutate({ levels })}
        saving={update.isPending}
      />
    )
  }

  const section = lesson?.sections.find((s) => s.id === loaded.section_id)
  // The sweep after a batch: the next position in lesson order still without an explanation.
  const ordered = lesson ? lesson.sections.flatMap((s) => lesson.puzzlesBySection[s.id] ?? []) : []
  const at = ordered.findIndex((p) => p.id === loaded.id)
  const nextUnexplained = [...ordered.slice(at + 1), ...ordered.slice(0, Math.max(at, 0))].find((p) => !p.summary.trim())
  return (
    <Editor
      key={loaded.id}
      initial={loaded}
      next={nextUnexplained ? { id: nextUnexplained.id, label: nextUnexplained.label } : undefined}
      studentName={student?.name ?? 'Student'}
      teachFrom={student && !isTeach(student) ? student.name : undefined}
      color={student?.color ?? FOLDER_COLORS[0]}
      aside={[lesson ? `Lesson ${lesson.plan.number}` : null, section?.title].filter(Boolean).join(' · ')}
      sectionTitle={section?.title}
      back={`${base}/puzzles/${loaded.id}`}
      lessonBase={base}
      save={(patch) => update.mutate(patch)}
      saving={update.isPending}
    />
  )
}

/** One of De-Construct's levels in the editor: each save folds into the levels as last saved, not into a copy that may be behind. */
function LevelEditor({
  puzzle,
  levelKey,
  deconstruct,
  save,
  ...rest
}: {
  puzzle: Puzzle
  levelKey: LevelId
  studentName: string
  color: string
  aside: string
  sectionTitle?: string
  deconstruct: string
  lessonBase: string
  save: (levels: PuzzleLevels | null) => void
  saving: boolean
}) {
  const levels = useRef<PuzzleLevels | null>(puzzle.levels ?? null)
  const [initial] = useState(() => levelPuzzle(puzzle, levelKey))
  return (
    <Editor
      {...rest}
      initial={initial}
      level={{ name: levelName(levelKey), doneTo: deconstruct, original: { fen: normalizeFen(puzzle.starting_fen, puzzle.side_to_move), solution: puzzle.solution } }}
      back={deconstruct}
      save={(patch) => {
        const current = levels.current?.[levelKey]
        if (!current) return
        levels.current = withLevel(levels.current, levelKey, levelFromPatch(current, patch as Record<string, unknown>))
        save(levels.current)
      }}
    />
  )
}

function Editor({
  initial,
  level,
  studentName,
  teachFrom,
  color,
  aside,
  sectionTitle,
  back,
  lessonBase,
  next,
  save,
  saving,
}: {
  initial: Puzzle
  /** Editing one of De-Construct's easier versions: its name, where Done goes, and the position it comes from. */
  level?: { name: string; doneTo: string; original: { fen: string; solution: SolutionMove[] } }
  studentName: string
  /** In a student's folder: their name, for Send to Teach (none in a Teach folder). */
  teachFrom?: string
  /** The student's folder colour; the divider tabs take the rest of the palette. */
  color: string
  aside: string
  sectionTitle?: string
  back: string
  lessonBase: string
  next?: { id: string; label: string }
  save: (patch: PuzzlePatch) => void
  saving: boolean
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [puzzle, setPuzzle] = useState<Puzzle>(initial)
  const [sendingToTeach, setSendingToTeach] = useState(false)
  const [showMore, setShowMore] = useState(Boolean(initial.reference_url || initial.reference_label))
  // A level opens on its pieces: taking them off and putting them back is what it's for.
  const [tab, setTab] = useState<Tab>(level || (initial.starting_fen === 'start' && initial.solution.length === 0) ? 'position' : 'answer')
  const [importing, setImporting] = useState(false)
  const [typedLine, setTypedLine] = useState('')
  const [lineError, setLineError] = useState<string | null>(null)
  // The typed line without its first move or two, when that plays and the whole line doesn't.
  const [lineFix, setLineFix] = useState<{ line: string[]; left: string[] } | null>(null)
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
  // X (or the set-up board's Flip) turns every board in the editor round.
  const [flipped, flip] = useFlip()
  const sideView = puzzle.side_to_move === 'b' ? 'black' : 'white'
  const orientation = flipped ? opposite(sideView) : sideView

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
  // Put away mid-edit (another app, the lock button): saved at once, since
  // iOS may close the app before the half second is up.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden' || !timer.current) return
      window.clearTimeout(timer.current)
      timer.current = null
      save(pending.current)
      pending.current = {}
    }
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  })

  // The answer board sits at the end of the recorded line unless a move in
  // the list is being viewed (click a move, or the clicker / arrow keys);
  // a move played while viewing mid-line replaces the rest of the line.
  const [view, setView] = useState<number | null>(null)
  const shown = view === null ? puzzle.solution.length : Math.min(view, puzzle.solution.length)
  const answerFen = shown > 0 ? puzzle.solution[shown - 1].fen : fen
  const answerWarning = useMemo(() => answerProblem(puzzle), [puzzle])
  const steps = useMemo(() => lineSteps(puzzle), [puzzle])
  const step = steps[shown]
  const lastMove = shown > 0 && step?.from && step.to ? { from: step.from, to: step.to } : null
  const shownMove = shown > 0 ? puzzle.solution[shown - 1] : undefined
  const glyphBadge = shownMove?.glyph && step?.to ? { square: step.to, glyph: shownMove.glyph } : null
  // The Draw switch: the board takes the touch pen (Arrows tab's) instead of moving pieces.
  const [drawOn, setDrawOn] = useState(false)
  const stepNext = useCallback(() => {
    if (tab === 'answer') setView((v) => Math.min(puzzle.solution.length, (v ?? puzzle.solution.length) + 1))
  }, [tab, puzzle.solution.length])
  const stepPrev = useCallback(() => {
    if (tab === 'answer') setView((v) => Math.max(0, (v ?? puzzle.solution.length) - 1))
  }, [tab, puzzle.solution.length])
  useClicker({ next: stepNext, prev: stepPrev })

  function setPosition(nextFen: string, side: 'w' | 'b') {
    // A different position (or side to move) invalidates the recorded line.
    const changed = placementOf(nextFen) !== placementOf(fen) || side !== puzzle.side_to_move
    if (changed && level) {
      // A level keeps its answer as far as it still plays on the new set-up.
      // While that answer is the position's own, cut short by an earlier
      // change, it grows back from the position's line as pieces return.
      let kept = carryLine(lastGood.current, nextFen)
      const own = level.original.solution
      const bare = (san?: string) => san?.replace(/[+#]+$/, '')
      if (kept.moves && lastGood.current.solution.every((m, i) => bare(own[i]?.san) === bare(m.san))) {
        const whole = carryLine(level.original, nextFen)
        if (whole.moves && whole.moves.length > kept.moves.length) kept = whole
      }
      setLineNote(kept.note)
      if (kept.moves) lastGood.current = { fen: nextFen, solution: kept.moves }
      applyDebounced(kept.moves ? { starting_fen: nextFen, side_to_move: side, solution: kept.moves } : { starting_fen: nextFen, side_to_move: side })
      return
    }
    applyDebounced(changed ? { starting_fen: nextFen, side_to_move: side, solution: [] } : { starting_fen: nextFen })
  }
  // The last legal set-up and its answer, which a level's answer is carried on from.
  const lastGood = useRef({ fen, solution: initial.solution })
  const [lineNote, setLineNote] = useState<string | null>(null)

  // A blank or placeholder label ("#3") becomes the first answer move automatically.
  const autoLabel = (line: SolutionMove[]) =>
    puzzle.label && !/^#\d+$/.test(puzzle.label) ? puzzle.label : line[0]?.san || puzzle.label

  function addMove(san: string, resultFen: string) {
    // The recorded move played again just steps on: the rest of the line, and its marks, stay.
    if (puzzle.solution[shown]?.san === san && shown < puzzle.solution.length) {
      setView(shown + 1 === puzzle.solution.length ? null : shown + 1)
      return
    }
    const solution = [...puzzle.solution.slice(0, shown), { san, fen: resultFen }]
    setView(null)
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

  function finish(where: 'lesson' | 'another' | 'next') {
    // Flush anything still coalescing, then leave.
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = null
      save(pending.current)
      pending.current = {}
    }
    if (level) navigate(level.doneTo)
    else if (where === 'next' && next) navigate(`${lessonBase}/puzzles/${next.id}/edit`)
    else if (where === 'another') navigate(`${lessonBase}?quickadd=${puzzle.section_id}`)
    else navigate(lessonBase)
  }

  function setComment(i: number, comment: string) {
    apply({ solution: puzzle.solution.map((m, j) => (j === i ? { ...m, comment } : m)) })
  }

  // A move's own arrows, squares and symbol. A stroke can change both lists
  // at once (a profile recolouring), so each change builds on the last one
  // made, not on the render's copy, and the two coalesce into one write.
  const latestLine = useRef(puzzle.solution)
  useEffect(() => {
    latestLine.current = puzzle.solution
  })
  function setMoveMarks(i: number, marks: Partial<Pick<SolutionMove, 'arrows' | 'highlights' | 'glyph'>>) {
    const solution = latestLine.current.map((m, j) => (j === i ? withMarks(m, marks) : m))
    latestLine.current = solution
    applyDebounced({ solution })
  }
  // The board's marks: the position's own at the start, the move's own on a move.
  const shownMarks = shown === 0 ? { arrows: puzzle.arrows, highlights: puzzle.highlights } : marksOf(shownMove)
  const onShownArrows = (arrows: BoardArrow[]) => (shown === 0 ? apply({ arrows }) : setMoveMarks(shown - 1, { arrows }))
  const onShownHighlights = (highlights: BoardHighlight[]) => (shown === 0 ? apply({ highlights }) : setMoveMarks(shown - 1, { highlights }))
  const setGlyph = (glyph: MoveGlyph) => setMoveMarks(shown - 1, { glyph: shownMove?.glyph === glyph ? undefined : glyph })

  /**
   * The puzzle starts later in its own line: the position after the first
   * `count` moves becomes the start, the other side is to move, and the
   * rest of the line (notes and all) is the answer. For a line recorded
   * from the mistake rather than the punishment of it (a course's
   * "Bxf4? Rf1!"), so it becomes the opponent's puzzle in one go.
   */
  function startAfter(count: number) {
    const played = puzzle.solution.slice(0, count)
    const rest = puzzle.solution.slice(count)
    const last = played[played.length - 1]
    if (!last || rest.length === 0) return
    const nextFen = normalizeFen(last.fen)
    const side = sideToMoveOf(nextFen)
    const name = (c: 'w' | 'b') => (c === 'w' ? 'White' : 'Black')
    // A question that says the old side is to move no longer fits: back to
    // the suggested one, with the chips to pick from.
    const promptForOldSide = new RegExp(`^\\s*${name(puzzle.side_to_move)} to (move|play)`, 'i').test(puzzle.quiz_prompt)
    const moves = played.map((m, i) => `${stepLabel(puzzle, i + 1)}${m.san}`).join(' ')
    const ok = window.confirm(
      `Start the puzzle after ${moves}?\n\n` +
        `${name(side)} will be to move, and the answer will start with ${rest[0].san}. ` +
        (promptForOldSide ? `The question says ${name(puzzle.side_to_move)} is to move, so it goes back to the suggested one.` : 'The question stays as it is.'),
    )
    if (!ok) return
    setView(0)
    apply({
      starting_fen: nextFen,
      side_to_move: side,
      solution: rest,
      // What was drawn on that move is drawn on the new start.
      ...(last.arrows?.length || last.highlights?.length ? marksOf(last) : {}),
      ...(puzzle.label === played[0].san ? { label: rest[0].san } : {}),
      ...(promptForOldSide ? { quiz_prompt: '' } : {}),
    })
  }

  function useLine(line: SolutionMove[]) {
    apply({ solution: line, label: autoLabel(line) })
  }

  function applyTypedLine(text = typedLine) {
    const { moves, error, without } = readTypedLine(fen, text)
    if (error) {
      setLineError(error)
      setLineFix(without ?? null)
      return
    }
    setLineError(null)
    setLineFix(null)
    setTypedLine('')
    setView(null)
    apply({ solution: moves, label: autoLabel(moves) })
  }

  const promptDefault = defaultQuizPrompt(sectionTitle, puzzle.side_to_move)
  const starters = explanationStarters(sectionTitle, puzzle.solution[0]?.san)

  const field =
    'w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-[16px] outline-none focus:border-accent'

  // Divider tabs: Position, Arrows, Answer, coloured from the palette minus the folder's own.
  const palette = FOLDER_COLORS.filter((c) => c !== color)
  const tabs: { id: Tab; title: string; color: string }[] = [
    { id: 'position', title: 'Position', color: palette[0] },
    { id: 'arrows', title: 'Arrows', color: palette[1] },
    { id: 'answer', title: 'Answer', color: palette[2] },
  ]
  const tabColor = tabs.find((t) => t.id === tab)?.color ?? palette[0]

  return (
    <Page
      back={back}
      width="wide"
      className="pt-6"
      actions={
        <>
          <span className="pr-2 text-[13px] text-on-bg-2">{saving ? 'Saving…' : 'Saved'}</span>
          {/* The position with its line, open where the editor's board is: the
              set-up position, or the move the answer is stepped to. */}
          <Link
            to={analysisHref({
              fen,
              orientation,
              back: location.pathname + location.search,
              title: puzzle.label,
              line: puzzle.solution.map((m) => m.san),
              at: tab === 'answer' ? shown : 0,
            })}
          >
            <Button variant="ghost" size="sm" icon={<Target size={16} />}>
              Analyze
            </Button>
          </Link>
          {teachFrom !== undefined && (
            <Button variant="ghost" size="sm" icon={<Teach size={16} />} aria-label="Send to Teach" title="Send to Teach" onClick={() => setSendingToTeach(true)}>
              <span className="hidden sm:inline">Teach</span>
            </Button>
          )}
        </>
      }
    >
      {teachFrom !== undefined && (
        <SendToTeachSheet
          open={sendingToTeach}
          onClose={() => setSendingToTeach(false)}
          studentName={teachFrom}
          items={[{ puzzle, sectionTitle: sectionTitle ?? 'Positions' }]}
        />
      )}
      <FolderTab color={color} name={studentName} aside={aside} />
      <FolderBody color={color} className="pb-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            value={puzzle.label}
            onChange={(e) => setPuzzle({ ...puzzle, label: e.target.value })}
            onBlur={(e) => e.target.value !== initial.label && apply({ label: e.target.value })}
            placeholder="Label, e.g. Kg7"
            className="min-w-0 flex-1 bg-transparent font-display text-[34px] leading-none font-bold tracking-tight text-[#1a1a19] outline-none placeholder:text-black/35"
          />
          <Button variant="soft" onClick={() => setImporting(true)}>
            Import…
          </Button>
        </div>

        <DividerTabs tabs={tabs} activeId={tab} onPick={(id) => setTab(id as Tab)} />
        <DividerPaper color={tabColor}>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start pointer-fine:lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <PaperCard className="p-4">
          {tab === 'position' && level && (
            <p className="mb-3 text-[14px] text-ink-2">
              Tap a piece in the tray, then a square, to add it; drag a piece off the board to take it off. The answer keeps every move that still plays.
            </p>
          )}
          {tab === 'position' && (
            <SetupBoard
              fen={fen}
              side={puzzle.side_to_move}
              onChange={setPosition}
              orientation={flipped ? 'black' : 'white'}
              onFlip={flip}
              arrows={puzzle.arrows}
              highlights={puzzle.highlights}
              onArrowsChange={(arrows) => apply({ arrows })}
              onHighlightsChange={(highlights) => apply({ highlights })}
            />
          )}
          {tab === 'position' && level && (
            <PutBack
              fen={fen}
              original={level.original.fen}
              note={lineNote ?? lineSummary(puzzle.solution, level.original.solution)}
              onPut={(square, code) => {
                const next = { ...parsePlacement(fen), [square]: code }
                setPosition(`${serializePlacement(next)} ${puzzle.side_to_move} - - 0 1`, puzzle.side_to_move)
              }}
              onRestart={() => {
                lastGood.current = { fen: level.original.fen, solution: level.original.solution }
                setLineNote('Back to the position itself, with its whole answer.')
                applyDebounced({ starting_fen: level.original.fen, side_to_move: puzzle.side_to_move, solution: level.original.solution })
              }}
            />
          )}
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
              {drawOn ? (
                <AnnotateBoard
                  fen={answerFen}
                  orientation={orientation}
                  arrows={shownMarks.arrows}
                  highlights={shownMarks.highlights}
                  lastMove={lastMove}
                  glyph={glyphBadge}
                  onArrowsChange={onShownArrows}
                  onHighlightsChange={onShownHighlights}
                />
              ) : (
                <div className="mx-auto w-full max-w-[644px] pointer-fine:max-w-[560px]">
                  <MoveBoard
                    fen={answerFen}
                    orientation={orientation}
                    arrows={shownMarks.arrows}
                    highlights={shownMarks.highlights}
                    lastMove={lastMove}
                    glyph={glyphBadge}
                    onMove={addMove}
                    // Right-drag (or a resting finger) draws on the move the answer is stepped to: the start, or any move;
                    // a left click or a tap on the board clears what's there, as on the Arrows tab.
                    clearOnClick="all"
                    onArrowsChange={onShownArrows}
                    onHighlightsChange={onShownHighlights}
                  />
                </div>
              )}
              {puzzle.solution.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={stepPrev} disabled={shown === 0}>
                    Back
                  </Button>
                  <p className="flex-1 text-center font-mono text-[14px] font-semibold text-ink">
                    {shown === 0 ? 'Start' : `${stepLabel(puzzle, shown)} ${sanWithGlyph(puzzle.solution[shown - 1])}`}
                    <span className="ml-2 font-sans text-[12px] font-medium text-ink-3 tabular-nums">
                      {shown} / {puzzle.solution.length}
                    </span>
                  </p>
                  <Button variant="soft" size="sm" onClick={stepNext} disabled={shown >= puzzle.solution.length}>
                    Next
                  </Button>
                </div>
              )}
              <MoveMarking
                move={shownMove}
                label={shownMove ? `${stepLabel(puzzle, shown)} ${shownMove.san}` : null}
                drawOn={drawOn}
                onDraw={() => setDrawOn((on) => !on)}
                onGlyph={setGlyph}
              />
              {shown > 0 && shown < puzzle.solution.length && (
                <Button variant="ghost" size="sm" onClick={() => startAfter(shown)} className="mt-1 w-full">
                  Start the puzzle here ({sideToMoveOf(puzzle.solution[shown - 1].fen) === 'w' ? 'White' : 'Black'} to move)
                </Button>
              )}
            </div>
          )}
        </PaperCard>

        <div className="min-w-0 space-y-4">
          {tab === 'answer' && (
            <>
              <PaperCard className="p-4">
                <div className="flex items-center justify-between">
                  <SectionLabel className="mb-0">Answer line</SectionLabel>
                  {puzzle.solution.length > 0 && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setView(null)
                          apply({ solution: puzzle.solution.slice(0, -1) })
                        }}
                      >
                        Undo move
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setView(null)
                          apply({ solution: [] })
                        }}
                      >
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
                      // Keyed by position too: the notes are uncontrolled, and
                      // starting the puzzle later moves every move up the list.
                      <li key={`${i}:${m.fen}`} className="flex items-center gap-2">
                        <button
                          onClick={() => setView(i + 1)}
                          aria-current={shown === i + 1 ? 'step' : undefined}
                          className={clsx(
                            'flex h-9 shrink-0 items-center gap-2 rounded-lg px-1.5 transition',
                            shown === i + 1 ? 'bg-accent-soft' : 'hover:bg-surface-2',
                          )}
                        >
                          <span className="w-6 shrink-0 text-right font-mono text-[12px] text-ink-3 tabular-nums">{i + 1}.</span>
                          <span className="min-w-14 shrink-0 text-left font-mono text-[16px] font-semibold text-ink">{sanWithGlyph(m)}</span>
                          {/* Room for the dot on every row, so the comments line up. */}
                          <span
                            className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', m.arrows?.length || m.highlights?.length ? 'bg-ink-3' : 'bg-transparent')}
                            {...(m.arrows?.length || m.highlights?.length ? { title: 'Has arrows or squares of its own', 'aria-label': 'Has arrows or squares' } : { 'aria-hidden': true })}
                          />
                        </button>
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
                    placeholder="Or type the line: Rf8! Bxh4 b4"
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
                {lineError && lineFix && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
                    <span>Without {lineFix.left.join(' ')} (already played to reach the position) it plays:</span>
                    <Button size="sm" variant="secondary" onClick={() => applyTypedLine(lineFix.line.join(' '))}>
                      Use {lineFix.line.join(' ')}
                    </Button>
                  </div>
                )}
              </PaperCard>
              <EngineCheck fen={fen} solution={puzzle.solution} onUseLine={useLine} />
            </>
          )}

          <PaperCard className="space-y-5 p-4">
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
          </PaperCard>

          {/* On a phone the "next" label is longer than half the row, so Done
              keeps its own width there and the label wraps to two lines
              instead of pushing the page sideways. */}
          <div className="flex gap-2">
            {/* A level has one way out: back to its De-Construct page. */}
            {!level && (
              <Button variant="secondary" size="lg" className="flex-none sm:flex-1" icon={<Check size={18} />} onClick={() => finish('lesson')}>
                Done
              </Button>
            )}
            {level ? (
              <Button variant="primary" size="lg" className="flex-1" icon={<Check size={18} />} onClick={() => finish('lesson')}>
                Done: back to De-Construct
              </Button>
            ) : next ? (
              <Button variant="primary" size="lg" className="min-w-0 flex-1" icon={<ChevronRight size={18} className="shrink-0" />} onClick={() => finish('next')}>
                <span className="line-clamp-2 text-center leading-tight whitespace-normal">
                  Next without explanation{next.label ? `: ${next.label}` : ''}
                </span>
              </Button>
            ) : (
              <Button variant="primary" size="lg" className="flex-1" icon={<Plus size={18} />} onClick={() => finish('another')}>
                Done, add another
              </Button>
            )}
          </div>
        </div>
      </div>
        </DividerPaper>
      </FolderBody>

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

/**
 * Under the Answer tab's board: what drawing there does, the Draw switch
 * (the touch pen in place of moving pieces), and on a move, its symbol.
 */
function MoveMarking({
  move,
  label,
  drawOn,
  onDraw,
  onGlyph,
}: {
  move: SolutionMove | undefined
  label: string | null
  drawOn: boolean
  onDraw: () => void
  onGlyph: (glyph: MoveGlyph) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {move && (
          <div role="group" aria-label={`Symbol for ${label}`} className="flex flex-wrap gap-1">
            {GLYPHS.map((g) => {
              const on = move.glyph === g.glyph
              return (
                <button
                  key={g.glyph}
                  onClick={() => onGlyph(g.glyph)}
                  aria-pressed={on}
                  aria-label={g.name}
                  title={`${g.name} (${g.glyph})`}
                  className={clsx(
                    'grid h-9 min-w-9 place-items-center rounded-lg px-1.5 font-mono text-[15px] font-bold transition',
                    on ? 'text-white' : 'bg-surface-2 text-ink hover:bg-surface-3',
                  )}
                  style={on ? { background: g.color } : undefined}
                >
                  {g.glyph}
                </button>
              )
            })}
          </div>
        )}
        <Button size="sm" variant={drawOn ? 'soft' : 'ghost'} icon={<Pencil size={15} />} aria-pressed={drawOn} onClick={onDraw} className="ml-auto">
          {drawOn ? 'Done drawing' : 'Draw'}
        </Button>
      </div>
      <p className="text-[13px] text-ink-3">
        {drawOn ? (
          'Pick a pen and drag for an arrow, tap a square to mark it. Tap Done drawing to play moves again.'
        ) : (
          <>
            <span className="pointer-fine:hidden">Draw for the pens, or rest a finger on a square, then drag for an arrow or lift to mark it</span>
            <span className="hidden pointer-fine:inline">Right-drag for an arrow, right-click a square (hold Z, R, F or C for a colour)</span>
            {label ? `: kept with ${label}, shown when the answer is stepped there.` : ': kept with the starting position, shown once the answer is revealed.'}{' '}
            <span className="pointer-fine:hidden">A tap on the board clears them.</span>
            <span className="hidden pointer-fine:inline">A left click on the board clears them.</span>
          </>
        )}
      </p>
    </div>
  )
}

/**
 * A level's answer carried onto a new set-up: each move played from the
 * same square to the same square while it's still legal, its note kept.
 * `moves` is null while the set-up isn't a legal position (the answer waits).
 */
function carryLine(from: { fen: string; solution: SolutionMove[] }, nextFen: string): { moves: SolutionMove[] | null; note: string | null } {
  let after: Chess
  try {
    after = new Chess(nextFen)
  } catch {
    return { moves: null, note: 'Not a legal position yet: each side needs one king, and the side not to move can\'t be in check.' }
  }
  const before = new Chess(from.fen)
  const moves: SolutionMove[] = []
  for (const [i, m] of from.solution.entries()) {
    let played
    try {
      played = before.move(m.san)
    } catch {
      break
    }
    try {
      const res = after.move({ from: played.from, to: played.to, promotion: played.promotion })
      moves.push({ san: res.san, fen: after.fen(), ...moveExtras(m) })
    } catch {
      return { moves, note: `The answer stops at move ${i + 1} now (${m.san} can't be played): play the rest on the Answer tab.` }
    }
  }
  return { moves, note: moves.length ? `The answer still plays: ${moves.length === from.solution.length ? 'every move' : `${moves.length} moves`}.` : null }
}

/** How a level's answer compares with the position's own, for the line under the board. */
function lineSummary(line: SolutionMove[], original: SolutionMove[]): string | null {
  if (!line.length) return 'No answer yet: record it on the Answer tab.'
  const same = line.length === original.length && line.every((m, i) => m.san === original[i]?.san)
  return same ? 'The same answer as the position itself.' : `Its answer: ${line.map((m) => m.san).join(' ')}.`
}

/**
 * Under a level's set-up board: the pieces the position itself has that the
 * level doesn't, each a tap from going back on its square, and a way back to
 * the position whole.
 */
function PutBack({
  fen,
  original,
  note,
  onPut,
  onRestart,
}: {
  fen: string
  original: string
  note: string | null
  onPut: (square: string, code: PieceCode) => void
  onRestart: () => void
}) {
  const { pieces } = usePieceSet()
  const now = parsePlacement(fen)
  const missing = Object.entries(parsePlacement(original)).filter(([sq, code]) => code && now[sq] !== code) as [string, PieceCode][]
  return (
    <div className="mt-3 space-y-2">
      {note && <p className="text-[13.5px] font-medium text-ink-2">{note}</p>}
      {missing.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12px] font-semibold tracking-wider text-ink-3 uppercase">Put back from the position</p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map(([sq, code]) => {
              const Piece = pieces[code]
              return (
                <button
                  key={sq}
                  onClick={() => onPut(sq, code)}
                  title={`Put the piece back on ${sq}`}
                  className="inline-flex h-10 items-center gap-1 rounded-lg border border-line-strong bg-surface pr-2.5 pl-1 text-[14px] font-semibold text-ink transition hover:border-accent active:scale-95"
                >
                  <span className="block h-8 w-8">{Piece && <Piece />}</span>
                  {sq}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <Button variant="ghost" size="sm" onClick={onRestart}>
        Start again from the position itself
      </Button>
    </div>
  )
}
