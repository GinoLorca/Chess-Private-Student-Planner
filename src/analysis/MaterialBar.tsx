// Solid glyphs tinted by CSS. The trailing U+FE0E forces text presentation:
// without it some fonts substitute a fixed-colour emoji glyph that ignores
// the CSS colour, so both sides render the same shade.
const GLYPH: Record<string, string> = { p: '♟︎', n: '♞︎', b: '♝︎', r: '♜︎', q: '♛︎' }

/**
 * One side's captured-material readout (Repertoire Lab's
 * src/components/MaterialBar.jsx): the opponent's pieces taken so far, in the
 * captured piece's own colour, and the lead when this side is ahead. Always
 * rendered, even empty, so the board doesn't jump when the first piece goes.
 */
export function MaterialBar({ pieces, capturedColor, advantage }: { pieces: string[]; capturedColor: 'white' | 'black'; advantage: number }) {
  return (
    <div className="material-bar">
      {pieces.map((p, i) => (
        <span key={i} className={`material-piece ${capturedColor}`}>
          {GLYPH[p]}
        </span>
      ))}
      {advantage > 0 && <span className="material-adv">+{advantage}</span>}
    </div>
  )
}
