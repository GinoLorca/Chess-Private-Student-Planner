// Manila-folder tab colours: warm, distinct, readable with dark text on both themes.
export const FOLDER_COLORS = ['#e9c98e', '#a9bfd9', '#d9a5a0', '#a7c4b5', '#c9b3d9', '#e0c3a0', '#b9d1c2', '#d8c2a6']

// School colours: deep, so the folder takes light ink (see onColor).
export const SCHOOL_COLORS: { label: string; color: string }[] = [
  { label: 'Buckley navy', color: '#1b3a6b' },
  { label: 'Chessmates black', color: '#1f1f1f' },
  { label: 'Forest', color: '#2f5d3a' },
  { label: 'Maroon', color: '#6b1f2a' },
]

/** Relative luminance of a hex colour, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 1
  const n = parseInt(m[1], 16)
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}

export function isDarkColor(hex: string): boolean {
  return luminance(hex) < 0.35
}

/**
 * The inks to write on a folder of this colour. Manila and pastels take dark
 * ink; a school navy or black takes light ink. Everything painted directly on
 * a student's colour reads from here, so a dark school colour just works.
 */
export function onColor(hex: string) {
  const dark = isDarkColor(hex)
  return dark
    ? { dark, ink: 'rgba(255,255,255,0.94)', inkSoft: 'rgba(255,255,255,0.72)', inkFaint: 'rgba(255,255,255,0.5)', dot: 'rgba(255,255,255,0.4)', chip: 'rgba(255,255,255,0.16)', chipActive: 'rgba(255,255,255,0.26)' }
    : { dark, ink: '#1a1a19', inkSoft: 'rgba(0,0,0,0.6)', inkFaint: 'rgba(0,0,0,0.45)', dot: 'rgba(0,0,0,0.35)', chip: 'rgba(255,255,255,0.55)', chipActive: 'rgba(255,255,255,0.8)' }
}
