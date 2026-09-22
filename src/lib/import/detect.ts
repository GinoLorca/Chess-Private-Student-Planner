import type { DetectedInput } from './types'

// A FEN anywhere in a line: the placement, then whichever of the other fields
// are present. Whatever follows (moves, a dash, a note) is kept as the rest.
const FEN_ANYWHERE_RE =
  /(?:^|[\s"'`(:])((?:[rnbqkpRNBQKP1-8]{1,8}\/){7}[rnbqkpRNBQKP1-8]{1,8})(?:\s+([wb])(?:\s+(-|[KQkq]{1,4})(?:\s+(-|[a-h][36])(?:\s+(\d+)(?:\s+(\d+))?)?)?)?)?(?![\w/])/

/**
 * Find the FEN in a line, plus anything after it: "6k1/... w - - 0 1 1. Rd8#"
 * is a position with its answer line, and "FEN: ..." or a quoted FEN still
 * counts. Returns null when there is no FEN.
 */
export function extractFen(text: string): { fen: string; rest: string } | null {
  const m = FEN_ANYWHERE_RE.exec(text)
  if (!m) return null
  const fen = m.slice(1).filter(Boolean).join(' ')
  const rest = text
    .slice(m.index + m[0].length)
    .replace(/^["'`)\]]+/, '')
    .replace(/^[\s\-–—:;,|]+/, '')
    .trim()
  return { fen, rest }
}

/** The moves after a FEN, as SAN tokens: move numbers, dots and result markers dropped. */
export function movesFromRest(rest: string): string[] {
  return rest
    .replace(/\{[^}]*\}/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.+/, ''))
    .filter((t) => t && !/^\d+\.*$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*|…|\.\.\.)$/.test(t))
}

/**
 * Work out what the coach pasted. Order matters: URLs first (a Lichess study
 * URL also contains an 8-character id that would look like a game), then PGN
 * with headers (its FEN tag must not be mistaken for a bare FEN), then a FEN
 * anywhere in the line with any moves after it, then movetext as the
 * catch-all for anything with moves in it.
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

  // PGN with headers: the [FEN "..."] tag belongs to the game, not on its own.
  if (/\[\w+\s+"/.test(text)) return { kind: 'pgn', pgn: text }

  const found = extractFen(text)
  if (found) {
    const moves = movesFromRest(found.rest)
    return moves.length ? { kind: 'fen', fen: found.fen, moves } : { kind: 'fen', fen: found.fen }
  }

  // Bare Lichess puzzle ids are 5 alphanumerics.
  if (/^[A-Za-z0-9]{5}$/.test(text)) {
    return { kind: 'lichess_puzzle', id: text, url: `https://lichess.org/training/${text}` }
  }

  if (/\b\d+\.(\.\.)?\s*[a-hNBRQKO]/.test(text)) return { kind: 'pgn', pgn: text }

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
      return d.moves ? `FEN + answer (${d.moves.length} move${d.moves.length === 1 ? '' : 's'})` : 'FEN position'
    case 'pgn':
      return 'PGN moves'
    default:
      return 'Not recognised'
  }
}
