import { detectInput, describeDetected } from './detect'
import { splitPgnGames } from './lichess'
import { positionFromGame, resolveInput } from './index'
import type { DetectedInput, ImportedGame, ImportedPosition } from './types'

/**
 * Batch intake: many things pasted at once. A multi-game PGN splits into its
 * games; anything else splits into lines (and space-separated links on a
 * line), each recognised on its own. Unknown lines are reported, not dropped
 * silently.
 */
export function splitBatch(raw: string): { items: DetectedInput[]; unknown: string[] } {
  const text = raw.trim()
  if (!text) return { items: [], unknown: [] }

  // PGN with headers: one item per game, however it's spread across lines.
  if (/^\s*\[\w+\s+"/.test(text) && /\n/.test(text)) {
    const games = splitPgnGames(text)
    if (games.length > 0) return { items: games.map((pgn) => ({ kind: 'pgn', pgn })), unknown: [] }
  }

  const items: DetectedInput[] = []
  const unknown: string[] = []
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // Several links on one line are several items; a FEN or movetext stays whole.
    const pieces = /https?:\/\/\S+\s+https?:\/\//.test(trimmed) ? trimmed.split(/\s+/) : [trimmed]
    for (const piece of pieces) {
      const d = detectInput(piece)
      if (d.kind === 'unknown') unknown.push(piece)
      else items.push(d)
    }
  }
  return { items, unknown }
}

/** True when what's pasted is more than one position's worth. */
export function isBatch(raw: string): boolean {
  const { items } = splitBatch(raw)
  if (items.length > 1) return true
  return items.length === 1 && items[0].kind === 'lichess_study' && !items[0].chapterId
}

export interface BatchItemResult {
  input: DetectedInput
  label: string
  positions: ImportedPosition[]
  /** Why nothing came of it, when positions is empty. */
  note?: string
}

/**
 * A study chapter or a puzzle-style PGN (one that starts from a set-up
 * position) is a puzzle already: the start is the position and the whole line
 * is the answer. A full game from move one needs the coach to pick the
 * moment, so it's left out with a note rather than guessed.
 */
export function autoPositionsFromGames(games: ImportedGame[]): { positions: ImportedPosition[]; skipped: number } {
  const positions: ImportedPosition[] = []
  let skipped = 0
  for (const game of games) {
    if (!game.headers.FEN || game.moves.length === 0) {
      skipped++
      continue
    }
    const p = positionFromGame(game, 0, game.moves.length)
    positions.push({ ...p, label: p.label || game.moves[0].san })
  }
  return { positions, skipped }
}

export async function resolveBatchItem(
  input: DetectedInput,
  opts: { chesscomUsername?: string } = {},
): Promise<BatchItemResult> {
  const label = describeDetected(input)
  try {
    const outcome = await resolveInput(input, opts)
    if (outcome.type === 'position') return { input, label, positions: [outcome.position] }
    const { positions, skipped } = autoPositionsFromGames(outcome.games)
    if (positions.length === 0) {
      return {
        input,
        label,
        positions,
        note: skipped > 0 ? 'A full game — open it on its own to pick the moment.' : 'Nothing to import.',
      }
    }
    return {
      input,
      label,
      positions,
      note: skipped > 0 ? `${skipped} full game${skipped === 1 ? '' : 's'} skipped — pick those moments one at a time.` : undefined,
    }
  } catch (e) {
    return { input, label, positions: [], note: e instanceof Error ? e.message : String(e) }
  }
}
