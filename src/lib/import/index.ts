import { Chess } from 'chess.js'
import type { SolutionMove } from '../../types/domain'
import type { PuzzlePatch } from '../api'
import { normalizeFen, sideToMoveOf } from '../fen'
import { fetchLichessGame, fetchLichessPuzzle, fetchLichessStudy } from './lichess'
import { fetchChesscomGame } from './chesscom'
import { parsePgn } from './pgn'
import type { DetectedInput, ImportedGame, ImportedPosition } from './types'

export * from './types'
export { detectInput, describeDetected } from './detect'
export { LICHESS_THEMES, fetchCloudEval, fetchLichessPuzzle } from './lichess'
export { parsePgn, positionsOf, moveLabel } from './pgn'

export type ImportOutcome = { type: 'position'; position: ImportedPosition } | { type: 'game'; games: ImportedGame[] }

/**
 * Resolve any pasted input into either a ready-to-use position or a game the
 * coach picks a moment from. Network sources throw readable errors.
 */
export async function resolveInput(
  detected: DetectedInput,
  opts: { chesscomUsername?: string } = {},
): Promise<ImportOutcome> {
  switch (detected.kind) {
    case 'lichess_puzzle':
      return { type: 'position', position: await fetchLichessPuzzle(detected.id) }
    case 'lichess_study':
      return { type: 'game', games: await fetchLichessStudy(detected.studyId, detected.chapterId, detected.url) }
    case 'lichess_game':
      return { type: 'game', games: [await fetchLichessGame(detected.id, detected.url)] }
    case 'chesscom_game':
      return { type: 'game', games: [await fetchChesscomGame(opts.chesscomUsername ?? '', detected.url, detected.id)] }
    case 'fen': {
      const fen = normalizeFen(detected.fen)
      // Moves after the FEN are the answer; they must play from the position.
      const { moves, error } = detected.moves ? replayLine(fen, detected.moves) : { moves: [] }
      if (error) throw new Error(`The moves after the FEN don't play from it: ${error}`)
      return {
        type: 'position',
        position: {
          fen,
          side: sideToMoveOf(fen),
          solution: moves,
          arrows: [],
          highlights: [],
          label: moves[0]?.san ?? '',
          source: { kind: 'fen' },
        },
      }
    }
    case 'pgn':
      return { type: 'game', games: [parsePgn(detected.pgn, { kind: 'pgn' })] }
    default:
      throw new Error("I don't recognise that. Paste a Lichess or Chess.com link, a FEN, or PGN moves.")
  }
}

/**
 * Turn a moment in a game into a puzzle: the position before `ply`, and the
 * moves actually played from there as the solution (the coach trims them).
 */
export function positionFromGame(game: ImportedGame, ply: number, solutionLength = 1): ImportedPosition {
  const fenBefore = ply === 0 ? game.startFen : game.moves[ply - 1].fen
  const fen = normalizeFen(fenBefore)
  const side = sideToMoveOf(fen)
  const solution: SolutionMove[] = game.moves.slice(ply, ply + solutionLength).map((m) => ({
    san: m.san,
    fen: m.fen,
    comment: m.comment,
  }))
  // Arrows drawn on the position itself (study-style) belong to the puzzle.
  const at = ply === 0 ? { arrows: game.startArrows, highlights: game.startHighlights, comment: game.startComment } : game.moves[ply - 1]
  return {
    fen,
    side,
    solution,
    arrows: at.arrows,
    highlights: at.highlights,
    label: solution[0]?.san ?? '',
    summary: at.comment,
    referenceUrl: game.referenceUrl,
    referenceLabel: game.referenceLabel,
    source: { ...game.source, ply },
  }
}

/** The fields an imported position fills in on a puzzle row. */
export function patchFromImported(p: ImportedPosition): PuzzlePatch {
  return {
    label: p.label,
    starting_fen: p.fen,
    side_to_move: p.side,
    arrows: p.arrows,
    highlights: p.highlights,
    solution: p.solution,
    quiz_prompt: p.quizPrompt ?? '',
    summary: p.summary ?? '',
    reference_url: p.referenceUrl ?? null,
    reference_label: p.referenceLabel ?? null,
    source: p.source,
    themes: p.themes ?? [],
  }
}

/** Validate a hand-typed SAN line against a position; returns moves with resulting FENs. */
export function replayLine(fen: string, sans: string[]): { moves: SolutionMove[]; error?: string } {
  const chess = new Chess(normalizeFen(fen))
  const moves: SolutionMove[] = []
  for (const san of sans) {
    try {
      const move = chess.move(san)
      moves.push({ san: move.san, fen: chess.fen() })
    } catch {
      return { moves, error: `"${san}" isn't a legal move here.` }
    }
  }
  return { moves }
}
