import { Chess } from 'chess.js'
import type { BoardArrow, BoardHighlight, PuzzleSource } from '../../types/domain'
import { sideToMoveOf } from '../fen'
import type { ImportedGame, ImportedMove } from './types'

// Lichess/ChessBase annotation colours. These are the colours the coach sees on
// lichess.org, so a study imported here looks the same as it did there.
export const PEN_COLORS = {
  G: '#15781b',
  R: '#882020',
  B: '#003088',
  Y: '#e68f00',
} as const
export type PenLetter = keyof typeof PEN_COLORS

export const HIGHLIGHT_ALPHA = '99'

/** Pull `[%cal Ge2e4,Rd1d8]` arrows and `[%csl Ge4]` highlights out of a PGN comment. */
export function parseAnnotations(comment: string): {
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
  text: string
} {
  const arrows: BoardArrow[] = []
  const highlights: BoardHighlight[] = []
  const text = comment
    .replace(/\[%cal\s+([^\]]+)\]/g, (_m, list: string) => {
      for (const token of list.split(',')) {
        const t = token.trim()
        const m = /^([GRBY])([a-h][1-8])([a-h][1-8])$/.exec(t)
        if (m) arrows.push({ startSquare: m[2], endSquare: m[3], color: PEN_COLORS[m[1] as PenLetter] })
      }
      return ''
    })
    .replace(/\[%csl\s+([^\]]+)\]/g, (_m, list: string) => {
      for (const token of list.split(',')) {
        const t = token.trim()
        const m = /^([GRBY])([a-h][1-8])$/.exec(t)
        if (m) highlights.push({ square: m[2], color: PEN_COLORS[m[1] as PenLetter] + HIGHLIGHT_ALPHA })
      }
      return ''
    })
    .replace(/\[%[a-z]+[^\]]*\]/g, '') // clocks, evals and other tags we don't use
    .replace(/\s+/g, ' ')
    .trim()
  return { arrows, highlights, text }
}

/**
 * Parse one PGN game (variations are skipped) into a move list with the
 * position before and after every move, plus any arrows/highlights/comments
 * the source attached. Works for Lichess studies, Chess.com exports and
 * anything a coach pastes from a book or a course.
 */
export function parsePgn(pgn: string, source: PuzzleSource): ImportedGame {
  const chess = new Chess()
  chess.loadPgn(pgn.trim())
  const headers = chess.getHeaders() as Record<string, string>
  const commentsByFen = new Map(chess.getComments().map((c) => [c.fen, c.comment]))
  const history = chess.history({ verbose: true })

  const startFen = headers.FEN ?? history[0]?.before ?? chess.fen()
  const startNotes = parseAnnotations(commentsByFen.get(startFen) ?? '')

  const moves: ImportedMove[] = history.map((h, i) => {
    const notes = parseAnnotations(commentsByFen.get(h.after) ?? '')
    return {
      ply: i + 1,
      san: h.san,
      fen: h.after,
      fenBefore: h.before,
      comment: notes.text || undefined,
      arrows: notes.arrows,
      highlights: notes.highlights,
    }
  })

  const referenceLabel = [headers.White, headers.Black].filter(Boolean).join(' – ') || headers.Event || undefined

  return {
    headers,
    startFen,
    startArrows: startNotes.arrows,
    startHighlights: startNotes.highlights,
    startComment: startNotes.text || undefined,
    moves,
    referenceLabel,
    source,
  }
}

/** Human move-number prefix for a ply in a game that starts from `startFen`. */
export function moveLabel(startFen: string, ply: number): string {
  const [, side, , , , fullmove] = startFen.split(/\s+/)
  const startNumber = Number(fullmove || 1)
  const startsBlack = side === 'b'
  const index = startsBlack ? ply : ply - 1 // half-moves since the first white move
  const number = startNumber + Math.floor(index / 2)
  const isWhite = index % 2 === 0
  return isWhite ? `${number}.` : `${number}…`
}

/** Every position in a game as `{fen, side}` pairs — for the scrubber. */
export function positionsOf(game: ImportedGame): { fen: string; side: 'w' | 'b' }[] {
  return [{ fen: game.startFen, side: sideToMoveOf(game.startFen) }].concat(
    game.moves.map((m) => ({ fen: m.fen, side: sideToMoveOf(m.fen) })),
  )
}
