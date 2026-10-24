import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import type { LevelId, Puzzle, PuzzleLevel } from '../types/domain'
import { useLesson, usePuzzle, usePuzzleMutations, useStudent, useTeachMissing } from '../lib/queries'
import { TEACH_MIGRATION } from '../lib/data'
import { normalizeFen } from '../lib/fen'
import { LEVELS, levelPuzzle, pieceCount, sharedSquares, withLevel, type LevelKey } from '../lib/levels'
import { suggestLevels, type Progress } from '../lib/deconstruct'
import { Board } from '../components/board/Board'
import { LevelMarks } from '../components/deconstruct/LevelMarks'
import { Card, LoadingPage, Page, Spinner } from '../components/ui/Page'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { MigrationNotice } from '../components/ui/MigrationNotice'
import { Check, Layers, Pencil, Play, Warning } from '../components/ui/Icons'
import teachSql from '../../supabase/migrations/0014_teach_and_levels.sql?raw'

/**
 * De-Construct: one position taught in three steps. Beginner is the idea
 * with the fewest pieces, Intermediate puts some back, Advanced is the
 * position itself; what's left stands on the same squares at every level, so
 * the student sees one pattern hiding in more and more pieces. The easier two
 * are suggested by taking pieces off while Stockfish checks the idea still
 * stands, then adjusted in the usual editor.
 */
