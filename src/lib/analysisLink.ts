/**
 * The address of the analysis board on a position: the FEN, which way the
 * board faces, where Back returns to, a title for the page, and the
 * position's recorded line (SAN moves from the FEN) with the move to open on
 * — 0 for the position itself.
 */
export function analysisHref({
  fen,
  orientation,
  back,
  title,
  line,
  at,
}: {
  fen: string
  orientation: 'white' | 'black'
  back: string
  title?: string
  line?: string[]
  at?: number
}) {
  const p = new URLSearchParams({ fen, o: orientation, back })
  if (title) p.set('title', title)
  if (line?.length) p.set('line', line.join(' '))
  if (at) p.set('at', String(at))
  return `/analysis?${p}`
}
