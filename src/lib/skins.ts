/**
 * Skins: the app's own Folder look, plus the five Chess Arcade skins ported
 * token for token. A skin sets colours, page background, board squares, piece
 * treatment, display font and corner radii; the layout never changes.
 */
export interface Skin {
  id: string
  label: string
  description: string
  /** The piece set Chess Arcade pairs with this skin; the coach can override. */
  suggestedPieceSet: 'classic' | 'bauhaus' | 'wavy'
  /** Nocturnal by nature: its light mode is already dark chrome. */
  dark?: boolean
}

export const FOLDER_SKIN = 'folder'

export const SKINS: Skin[] = [
  { id: FOLDER_SKIN, label: 'Folder', description: 'Manila folders, index cards, a sticky note. The default.', suggestedPieceSet: 'bauhaus' },
  { id: 'felt', label: 'Tournament Felt', description: 'Green baize, cream cards, brass.', suggestedPieceSet: 'classic' },
  { id: 'hustler', label: 'Hustler', description: 'Park concrete, stone tables, black-and-white marble.', suggestedPieceSet: 'wavy' },
  { id: 'bauhaus', label: 'Bauhaus', description: 'Primaries over paper, hard black rules, no corners.', suggestedPieceSet: 'bauhaus' },
  { id: 'gameboy', label: 'Game Boy', description: 'Grey plastic, magenta buttons, the DMG green screen.', suggestedPieceSet: 'classic' },
  { id: 'outerspace', label: 'Outer Space', description: 'Void black, one red-orange flare, amber CRT glass.', suggestedPieceSet: 'classic', dark: true },
]

export function isSkinId(value: string): boolean {
  return SKINS.some((s) => s.id === value)
}

export const SKIN_STORAGE_KEY = 'skin'

/** Put the skin on <html> (or take it off for the Folder look) and remember it for the next launch. */
export function applySkin(id: string) {
  const root = document.documentElement
  if (id === FOLDER_SKIN || !isSkinId(id)) root.removeAttribute('data-skin')
  else root.setAttribute('data-skin', id)
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, id)
  } catch {
    // remembered only for this launch
  }
}
