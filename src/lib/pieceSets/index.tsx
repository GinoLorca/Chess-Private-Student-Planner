import type { ReactNode } from 'react'
import type { PieceImages } from '../../types/domain'
import { classicPieceSet } from './classic'
import { bauhausPieceSet } from './bauhaus'
import { wavyPieceSet } from './wavy'

/** wK…bP → a component that fills its square. */
export type PieceRenderers = Record<string, () => ReactNode>

export type PieceSetId = 'classic' | 'bauhaus' | 'wavy'

export const DEFAULT_PIECE_SET: PieceSetId = 'classic'

export const PIECE_SETS: Record<PieceSetId, PieceRenderers> = {
  classic: classicPieceSet as PieceRenderers,
  bauhaus: bauhausPieceSet as PieceRenderers,
  wavy: wavyPieceSet as PieceRenderers,
}

export const PIECE_SET_OPTIONS: { id: PieceSetId; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic', description: 'The original hand-drawn set' },
  { id: 'bauhaus', label: 'Bauhaus Set', description: 'Charcoal and ivory, clean outlines' },
  { id: 'wavy', label: 'Wavy', description: 'Soft rounded coach set' },
]

export const PIECE_CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'] as const

export function isPieceSetId(value: string): value is PieceSetId {
  return value === 'classic' || value === 'bauhaus' || value === 'wavy'
}

/** Settings saved before the Bauhaus set replaced the old Arcade set still resolve. */
export function normalizePieceSetId(value: string): string {
  return value === 'arcade' ? 'bauhaus' : value
}

/** Renderers for an imported set: each square shows the matching image. */
export function renderersFromImages(images: PieceImages): PieceRenderers {
  return Object.fromEntries(
    PIECE_CODES.map((code) => [
      code,
      () => (
        <img
          src={images[code]}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      ),
    ]),
  )
}
