import { useSyncExternalStore } from 'react'
import { ARCADE_THEMES } from './arcadeThemes.generated'

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

// Folder is the app's own; every other skin is a Chess Arcade theme, generated
// by scripts/import-arcade-themes.mjs (see src/lib/arcadeThemes.generated.ts).
export const SKINS: Skin[] = [
  { id: FOLDER_SKIN, label: 'Folder', description: 'Manila folders, index cards, a sticky note. The default.', suggestedPieceSet: 'bauhaus' },
  ...ARCADE_THEMES.map(({ id, label, description, suggestedPieceSet, dark, art, themePieces }) => ({ id, label, description, suggestedPieceSet, dark, art, themePieces })),
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
