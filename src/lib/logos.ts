/**
 * School logos on student folders. A logo is either one of the built-in
 * badges under /logos, or a small image the coach picked, kept as a data URL
 * on the student row so it needs no storage bucket.
 */
export interface BuiltinLogo {
  id: string
  label: string
  src: string
  /** The school's colour, offered beside the logo. */
  color: string
}

export const BUILTIN_LOGOS: BuiltinLogo[] = [
  { id: 'buckley', label: 'The Buckley School', src: '/logos/buckley.png', color: '#1b3a6b' },
  { id: 'chelsea-chessmates', label: 'Chelsea Chessmates', src: '/logos/chelsea-chessmates.png', color: '#1f1f1f' },
]

/** Shrink a picked image to a small square PNG data URL (transparent padding), so it stores cheaply. */
export async function logoFromFile(file: File, size = 256): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("That file isn't an image the browser can read."))
      el.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No canvas')
    const scale = Math.min(size / img.width, size / img.height) * 0.86
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}
