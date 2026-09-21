export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
export const START_PLACEMENT = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'
export const START_FEN = `${START_PLACEMENT} w KQkq - 0 1`
export const EMPTY_PLACEMENT = '8/8/8/8/8/8/8/8'

export type Orientation = 'white' | 'black'
export type PieceCode = `${'w' | 'b'}${'K' | 'Q' | 'R' | 'B' | 'N' | 'P'}`
export type Placement = Partial<Record<string, PieceCode>>

/** The piece-placement field of a FEN; 'start' (the DB default) expands to the initial position. */
export function placementOf(fen: string): string {
  const first = fen.trim().split(/\s+/)[0]
  if (!first || first === 'start') return START_PLACEMENT
  return first
}

export function sideToMoveOf(fen: string, fallback: 'w' | 'b' = 'w'): 'w' | 'b' {
  const side = fen.trim().split(/\s+/)[1]
  return side === 'b' || side === 'w' ? side : fallback
}

/** Ensure all six FEN fields, filling sane defaults for hand-set-up positions. */
export function normalizeFen(fen: string, fallbackSide: 'w' | 'b' = 'w'): string {
  const parts = fen.trim().split(/\s+/)
  const placement = placementOf(fen)
  const side = parts[1] === 'w' || parts[1] === 'b' ? parts[1] : fallbackSide
  return `${placement} ${side} ${parts[2] ?? '-'} ${parts[3] ?? '-'} ${parts[4] ?? '0'} ${parts[5] ?? '1'}`
}

export function parsePlacement(fen: string): Placement {
  const out: Placement = {}
  const rows = placementOf(fen).split('/')
  for (let r = 0; r < 8 && r < rows.length; r++) {
    const rank = 8 - r
    let file = 0
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) {
        file += Number(ch)
        continue
      }
      if (file > 7) break
      const color = ch === ch.toUpperCase() ? 'w' : 'b'
      const type = ch.toUpperCase()
      if ('KQRBNP'.includes(type)) out[`${FILES[file]}${rank}`] = `${color}${type}` as PieceCode
      file++
    }
  }
  return out
}

export function serializePlacement(placement: Placement): string {
  const rows: string[] = []
  for (let rank = 8; rank >= 1; rank--) {
    let row = ''
    let empty = 0
    for (const file of FILES) {
      const code = placement[`${file}${rank}`]
      if (!code) {
        empty++
        continue
      }
      if (empty) {
        row += empty
        empty = 0
      }
      const letter = code[1]
      row += code[0] === 'w' ? letter : letter.toLowerCase()
    }
    if (empty) row += empty
    rows.push(row)
  }
  return rows.join('/')
}

/** Board cell for a square, in "cells from the top-left" for the given orientation. */
export function squareToCell(square: string, orientation: Orientation): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  return orientation === 'white' ? { x: file, y: 7 - rank } : { x: 7 - file, y: rank }
}

export function cellToSquare(x: number, y: number, orientation: Orientation): string {
  const file = orientation === 'white' ? x : 7 - x
  const rank = orientation === 'white' ? 7 - y : y
  return `${FILES[file]}${rank + 1}`
}

export function isLightSquare(square: string): boolean {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  return (file + rank) % 2 === 1
}

const PIECE_ORDER = 'KQRBNP'

/**
 * Human-readable piece list per side, in the order a coach reads it out while
 * setting up a physical board: "Kd4 Rd7 Rb7 f2". Pawns are written by square
 * alone, the way chess notation does.
 */
export interface SideSetup {
  /** King, queen, rooks, bishops, knights: the way a coach calls them out. */
  pieces: string[]
  /** Pawns as bare squares, left to right across the board. */
  pawns: string[]
}

/**
 * The set-up call-out for a physical board: pieces first (king, queen,
 * rooks, bishops, knights, each group file by file), then the pawns on their
 * own, file by file. Read it aloud and the board is set.
 */
export function pieceList(fen: string): { white: SideSetup; black: SideSetup } {
  const placement = parsePlacement(fen)
  const entries = Object.entries(placement) as [string, PieceCode][]
  const byFile = (a: string, b: string) => a.localeCompare(b) || Number(a[1]) - Number(b[1])
  const side = (color: 'w' | 'b'): SideSetup => {
    const own = entries.filter(([, code]) => code[0] === color)
    return {
      pieces: own
        .filter(([, code]) => code[1] !== 'P')
        .sort(([sa, ca], [sb, cb]) => PIECE_ORDER.indexOf(ca[1]) - PIECE_ORDER.indexOf(cb[1]) || byFile(sa, sb))
        .map(([square, code]) => `${code[1]}${square}`),
      pawns: own
        .filter(([, code]) => code[1] === 'P')
        .map(([square]) => square)
        .sort(byFile),
    }
  }
  return { white: side('w'), black: side('b') }
}
