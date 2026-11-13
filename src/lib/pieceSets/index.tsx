import type { ReactNode } from 'react'
import type { PieceImages } from '../../types/domain'
import { classicPieceSet } from './classic'
import { bauhausPieceSet } from './bauhaus'
import { wavyPieceSet } from './wavy'
import { stauntonPieceSet } from './staunton'
import { imagePieces } from './imagePieces'
import { ARCADE_PIECE_SETS, type ArcadePieceSetId } from './arcade.generated'

/** wK…bP → a component that fills its square. */
export type PieceRenderers = Record<string, () => ReactNode>

export type PieceSetId = 'classic' | 'bauhaus' | 'wavy' | 'staunton' | ArcadePieceSetId

// Chess Arcade's other sets (Rim Light, Royal Minimal…), generated from its
// source by `npm run arcade:import`: drawn as Arcade draws them, coloured by
// the skin like Theme Staunton.
const arcadeSets = Object.fromEntries(
  ARCADE_PIECE_SETS.map((set) => [
    set.id,
    Object.fromEntries(
      Object.entries(set.svgs).map(([code, svg]) => [
        code,
        () => <span className="block h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />,
      ]),
    ) as PieceRenderers,
  ]),
) as Record<ArcadePieceSetId, PieceRenderers>

/** Sets coloured by the skin, as Chess Arcade's are: the analysis board shows them too. */
export const isArcadePieceSet = (id: string) => id === 'staunton' || ARCADE_PIECE_SETS.some((set) => set.id === id)

export const DEFAULT_PIECE_SET: PieceSetId = 'classic'

export const PIECE_SETS: Record<PieceSetId, PieceRenderers> = {
  classic: classicPieceSet as PieceRenderers,
  bauhaus: bauhausPieceSet as PieceRenderers,
  wavy: wavyPieceSet as PieceRenderers,
  staunton: stauntonPieceSet as PieceRenderers,
  ...arcadeSets,
}

export const PIECE_SET_OPTIONS: { id: PieceSetId; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic', description: 'The original hand-drawn set' },
  { id: 'bauhaus', label: 'Bauhaus Set', description: 'Charcoal and ivory, clean outlines' },
  { id: 'wavy', label: 'Wavy', description: 'Soft rounded coach set' },
  { id: 'staunton', label: 'Theme Staunton', description: "Chess Arcade's set, coloured by the skin" },
  ...ARCADE_PIECE_SETS.map((set) => ({ id: set.id, label: set.label, description: `${set.description.replace(/\.$/, '')} (Chess Arcade)` })),
]

export const PIECE_CODES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'] as const

export function isPieceSetId(value: string): value is PieceSetId {
  return value === 'classic' || value === 'bauhaus' || value === 'wavy' || value === 'staunton' || ARCADE_PIECE_SETS.some((set) => set.id === value)
}

/** Settings saved before the Bauhaus set replaced the old Arcade set still resolve. */
export function normalizePieceSetId(value: string): string {
  return value === 'arcade' ? 'bauhaus' : value
}

/** Renderers for an imported set: each square shows the matching picture (see imagePieces). */
export function renderersFromImages(images: PieceImages): PieceRenderers {
  let set = fromImages.get(images)
  if (!set) {
    set = imagePieces(Object.fromEntries(PIECE_CODES.map((code) => [code, images[code] ?? ''])))
    fromImages.set(images, set)
  }
  return set
}
const fromImages = new WeakMap<PieceImages, PieceRenderers>()
