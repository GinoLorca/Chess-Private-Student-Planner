import { Chess } from 'chess.js'
import type { SolutionMove } from '../../types/domain'
import type { ImportedGame, ImportedPosition } from './types'
import { parsePgn } from './pgn'

const API = 'https://lichess.org'

// Lichess's public API answers browser requests directly (CORS enabled) and
// needs no token for any of these reads. Rate limit is generous for one coach.

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } })
  if (res.status === 404) throw new Error('Not found on Lichess — check the link.')
  if (res.status === 429) throw new Error('Lichess is rate-limiting requests. Wait a minute and try again.')
  if (!res.ok) throw new Error(`Lichess replied ${res.status}.`)
  return (await res.json()) as T
}

async function getText(path: string): Promise<string> {
  const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/x-chess-pgn' } })
  if (res.status === 404) throw new Error('Not found on Lichess — check the link (private studies need to be public).')
  if (res.status === 429) throw new Error('Lichess is rate-limiting requests. Wait a minute and try again.')
  if (!res.ok) throw new Error(`Lichess replied ${res.status}.`)
  return res.text()
}

interface LichessPuzzle {
  game: { id: string; pgn: string; players?: { name: string; color: string }[] }
  puzzle: { id: string; rating: number; solution: string[]; themes: string[]; initialPly: number }
}

/** A puzzle by id, or the daily one, or the next one of a theme ("angle"). */
export async function fetchLichessPuzzle(id?: string, angle?: string): Promise<ImportedPosition> {
  const path = id ? `/api/puzzle/${id}` : angle ? `/api/puzzle/next?angle=${encodeURIComponent(angle)}` : '/api/puzzle/daily'
  const data = await getJson<LichessPuzzle>(path)
  return lichessPuzzleToPosition(data)
}

export function lichessPuzzleToPosition(data: LichessPuzzle): ImportedPosition {
  // The puzzle position is the game after the move at initialPly has been played.
  const chess = new Chess()
  const sans = data.game.pgn.trim().split(/\s+/)
  for (let i = 0; i <= data.puzzle.initialPly && i < sans.length; i++) chess.move(sans[i])
  const fen = chess.fen()
  const side = chess.turn()

  const solution: SolutionMove[] = []
  for (const uci of data.puzzle.solution) {
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    solution.push({ san: move.san, fen: chess.fen() })
  }

  const url = `https://lichess.org/training/${data.puzzle.id}`
  return {
    fen,
    side,
    solution,
    arrows: [],
    highlights: [],
    label: solution[0]?.san ?? data.puzzle.id,
    referenceUrl: url,
    referenceLabel: `Lichess puzzle ${data.puzzle.id} (${data.puzzle.rating})`,
    source: { kind: 'lichess_puzzle', id: data.puzzle.id, url, rating: data.puzzle.rating },
    themes: data.puzzle.themes,
  }
}

/** One chapter of a study as an annotated game. Without a chapter id, the first chapter. */
export async function fetchLichessStudy(studyId: string, chapterId?: string, url?: string): Promise<ImportedGame[]> {
  const path = chapterId
    ? `/api/study/${studyId}/${chapterId}.pgn?comments=true&variations=false`
    : `/api/study/${studyId}.pgn?comments=true&variations=false`
  const text = await getText(path)
  const games = splitPgnGames(text)
  return games
    .map((pgn) =>
      parsePgn(pgn, { kind: 'lichess_study', id: chapterId ?? studyId, url: url ?? `https://lichess.org/study/${studyId}` }),
    )
    .map((g, i) => ({ ...g, referenceLabel: g.headers.ChapterName ?? g.headers.Event ?? `Chapter ${i + 1}` }))
}

export async function fetchLichessGame(gameId: string, url?: string): Promise<ImportedGame> {
  const text = await getText(`/game/export/${gameId}?evals=false&clocks=false&opening=false`)
  const game = parsePgn(text, { kind: 'lichess_game', id: gameId, url: url ?? `https://lichess.org/${gameId}` })
  return { ...game, referenceUrl: url ?? `https://lichess.org/${gameId}` }
}

export interface CloudEval {
  depth: number
  /** Centipawns from White's point of view, or undefined when `mate` is set. */
  cp?: number
  mate?: number
  /** Principal variation in SAN, from the queried position. */
  line: SolutionMove[]
}

/**
 * Lichess's cloud evaluation: Stockfish lines other users have already
 * computed for this exact position. Free, instant, no key — but only present
 * for positions somebody has analysed, so a miss is normal for a hand-made puzzle.
 */
export async function fetchCloudEval(fen: string): Promise<CloudEval | null> {
  const res = await fetch(`${API}/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`, {
    headers: { Accept: 'application/json' },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Lichess replied ${res.status}.`)
  const data = (await res.json()) as { depth: number; pvs: { moves: string; cp?: number; mate?: number }[] }
  const pv = data.pvs[0]
  if (!pv) return null
  const chess = new Chess(fen)
  const line: SolutionMove[] = []
  for (const uci of pv.moves.split(' ').slice(0, 6)) {
    try {
      const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      line.push({ san: move.san, fen: chess.fen() })
    } catch {
      break
    }
  }
  return { depth: data.depth, cp: pv.cp, mate: pv.mate, line }
}

export function splitPgnGames(text: string): string[] {
  return text
    .split(/\n\s*\n(?=\[)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .reduce<string[]>((acc, chunk) => {
      // A game is a header block followed by a movetext block; glue them back together.
      const last = acc[acc.length - 1]
      if (last && !/\n\s*\n/.test(last) && /^\[/.test(last) && !/^\[/.test(chunk)) acc[acc.length - 1] = `${last}\n\n${chunk}`
      else acc.push(chunk)
      return acc
    }, [])
}

/** Lichess puzzle themes worth browsing by, in the coach's words. */
export const LICHESS_THEMES: { id: string; label: string }[] = [
  { id: 'mix', label: 'Healthy mix' },
  { id: 'fork', label: 'Fork' },
  { id: 'pin', label: 'Pin' },
  { id: 'skewer', label: 'Skewer' },
  { id: 'discoveredAttack', label: 'Discovered attack' },
  { id: 'doubleCheck', label: 'Double check' },
  { id: 'backRankMate', label: 'Back-rank mate' },
  { id: 'smotheredMate', label: 'Smothered mate' },
  { id: 'mateIn1', label: 'Mate in 1' },
  { id: 'mateIn2', label: 'Mate in 2' },
  { id: 'mateIn3', label: 'Mate in 3' },
  { id: 'hangingPiece', label: 'Hanging piece' },
  { id: 'trappedPiece', label: 'Trapped piece' },
  { id: 'defensiveMove', label: 'Defensive move' },
  { id: 'quietMove', label: 'Quiet move' },
  { id: 'zugzwang', label: 'Zugzwang' },
  { id: 'sacrifice', label: 'Sacrifice' },
  { id: 'deflection', label: 'Deflection' },
  { id: 'attraction', label: 'Attraction' },
  { id: 'clearance', label: 'Clearance' },
  { id: 'interference', label: 'Interference' },
  { id: 'xRayAttack', label: 'X-ray' },
  { id: 'promotion', label: 'Promotion' },
  { id: 'endgame', label: 'Endgame' },
  { id: 'rookEndgame', label: 'Rook endgame' },
  { id: 'pawnEndgame', label: 'Pawn endgame' },
  { id: 'middlegame', label: 'Middlegame' },
  { id: 'opening', label: 'Opening' },
]
