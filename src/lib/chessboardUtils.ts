import type { PositionDataType } from 'react-chessboard'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
export const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

export const SPARE_PIECE_TYPES = [
  'wK',
  'wQ',
  'wR',
  'wB',
  'wN',
  'wP',
  'bK',
  'bQ',
  'bR',
  'bB',
  'bN',
  'bP',
]

/** Convert a react-chessboard position object back into FEN piece placement + side to move. */
export function positionToFen(position: PositionDataType, sideToMove: 'w' | 'b'): string {
  const ranks: string[] = []
  for (let rank = 8; rank >= 1; rank--) {
    let empty = 0
    let row = ''
    for (const file of FILES) {
      const square = `${file}${rank}`
      const piece = position[square]
      if (!piece) {
        empty++
        continue
      }
      if (empty > 0) {
        row += empty
        empty = 0
      }
      row += pieceCodeToFenChar(piece.pieceType)
    }
    if (empty > 0) row += empty
    ranks.push(row)
  }
  return `${ranks.join('/')} ${sideToMove} - - 0 1`
}

function pieceCodeToFenChar(pieceType: string): string {
  const color = pieceType[0]
  const type = pieceType[1]
  return color === 'w' ? type.toUpperCase() : type.toLowerCase()
}

/** Ensure a FEN string has all 6 fields; fills in sane defaults for hand-set-up positions. */
export function normalizeFen(fen: string, fallbackSideToMove: 'w' | 'b' = 'w'): string {
  const parts = fen.trim().split(/\s+/)
  const placement = parts[0]
  const side = parts[1] === 'w' || parts[1] === 'b' ? parts[1] : fallbackSideToMove
  const castling = parts[2] ?? '-'
  const enPassant = parts[3] ?? '-'
  const halfmove = parts[4] ?? '0'
  const fullmove = parts[5] ?? '1'
  return `${placement} ${side} ${castling} ${enPassant} ${halfmove} ${fullmove}`
}

export function sideToMoveFromFen(fen: string): 'w' | 'b' {
  const parts = fen.trim().split(/\s+/)
  return parts[1] === 'b' ? 'b' : 'w'
}
