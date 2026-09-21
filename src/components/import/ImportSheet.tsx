import { useMemo, useState } from 'react'
import clsx from 'clsx'
import type { ImportedGame, ImportedPosition } from '../../lib/import'
import {
  LICHESS_THEMES,
  describeDetected,
  detectInput,
  fetchLichessPuzzle,
  moveLabel,
  positionFromGame,
  resolveInput,
} from '../../lib/import'
import { usePieceSet } from '../../state/PieceSetContext'
import { Board } from '../board/Board'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Page'
import { ChevronLeft, ChevronRight } from '../ui/Icons'

interface ImportSheetProps {
  open: boolean
  onClose: () => void
  /** Resolves when the position has been saved; the sheet then offers to add another. */
  onImport: (position: ImportedPosition) => Promise<void>
  mode: 'add' | 'replace'
}

type Stage =
  | { kind: 'input' }
  | { kind: 'loading'; note: string }
  | { kind: 'position'; position: ImportedPosition; fromTheme?: string }
  | { kind: 'game'; games: ImportedGame[]; gameIndex: number; ply: number; length: number }

/**
 * Quick Add: paste anything — a Lichess puzzle/study/game link, a Chess.com
 * game link, a FEN, PGN — or browse Lichess puzzles by theme, preview, and add.
 * For games and studies, scrub to the moment and the puzzle is cut from there.
 */
