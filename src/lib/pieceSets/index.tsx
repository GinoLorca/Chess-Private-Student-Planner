import type { PieceRenderObject } from 'react-chessboard'
import { classicPieceSet } from './classic'
import { arcadePieceSet } from './arcade'
import { wavyPieceSet } from './wavy'

export type PieceSetId = 'classic' | 'arcade' | 'wavy'

export const DEFAULT_PIECE_SET: PieceSetId = 'classic'

export const PIECE_SETS: Record<PieceSetId, PieceRenderObject> = {
  classic: classicPieceSet,
  arcade: arcadePieceSet,
  wavy: wavyPieceSet,
}

export const PIECE_SET_OPTIONS: { id: PieceSetId; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic', description: 'The original hand-drawn set' },
  { id: 'arcade', label: 'Arcade', description: 'Bold outlined pieces' },
  { id: 'wavy', label: 'Wavy', description: 'Soft rounded coach set' },
]

export function isPieceSetId(value: string): value is PieceSetId {
  return value === 'classic' || value === 'arcade' || value === 'wavy'
}
