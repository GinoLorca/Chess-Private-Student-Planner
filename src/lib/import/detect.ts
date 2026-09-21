import type { DetectedInput } from './types'

const FEN_RE = /^([rnbqkpRNBQKP1-8]{1,8}\/){7}[rnbqkpRNBQKP1-8]{1,8}(\s+[wb](\s+(-|[KQkq]{1,4})(\s+(-|[a-h][36])(\s+\d+(\s+\d+)?)?)?)?)?$/

/**
 * Work out what the coach pasted. Order matters: URLs first (a Lichess study
 * URL also contains an 8-character id that would look like a game), then
 * FEN, then PGN as the catch-all for anything with moves in it.
 */
export function detectInput(raw: string): DetectedInput {
  const text = raw.trim()
  if (!text) return { kind: 'unknown' }

  const url = tryUrl(text)
  if (url) {
    const host = url.hostname.replace(/^www\./, '')
    const parts = url.pathname.split('/').filter(Boolean)

    if (host === 'lichess.org') {
      if (parts[0] === 'training' && parts.length >= 2) {
        // lichess.org/training/{id} or lichess.org/training/{theme}/{id}
        return { kind: 'lichess_puzzle', id: parts[parts.length - 1], url: url.toString() }
      }
      if (parts[0] === 'study' && parts[1]) {
        return { kind: 'lichess_study', studyId: parts[1], chapterId: parts[2], url: url.toString() }
      }
      if (parts[0] && /^[A-Za-z0-9]{8,12}$/.test(parts[0])) {
        // lichess.org/{gameId}, optionally /black or a 12-char player-specific id
        return { kind: 'lichess_game', id: parts[0].slice(0, 8), url: url.toString() }
      }
    }

    if (host === 'chess.com') {
      // chess.com/game/live/123, chess.com/game/daily/123, chess.com/analysis/game/live/123
      const idx = parts.findIndex((p) => p === 'live' || p === 'daily')
      if (idx >= 0 && parts[idx + 1]) return { kind: 'chesscom_game', url: url.toString(), id: parts[idx + 1] }
    }
  }

  if (FEN_RE.test(text)) return { kind: 'fen', fen: text }

  // Bare Lichess puzzle ids are 5 alphanumerics.
  if (/^[A-Za-z0-9]{5}$/.test(text)) {
    return { kind: 'lichess_puzzle', id: text, url: `https://lichess.org/training/${text}` }
  }

  if (/\[\w+\s+"/.test(text) || /\b\d+\.(\.\.)?\s*[a-hNBRQKO]/.test(text)) return { kind: 'pgn', pgn: text }

  return { kind: 'unknown' }
}

function tryUrl(text: string): URL | null {
  if (!/^https?:\/\//i.test(text) && !/^(www\.)?(lichess\.org|chess\.com)\//i.test(text)) return null
  try {
    return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
}

export function describeDetected(d: DetectedInput): string {
  switch (d.kind) {
    case 'lichess_puzzle':
      return `Lichess puzzle ${d.id}`
    case 'lichess_study':
      return d.chapterId ? 'Lichess study chapter' : 'Lichess study'
    case 'lichess_game':
      return `Lichess game ${d.id}`
    case 'chesscom_game':
      return 'Chess.com game'
    case 'fen':
      return 'FEN position'
    case 'pgn':
      return 'PGN moves'
    default:
      return 'Not recognised'
  }
}
