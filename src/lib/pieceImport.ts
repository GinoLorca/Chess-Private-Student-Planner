import { PIECE_CODES } from './pieceSets'
import type { PieceImages } from '../types/domain'

const COLOR_WORDS: Record<string, 'w' | 'b'> = { w: 'w', white: 'w', light: 'w', b: 'b', black: 'b', dark: 'b' }
const TYPE_WORDS: Record<string, string> = {
  k: 'K',
  king: 'K',
  q: 'Q',
  queen: 'Q',
  r: 'R',
  rook: 'R',
  b: 'B',
  bishop: 'B',
  n: 'N',
  knight: 'N',
  horse: 'N',
  p: 'P',
  pawn: 'P',
}

/**
 * Guess which piece a file is from its name: wK.png, white_king.svg,
 * black-knight@2x.png, bQ.webp… Anything unrecognised gets assigned by hand.
 */
export function pieceCodeFromFilename(name: string): string | null {
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/@\dx$/i, '').toLowerCase()
  // Two-letter form first: wk, bn, wK…
  const short = /^([wb])([kqrbnp])$/.exec(base)
  if (short) return `${short[1]}${short[2].toUpperCase()}`
  const words = base.split(/[^a-z]+/).filter(Boolean)
  let color: 'w' | 'b' | null = null
  let type: string | null = null
  for (const w of words) {
    if (!color && COLOR_WORDS[w]) color = COLOR_WORDS[w]
    else if (!type && TYPE_WORDS[w]) type = TYPE_WORDS[w]
  }
  // "white_king" or "kingwhite" without separators
  if (!color || !type) {
    for (const [cw, c] of Object.entries(COLOR_WORDS)) {
      if (cw.length > 1 && base.includes(cw)) color = color ?? c
    }
    for (const [tw, t] of Object.entries(TYPE_WORDS)) {
      if (tw.length > 1 && base.includes(tw)) type = type ?? t
    }
  }
  return color && type ? `${color}${type}` : null
}

/** Read an image file, shrink it to fit 160px, and return a PNG data URL. */
export async function fileToPieceDataUrl(file: File, size = 160): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error(`Couldn't read ${file.name}`))
      el.src = url
    })
    // SVGs stay as-is: they're already small and scale perfectly.
    if (file.type === 'image/svg+xml') {
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = () => reject(new Error(`Couldn't read ${file.name}`))
        r.readAsDataURL(file)
      })
    }
    const scale = Math.min(1, size / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export interface ImportedPieceFile {
  name: string
  dataUrl: string
  code: string | null
}

export async function readPieceFiles(files: FileList | File[]): Promise<ImportedPieceFile[]> {
  return Promise.all(
    Array.from(files).map(async (file) => ({
      name: file.name,
      dataUrl: await fileToPieceDataUrl(file),
      code: pieceCodeFromFilename(file.name),
    })),
  )
}

export function imagesFromFiles(files: ImportedPieceFile[]): { images: PieceImages; missing: string[] } {
  const images: PieceImages = {}
  for (const f of files) if (f.code) images[f.code] = f.dataUrl
  const missing = PIECE_CODES.filter((c) => !images[c])
  return { images, missing }
}
