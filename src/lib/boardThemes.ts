import type { CustomBoard } from '../types/domain'

export interface BoardTheme {
  id: string
  label: string
  light: string
  dark: string
}

/**
 * Board colour presets. Coordinates are always drawn in the opposite square's
 * colour, so every preset stays legible without extra tuning.
 */
export const BOARD_THEMES: BoardTheme[] = [
  { id: 'brown', label: 'Brown', light: '#f0d9b5', dark: '#b58863' },
  { id: 'blue', label: 'Blue', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'green', label: 'Green', light: '#ffffdd', dark: '#86a666' },
  { id: 'arcade', label: 'Arcade', light: '#ece4d3', dark: '#33569e' },
  { id: 'walnut', label: 'Walnut', light: '#f3ead8', dark: '#8a5a3c' },
  { id: 'slate', label: 'Slate', light: '#e6e6e6', dark: '#7d8796' },
  { id: 'purple', label: 'Purple', light: '#f0f0f5', dark: '#9f90b0' },
]

export const DEFAULT_BOARD_THEME = 'brown'

export function resolveBoard(themeId: string | undefined, custom: CustomBoard | null | undefined): CustomBoard {
  if (themeId === 'custom' && custom?.light && custom?.dark) return custom
  const preset = BOARD_THEMES.find((t) => t.id === themeId) ?? BOARD_THEMES[0]
  return { light: preset.light, dark: preset.dark }
}

/** Push the chosen colours into the CSS variables every Board reads. */
/** A skin brings its own squares: drop the inline overrides so its stylesheet wins. */
export function clearBoardColors() {
  const root = document.documentElement.style
  for (const v of ['--board-light', '--board-dark', '--board-coord-on-light', '--board-coord-on-dark']) root.removeProperty(v)
}

export function applyBoardColors(colors: CustomBoard) {
  const root = document.documentElement.style
  root.setProperty('--board-light', colors.light)
  root.setProperty('--board-dark', colors.dark)
  root.setProperty('--board-coord-on-light', colors.dark)
  root.setProperty('--board-coord-on-dark', colors.light)
}