export function ImportSheet({ open, onClose, onImport, mode }: ImportSheetProps) {
  const { settings } = usePieceSet()
  const [text, setText] = useState('')
  const [stage, setStage] = useState<Stage>({ kind: 'input' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState(0)
  const detected = useMemo(() => detectInput(text), [text])

  function reset() {
    setText('')
    setStage({ kind: 'input' })
    setError(null)
  }

  function close() {
    reset()
    setAdded(0)
    onClose()
  }

  async function run(work: () => Promise<Stage>, note: string) {
    setError(null)
    setStage({ kind: 'loading', note })
    try {
      setStage(await work())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStage({ kind: 'input' })
    }
  }

  function preview() {
    run(async () => {
      const outcome = await resolveInput(detected, { chesscomUsername: settings?.chesscom_username })
      if (outcome.type === 'position') return { kind: 'position', position: outcome.position }
      return { kind: 'game', games: outcome.games, gameIndex: 0, ply: defaultPly(outcome.games[0]), length: 1 }
    }, `Fetching ${describeDetected(detected).toLowerCase()}…`)
  }

  function browseTheme(themeId: string) {
    run(
      async () => ({ kind: 'position', position: await fetchLichessPuzzle(undefined, themeId), fromTheme: themeId }),
      'Asking Lichess for a puzzle…',
    )
  }

  async function commit(position: ImportedPosition) {
    setSaving(true)
    try {
      await onImport(position)
      setAdded((n) => n + 1)
      if (mode === 'replace') close()
      else reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title={mode === 'add' ? 'Quick add' : 'Import into this position'}>
      {stage.kind === 'input' && (
        <div className="space-y-4">
          {added > 0 && (
            <p className="rounded-xl bg-accent-soft px-3 py-2 text-[14px] font-medium text-accent-strong">
              Added {added} position{added === 1 ? '' : 's'}. Paste another, or close.
            </p>
          )}
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a Lichess or Chess.com link, a FEN, or PGN moves…"
              rows={3}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 py-3 font-mono text-[13px] leading-relaxed outline-none focus:border-accent"
            />
            <div className="mt-2 flex items-center gap-3">
              <span
                className={clsx(
                  'text-[13px] font-medium',
                  detected.kind === 'unknown' ? 'text-ink-3' : 'text-accent-strong',
                )}
              >
                {text.trim() ? describeDetected(detected) : 'Links, FEN and PGN are recognised automatically'}
              </span>
              <div className="flex-1" />
              <Button variant="primary" size="sm" disabled={detected.kind === 'unknown'} onClick={preview}>
                Preview
              </Button>
            </div>
          </div>

          {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}

          <div>
            <p className="mb-2 text-[12px] font-semibold tracking-wider text-ink-3 uppercase">Or a Lichess puzzle by theme</p>
            <div className="flex flex-wrap gap-1.5">
              {LICHESS_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => browseTheme(t.id)}
                  className="h-9 rounded-full border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink-2 transition hover:border-accent hover:text-accent-strong active:scale-95"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {stage.kind === 'loading' && (
        <div className="flex items-center gap-3 py-8">
          <Spinner />
          <span className="text-[15px] text-ink-2">{stage.note}</span>
        </div>
      )}

      {stage.kind === 'position' && (
        <PositionPreview
          position={stage.position}
          saving={saving}
          error={error}
          actionLabel={mode === 'add' ? 'Add to lesson' : 'Use this position'}
          onBack={reset}
          onAnother={stage.fromTheme ? () => browseTheme(stage.fromTheme!) : undefined}
          onCommit={() => commit(stage.position)}
        />
      )}

      {stage.kind === 'game' && (
        <GamePicker
          stage={stage}
          onChange={(next) => setStage(next)}
          saving={saving}
          error={error}
          actionLabel={mode === 'add' ? 'Add to lesson' : 'Use this position'}
          onBack={reset}
          onCommit={() => commit(positionFromGame(stage.games[stage.gameIndex], stage.ply, stage.length))}
        />
      )}
    </Modal>
  )
}

/** Studies usually annotate the start; games are more interesting later on. Start there. */
function defaultPly(game: ImportedGame | undefined): number {
  if (!game) return 0
  if (game.headers.FEN) return 0
  return Math.min(game.moves.length, 20)
}

function PositionPreview({
  position,
  saving,
  error,
  actionLabel,
  onBack,
  onAnother,
  onCommit,
}: {
  position: ImportedPosition
  saving: boolean
  error: string | null
  actionLabel: string
  onBack: () => void
  onAnother?: () => void
  onCommit: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="mx-auto w-full max-w-[360px]">
        <Board
          fen={position.fen}
          arrows={position.arrows}
          highlights={position.highlights}
          orientation={position.side === 'b' ? 'black' : 'white'}
        />
      </div>
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-semibold text-ink">{position.side === 'w' ? 'White' : 'Black'} to play</p>
        {position.solution.length > 0 && (
          <p className="font-mono text-[14px] text-ink-2">{position.solution.map((m) => m.san).join(' ')}</p>
        )}
      </div>
      {position.themes && position.themes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {position.themes.map((t) => (
            <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] text-ink-2">
              {t}
            </span>
          ))}
        </div>
      )}
      {position.referenceLabel && <p className="text-[13px] text-ink-3">{position.referenceLabel}</p>}
      {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        {onAnother && (
          <Button variant="secondary" onClick={onAnother}>
            Another
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="primary" onClick={onCommit} disabled={saving}>
          {saving ? 'Saving…' : actionLabel}
        </Button>
      </div>
    </div>
  )
}

function GamePicker({
  stage,
  onChange,
  saving,
  error,
  actionLabel,
  onBack,
  onCommit,
}: {
  stage: Extract<Stage, { kind: 'game' }>
  onChange: (next: Extract<Stage, { kind: 'game' }>) => void
  saving: boolean
  error: string | null
  actionLabel: string
  onBack: () => void
  onCommit: () => void
}) {
  const game = stage.games[stage.gameIndex]
  const position = positionFromGame(game, stage.ply, stage.length)
  const setPly = (ply: number) => onChange({ ...stage, ply: Math.max(0, Math.min(game.moves.length, ply)) })
  const maxLength = Math.max(1, game.moves.length - stage.ply)

  return (
    <div className="space-y-3">
      {stage.games.length > 1 && (
        <select
          value={stage.gameIndex}
          onChange={(e) => {
            const gameIndex = Number(e.target.value)
            onChange({ ...stage, gameIndex, ply: defaultPly(stage.games[gameIndex]), length: 1 })
          }}
          className="h-11 w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-[15px]"
        >
          {stage.games.map((g, i) => (
            <option key={i} value={i}>
              {g.referenceLabel ?? `Game ${i + 1}`}
            </option>
          ))}
        </select>
      )}

      <div className="mx-auto w-full max-w-[360px]">
        <Board
          fen={position.fen}
          arrows={position.arrows}
          highlights={position.highlights}
          orientation={position.side === 'b' ? 'black' : 'white'}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setPly(stage.ply - 1)} disabled={stage.ply === 0} icon={<ChevronLeft size={16} />}>
          Prev
        </Button>
        <p className="flex-1 text-center text-[14px] font-semibold text-ink">
          {position.side === 'w' ? 'White' : 'Black'} to play
          <span className="ml-2 font-normal text-ink-3">
            {stage.ply === 0 ? 'start' : `after ${moveLabel(game.startFen, stage.ply)} ${game.moves[stage.ply - 1].san}`}
          </span>
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setPly(stage.ply + 1)}
          disabled={stage.ply >= game.moves.length}
          icon={<ChevronRight size={16} />}
        >
          Next
        </Button>
      </div>

      <div className="max-h-28 overflow-y-auto rounded-xl bg-surface-2 p-2">
        <div className="flex flex-wrap gap-x-1 gap-y-1 font-mono text-[13px]">
          {game.moves.map((m, i) => (
            <button
              key={i}
              onClick={() => setPly(i)}
              className={clsx(
                'rounded-md px-1.5 py-0.5',
                i === stage.ply ? 'bg-accent text-accent-ink' : i < stage.ply ? 'text-ink-3' : 'text-ink hover:bg-surface-3',
              )}
              title={`Start the puzzle before ${m.san}`}
            >
              {i % 2 === 0 || i === 0 ? `${moveLabel(game.startFen, i + 1)} ` : ''}
              {m.san}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[13px] text-ink-2">Answer length</span>
        <div className="flex rounded-xl bg-surface-2 p-1">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              disabled={n > maxLength}
              onClick={() => onChange({ ...stage, length: n })}
              className={clsx(
                'h-8 w-8 rounded-lg text-[13px] font-semibold disabled:opacity-30',
                stage.length === n ? 'bg-surface text-ink shadow-card' : 'text-ink-2',
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="font-mono text-[13px] text-ink-2">{position.solution.map((m) => m.san).join(' ')}</span>
      </div>

      {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex-1" />
        <Button variant="primary" onClick={onCommit} disabled={saving || position.solution.length === 0}>
          {saving ? 'Saving…' : actionLabel}
        </Button>
      </div>
    </div>
  )
}
