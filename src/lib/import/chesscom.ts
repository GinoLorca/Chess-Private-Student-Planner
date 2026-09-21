import type { ImportedGame } from './types'
import { parsePgn } from './pgn'

const API = 'https://api.chess.com/pub'

interface ArchiveGame {
  url: string
  pgn: string
  end_time: number
  white: { username: string }
  black: { username: string }
}

/**
 * Chess.com has no per-game endpoint, only monthly archives per player, so a
 * game link is resolved by scanning the coach's recent months for that URL.
 * Most lesson material is from the last few weeks, so this is usually one request.
 */
export async function fetchChesscomGame(username: string, gameUrl: string, gameId: string): Promise<ImportedGame> {
  if (!username) throw new Error('Add your Chess.com username in Settings so I can find your games.')
  const user = username.trim().toLowerCase()
  const now = new Date()
  const monthsBack = 12
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const res = await fetch(`${API}/player/${encodeURIComponent(user)}/games/${yyyy}/${mm}`)
    if (res.status === 404) {
      if (i === 0) throw new Error(`No Chess.com games found for "${username}" — check the username in Settings.`)
      continue
    }
    if (!res.ok) throw new Error(`Chess.com replied ${res.status}.`)
    const data = (await res.json()) as { games: ArchiveGame[] }
    const match = data.games.find((g) => g.url.endsWith(`/${gameId}`) || g.url === gameUrl)
    if (match) {
      const game = parsePgn(match.pgn, { kind: 'chesscom_game', id: gameId, url: match.url })
      return { ...game, referenceUrl: match.url }
    }
  }
  throw new Error(`That game isn't in ${username}'s last ${monthsBack} months of Chess.com archives.`)
}

/** The most recent games, newest first — for a "pick a game" browser. */
export async function fetchChesscomRecentGames(username: string, limit = 30): Promise<ArchiveGame[]> {
  const user = username.trim().toLowerCase()
  const out: ArchiveGame[] = []
  const now = new Date()
  for (let i = 0; i < 3 && out.length < limit; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const res = await fetch(`${API}/player/${encodeURIComponent(user)}/games/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`)
    if (!res.ok) continue
    const data = (await res.json()) as { games: ArchiveGame[] }
    out.push(...data.games.reverse())
  }
  return out.slice(0, limit)
}
