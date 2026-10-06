import type { PieceRenderObject } from './types'

/**
 * Piece sets drawn from pictures (an imported set, the Bauhaus set), drawn
 * the way Safari can put on screen at once.
 *
 * As <img> elements they lagged on the iPad and the Mac: every time a piece
 * appeared somewhere new (lifted under the finger, dropped on a square,
 * moved by the opponent) a fresh <img> was made, and Safari loads a picture
 * given as a data: address off to the side and only draws it frames later,
 * so the square showed empty and the piece turned up after it. Chrome
 * draws them straight away, which hid it.
 *
 * Here each picture is the background of one style rule, shared by every
 * piece of that kind: Safari loads it once, for the first piece drawn, and
 * every later one, the lifted piece included, is drawn in the same frame.
 * Chess Arcade never had the wait because its pieces are drawn as shapes.
 */

let sheet: HTMLStyleElement | null = null
let preload: HTMLDivElement | null = null
const rules = new Map<string, string>()
const setsByKey = new Map<string, PieceRenderObject>()

/** A short name for a set's pictures, the same every time for the same pictures. */
function keyOf(sources: Record<string, string>, scale: number): string {
  let h = 5381
  const add = (s: string) => {
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  for (const code of Object.keys(sources).sort()) {
    add(code)
    add(sources[code])
  }
  add(String(scale))
  return `s${(h >>> 0).toString(36)}`
}

/** A picture's address as a quoted CSS string. */
const cssUrl = (url: string) => `url("${url.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a ')}")`

function register(key: string, sources: Record<string, string>, scale: number) {
  if (rules.has(key) || typeof document === 'undefined') return
  // Imported pictures can be any shape: fitted whole. A set drawn on square
  // canvases can be inset by a fraction instead.
  const size = scale === 1 ? 'contain' : `${scale * 100}% ${scale * 100}%`
  rules.set(
    key,
    Object.entries(sources)
      .filter(([, url]) => url)
      .map(([code, url]) => `.piece-img[data-pset="${key}"][data-piece="${code}"]{background-image:${cssUrl(url)};background-size:${size}}`)
      .join('\n'),
  )
  if (!sheet) {
    sheet = document.createElement('style')
    sheet.id = 'piece-images'
    document.head.appendChild(sheet)
  }
  sheet.textContent = [
    '.piece-img{display:block;width:100%;height:100%;background-position:center;background-repeat:no-repeat;-webkit-user-drag:none}',
    ...rules.values(),
  ].join('\n')

  // Every piece drawn once, out of sight, so even one that isn't on the
  // board yet (a promoted queen) is ready when it first appears.
  if (!preload) {
    preload = document.createElement('div')
    preload.setAttribute('aria-hidden', 'true')
    preload.style.cssText = 'position:fixed;left:-10px;top:-10px;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0'
    document.body.appendChild(preload)
  }
  for (const code of Object.keys(sources)) {
    if (!sources[code]) continue
    const el = document.createElement('span')
    el.className = 'piece-img'
    el.dataset.pset = key
    el.dataset.piece = code
    preload.appendChild(el)
  }
}

/**
 * Renderers for a set of pictures, one per piece code (wK…bP). `scale` is how
 * much of the square the picture fills. The same pictures always give back
 * the same renderers, so boards showing them never redraw their pieces for
 * nothing.
 */
export function imagePieces(sources: Record<string, string>, scale = 1): PieceRenderObject {
  const key = keyOf(sources, scale)
  const known = setsByKey.get(key)
  if (known) return known
  register(key, sources, scale)
  const set = Object.fromEntries(
    Object.keys(sources).map((code) => [code, () => <span className="piece-img" data-pset={key} data-piece={code} />]),
  ) as PieceRenderObject
  setsByKey.set(key, set)
  return set
}
