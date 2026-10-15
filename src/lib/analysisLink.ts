/**
 * The address of the analysis board on a position: the FEN, which way the
 * board faces, where Back returns to, and a title for the page.
 */
export function analysisHref({ fen, orientation, back, title }: { fen: string; orientation: 'white' | 'black'; back: string; title?: string }) {
  const p = new URLSearchParams({ fen, o: orientation, back })
  if (title) p.set('title', title)
  return `/analysis?${p}`
}
