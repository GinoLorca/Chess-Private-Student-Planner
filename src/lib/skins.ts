import { useSyncExternalStore } from 'react'

/**
 * Skins: the app's own Folder look, plus the Chess Arcade skins ported token
 * for token. A skin sets colours, page background, board squares, piece
 * treatment, display font and corner radii; the layout never changes. The
 * newer Arcade themes also bring artwork, coloured pieces and sounds.
 */
export interface Skin {
  id: string
  label: string
  description: string
  /** The piece set Chess Arcade pairs with this skin; the coach can override. */
  suggestedPieceSet: 'classic' | 'bauhaus' | 'wavy' | 'staunton'
  /** Nocturnal by nature: its light mode is already dark chrome. */
  dark?: boolean
  /** Ships a picture of its own for the page (public/skins/<id>-bg.svg); a switch puts its pattern back. */
  art?: boolean
  /** Colours the Theme Staunton pieces: choosing the skin puts those pieces on. */
  themePieces?: boolean
}

export const FOLDER_SKIN = 'folder'

export const SKINS: Skin[] = [
  { id: FOLDER_SKIN, label: 'Folder', description: 'Manila folders, index cards, a sticky note. The default.', suggestedPieceSet: 'bauhaus' },
  { id: 'felt', label: 'Tournament Felt', description: 'Green baize, cream cards, brass.', suggestedPieceSet: 'classic' },
  { id: 'hustler', label: 'Hustler', description: 'Park concrete, stone tables, black-and-white marble.', suggestedPieceSet: 'wavy' },
  { id: 'bauhaus', label: 'Bauhaus', description: 'Primaries over paper, hard black rules, no corners.', suggestedPieceSet: 'bauhaus' },
  { id: 'gameboy', label: 'Game Boy', description: 'Grey plastic, magenta buttons, the DMG green screen.', suggestedPieceSet: 'classic' },
  { id: 'outerspace', label: 'Outer Space', description: 'Void black, one red-orange flare, amber CRT glass.', suggestedPieceSet: 'classic', dark: true },
  { id: 'drivethru', label: 'Drive-Thru', description: 'Red-and-white counter tile, mustard trim, golden and grape pieces.', suggestedPieceSet: 'staunton', art: true, themePieces: true },
  { id: 'rose', label: 'Rose', description: 'Blush satin, raspberry, pearl and plum pieces, Bodoni italics.', suggestedPieceSet: 'staunton', art: true, themePieces: true },
  { id: 'chessbook', label: 'Chess Book', description: 'A printed diagram on cream paper, ink pieces, Garamond.', suggestedPieceSet: 'staunton', art: true, themePieces: true },
  { id: 'uptown', label: 'Uptown Express', description: 'Station tile, black signs, each piece on its own line.', suggestedPieceSet: 'staunton', art: true, themePieces: true },
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

// ---------------------------------------------------------------------------
// Artwork or pattern, per skin, per device: a skin with art shows its picture
// unless switched to its pattern here. Kept on <html> as data-art-off, a
// space-separated list of skin ids, so the CSS can pick (and index.html can
// set it before first paint).
// ---------------------------------------------------------------------------

export const ART_OFF_STORAGE_KEY = 'skin-art-off'
const ART_EVENT = 'skin-art-change'

function readArtOff(): string {
  try {
    return localStorage.getItem(ART_OFF_STORAGE_KEY) ?? ''
  } catch {
    return document.documentElement.getAttribute('data-art-off') ?? ''
  }
}

export function artOff(skin: string): boolean {
  return readArtOff().split(' ').includes(skin)
}

export function setArtOff(skin: string, off: boolean) {
  const ids = readArtOff()
    .split(' ')
    .filter((id) => id && id !== skin)
  if (off) ids.push(skin)
  const value = ids.join(' ')
  try {
    localStorage.setItem(ART_OFF_STORAGE_KEY, value)
  } catch {
    // held on the page for this visit
  }
  if (value) document.documentElement.setAttribute('data-art-off', value)
  else document.documentElement.removeAttribute('data-art-off')
  window.dispatchEvent(new Event(ART_EVENT))
}

/** Whether a skin is showing its pattern instead of its artwork on this device. */
export function useArtOff(skin: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(ART_EVENT, cb)
      window.addEventListener('storage', cb)
      return () => {
        window.removeEventListener(ART_EVENT, cb)
        window.removeEventListener('storage', cb)
      }
    },
    () => artOff(skin),
    () => false,
  )
}