export function DeconstructPage() {
  const { studentId = '', lessonPlanId = '', puzzleId = '' } = useParams()
  const navigate = useNavigate()
  const { data: student } = useStudent(studentId)
  const { data: lesson } = useLesson(lessonPlanId)
  const { data: puzzle, isLoading } = usePuzzle(puzzleId)
  const { update } = usePuzzleMutations(puzzleId, lessonPlanId)
  const missing = useTeachMissing()
  const [showCore, setShowCore] = useState(true)
  const [running, setRunning] = useState<Progress | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<'replace' | 'remove' | null>(null)
  const [tab, setTab] = useState<LevelKey>('beginner')
  const stop = useRef<AbortController | null>(null)
  useEffect(() => () => stop.current?.abort(), [])

  const base = `/students/${studentId}/lessons/${lessonPlanId}`
  if (isLoading && !puzzle) return <LoadingPage />
  if (!puzzle) return <Page back={base}>Position not found.</Page>

  const section = lesson?.sections.find((s) => s.id === puzzle.section_id)
  const back = `${base}/puzzles/${puzzle.id}`
  const levels = puzzle.levels ?? {}
  const any = Boolean(levels.beginner || levels.intermediate)

  async function suggest() {
    if (!puzzle) return
    setError(null)
    setNote(null)
    const controller = new AbortController()
    stop.current = controller
    setRunning({ looked: 0, candidates: 0, removed: 0, stage: 'start' })
    try {
      const result = await suggestLevels(puzzle, { onProgress: setRunning, signal: controller.signal })
      setNote(result.note ?? null)
      if (result.levels.beginner || result.levels.intermediate) update.mutate({ levels: result.levels })
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(null)
      stop.current = null
    }
  }

  // By hand: both start as the position itself, to take pieces off in the editor.
  function byHand() {
    if (!puzzle) return
    const copy = (): PuzzleLevel => ({
      starting_fen: normalizeFen(puzzle.starting_fen, puzzle.side_to_move),
      side_to_move: puzzle.side_to_move,
      label: puzzle.label,
      quiz_prompt: puzzle.quiz_prompt,
      summary: '',
      solution: puzzle.solution,
      arrows: [],
      highlights: [],
      made: { by: 'coach' },
    })
    update.mutate({ levels: { beginner: levels.beginner ?? copy(), intermediate: levels.intermediate ?? copy() } })
    navigate(`${back}/levels/beginner/edit`)
  }

  const run = LEVELS.map((l) => ({ ...l, puzzle: levelPuzzle(puzzle, l.key), present: l.key === 'advanced' || Boolean(levels[l.key as LevelId]) }))
  const core = levels.beginner ? normalizeFen(levels.beginner.starting_fen, levels.beginner.side_to_move) : null

  return (
    <Page
      back={back}
      eyebrow={[student?.name, lesson ? `Lesson ${lesson.plan.number}` : null, section?.title, puzzle.label].filter(Boolean).join(' · ')}
      title="De-Construct"
      width="full"
      actions={
        any ? (
          <>
            <Link to={`${base}/present?levels=${puzzle.id}`}>
              <Button variant="ghost" size="sm" icon={<Play size={16} />} aria-label="Present the three" title="Present the three">
                <span className="hidden sm:inline">Present</span>
              </Button>
            </Link>
            <Link to={`${base}/learn?levels=${puzzle.id}`}>
              <Button variant="ghost" size="sm" icon={<Check size={16} />} aria-label="Learn the three" title="Learn: solve the three in order">
                <span className="hidden sm:inline">Learn</span>
              </Button>
            </Link>
          </>
        ) : undefined
      }
    >
      {missing.data ? (
        <MigrationNotice file={TEACH_MIGRATION} sql={teachSql} adds="De-Construct (and Teach)" onCheck={() => void missing.refetch()} />
      ) : (
        <>
          <p className="mb-5 max-w-3xl text-[15px] text-on-bg-2">
            The same idea in three steps: the fewest pieces first, then more to see past. The pieces left stand on the same squares at every level, so the
            pattern a beginner learns is the one hiding in the full position.
          </p>

          {running ? (
            <Card className="mb-6 flex flex-wrap items-center gap-3 p-4">
              <Spinner className="h-5 w-5" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">{STAGE[running.stage]}</p>
                <p className="text-[13.5px] text-ink-2 tabular-nums">
                  Stockfish has looked at {running.looked} position{running.looked === 1 ? '' : 's'}
                  {running.candidates > 0 ? ` · ${running.removed} of ${running.candidates} pieces off so far` : ''}. Half a minute at most.
                </p>
              </div>
              <Button size="sm" onClick={() => stop.current?.abort()}>
                Stop
              </Button>
            </Card>
          ) : !any ? (
            <Card className="mb-6 p-5">
              <p className="text-[16px] font-semibold text-ink">Break it down</p>
              <p className="mt-1 text-[14px] text-ink-2">
                The app takes pieces off, furthest from the action first, and keeps a change only when Stockfish agrees {puzzle.solution[0]?.san ?? 'the answer'}{' '}
                still works and is still the move. Then adjust either version in the editor.
              </p>
              {puzzle.solution.length === 0 && <p className="mt-2 text-[14px] font-medium text-warn">Record the answer first: its first move is the idea that has to survive.</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" icon={<Layers size={18} />} disabled={puzzle.solution.length === 0} onClick={() => void suggest()}>
                  Suggest Beginner and Intermediate
                </Button>
                <Button icon={<Pencil size={18} />} onClick={byHand}>
                  Build them by hand
                </Button>
              </div>
            </Card>
          ) : null}

          {error && <p className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-[14px] text-warn">{error}</p>}
          {note && !running && <p className="mb-4 rounded-xl bg-surface-2 px-4 py-3 text-[14px] text-ink-2">{note}</p>}

          {any && (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  role="switch"
                  aria-checked={showCore}
                  onClick={() => setShowCore((v) => !v)}
                  className={clsx(
                    'inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[14px] font-semibold transition',
                    showCore ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line-strong text-on-bg-2 hover:text-on-bg',
                  )}
                >
                  <span className={clsx('block h-3.5 w-3.5 rounded-full', showCore ? 'shadow-[inset_0_0_0_2.5px_var(--accent)]' : 'shadow-[inset_0_0_0_2px_currentColor]')} />
                  Show the core
                </button>
                <span className="text-[13px] text-on-bg-2">Rings the Beginner's pieces on the harder boards.</span>
                <div className="flex-1" />
                <Button size="sm" variant="ghost" icon={<Layers size={16} />} disabled={Boolean(running) || puzzle.solution.length === 0} onClick={() => setConfirming('replace')}>
                  Suggest again
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming('remove')}>
                  Remove the levels
                </Button>
              </div>

              {/* A phone shows one level at a time. */}
              <div className="mb-3 flex gap-1 rounded-xl bg-surface-2 p-1 lg:hidden" role="tablist">
                {run.map((l) => (
                  <button
                    key={l.key}
                    role="tab"
                    aria-selected={tab === l.key}
                    onClick={() => setTab(l.key)}
                    className={clsx('h-10 flex-1 rounded-lg text-[14px] font-semibold transition', tab === l.key ? 'bg-surface text-ink shadow-card' : 'text-ink-2')}
                  >
                    {l.name}
                  </button>
                ))}
              </div>

              <div className="grid gap-5 lg:grid-cols-3">
                {run.map((l) => (
                  <LevelColumn
                    key={l.key}
                    className={tab === l.key ? '' : 'hidden lg:block'}
                    levelKey={l.key}
                    name={l.name}
                    blurb={l.blurb}
                    puzzle={l.puzzle}
                    level={l.key === 'advanced' ? undefined : levels[l.key as LevelId]}
                    present={l.present}
                    core={showCore && core && l.key !== 'beginner' ? sharedSquares(core, normalizeFen(l.puzzle.starting_fen, l.puzzle.side_to_move)) : []}
                    editTo={l.key === 'advanced' ? `${back}/edit` : `${back}/levels/${l.key}/edit`}
                    onBuild={() => {
                      const copy: PuzzleLevel = {
                        starting_fen: normalizeFen(puzzle.starting_fen, puzzle.side_to_move),
                        side_to_move: puzzle.side_to_move,
                        label: puzzle.label,
                        quiz_prompt: puzzle.quiz_prompt,
                        summary: '',
                        solution: puzzle.solution,
                        arrows: [],
                        highlights: [],
                        made: { by: 'coach' },
                      }
                      update.mutate({ levels: withLevel(levels, l.key as LevelId, copy) })
                      navigate(`${back}/levels/${l.key}/edit`)
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirming === 'replace'}
        title="Suggest them again?"
        body="The Beginner and Intermediate are replaced by new suggestions, and any changes you made to them go."
        confirmLabel="Suggest again"
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null)
          void suggest()
        }}
      />
      <ConfirmDialog
        open={confirming === 'remove'}
        title="Remove the easier versions?"
        body="The Beginner and Intermediate go; the position itself stays as it is."
        confirmLabel="Remove"
        danger
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          update.mutate({ levels: null })
          setConfirming(null)
        }}
      />
    </Page>
  )
}

const STAGE: Record<Progress['stage'], string> = {
  start: 'Getting Stockfish ready…',
  stripping: 'Taking pieces off, furthest from the action first…',
  intermediate: 'Finding the in-between…',
  checking: 'Looking again, deeper…',
}

function LevelColumn({
  levelKey,
  name,
  blurb,
  puzzle,
  level,
  present,
  core,
  editTo,
  onBuild,
  className,
}: {
  levelKey: LevelKey
  name: string
  blurb: string
  puzzle: Puzzle
  level?: PuzzleLevel
  present: boolean
  core: string[]
  editTo: string
  onBuild: () => void
  className?: string
}) {
  const fen = normalizeFen(puzzle.starting_fen, puzzle.side_to_move)
  const step = LEVELS.findIndex((l) => l.key === levelKey) + 1
  return (
    <section className={clsx('min-w-0', className)} aria-label={name}>
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-accent-ink">{step}</span>
        <h2 className="font-display text-[22px] leading-none font-bold text-on-bg">{name}</h2>
        {present && <span className="text-[13px] text-on-bg-2 tabular-nums">{pieceCount(fen)} pieces</span>}
        <div className="flex-1" />
        {level?.made?.by === 'engine' &&
          (level.made.checked ? (
            <span className="text-[12px] font-semibold text-accent-on-bg" title="A deeper Stockfish look agreed the idea holds">
              Checked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-warn" title="At a deeper look Stockfish wasn't sure the idea still holds">
              <Warning size={12} /> Check it
            </span>
          ))}
      </div>
      {present ? (
        <Card className="p-3">
          <LevelMarks core={core}>
            <Board fen={fen} orientation={puzzle.side_to_move === 'b' ? 'black' : 'white'} arrows={puzzle.arrows} highlights={puzzle.highlights} />
          </LevelMarks>
          <p className="mt-2.5 text-[13px] text-ink-3">{blurb}</p>
          {puzzle.solution.length > 0 && (
            <p className="mt-1.5 flex flex-wrap gap-1">
              {puzzle.solution.map((m, i) => (
                <span key={i} className={clsx('rounded-md px-1.5 py-0.5 font-mono text-[13px] font-semibold', i === 0 ? 'bg-accent-soft text-accent-strong' : 'bg-surface-2 text-ink-2')}>
                  {m.san}
                </span>
              ))}
            </p>
          )}
          {puzzle.quiz_prompt && <p className="mt-2 text-[14px] text-ink-2">{puzzle.quiz_prompt}</p>}
          <div className="mt-3">
            <Link to={editTo}>
              <Button size="sm" icon={<Pencil size={15} />}>
                {levelKey === 'advanced' ? 'Edit the position' : `Edit ${name}`}
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="grid aspect-square place-items-center p-6 text-center">
          <div>
            <p className="text-[15px] font-semibold text-ink">No {name}</p>
            <p className="mt-1 text-[13.5px] text-ink-2">Nothing between the two held the idea. Make one from the position by hand.</p>
            <Button size="sm" className="mt-3" icon={<Pencil size={15} />} onClick={onBuild}>
              Build {name} by hand
            </Button>
          </div>
        </Card>
      )}
    </section>
  )
}
