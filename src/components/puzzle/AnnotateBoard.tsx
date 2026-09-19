import { useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { SquareHandlerArgs } from 'react-chessboard'
import type { BoardArrow, BoardHighlight } from '../../types/domain'
import { usePieceSet } from '../../state/PieceSetContext'
import { ArrowOverlay } from './ArrowOverlay'

// Same four pens as Repertoire Lab's analysis board (green/red/blue/yellow),
// so a coach's color coding means the same thing across both tools.
const PENS = [
  { id: 'green', name: 'Green', value: '#2ecc71' },
  { id: 'red', name: 'Red', value: '#e5534b' },
  { id: 'blue', name: 'Blue', value: '#3b9cff' },
  { id: 'yellow', name: 'Yellow', value: '#e8b339' },
]

type Mode = 'arrow' | 'highlight'

export function AnnotateBoard({
  fen,
  arrows,
  highlights,
  onArrowsChange,
  onHighlightsChange,
}: {
  fen: string
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
  onArrowsChange: (arrows: BoardArrow[]) => void
  onHighlightsChange: (highlights: BoardHighlight[]) => void
}) {
  const [mode, setMode] = useState<Mode>('arrow')
  const [penIndex, setPenIndex] = useState(0)
  const [arrowStart, setArrowStart] = useState<string | null>(null)
  const pen = PENS[penIndex]
  const { pieces } = usePieceSet()

  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (mode === 'highlight') {
      const fillColor = `${pen.value}66`
      const existing = highlights.find((h) => h.square === square)
      if (existing && existing.color === fillColor) {
        onHighlightsChange(highlights.filter((h) => h.square !== square))
      } else if (existing) {
        onHighlightsChange(highlights.map((h) => (h.square === square ? { ...h, color: fillColor } : h)))
      } else {
        onHighlightsChange([...highlights, { square, color: fillColor }])
      }
      return
    }

    // arrow mode: first click picks the start square, second click the end square
    if (!arrowStart) {
      setArrowStart(square)
      return
    }
    if (arrowStart === square) {
      setArrowStart(null)
      return
    }
    const existingIndex = arrows.findIndex((a) => a.startSquare === arrowStart && a.endSquare === square)
    if (existingIndex >= 0) {
      onArrowsChange(arrows.filter((_, i) => i !== existingIndex))
    } else {
      onArrowsChange([...arrows, { startSquare: arrowStart, endSquare: square, color: pen.value }])
    }
    setArrowStart(null)
  }

  const squareStyles: Record<string, React.CSSProperties> = Object.fromEntries(
    highlights.map((h) => [h.square, { backgroundColor: h.color, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.25)' }]),
  )
  if (arrowStart) {
    squareStyles[arrowStart] = { ...(squareStyles[arrowStart] || {}), boxShadow: `inset 0 0 0 3px ${pen.value}` }
  }

  const options = {
    id: 'annotate-board',
    position: fen,
    boardOrientation: 'white' as const,
    allowDragging: false,
    allowDrawingArrows: false,
    onSquareClick: handleSquareClick,
    squareStyles,
    pieces,
    darkSquareStyle: { backgroundColor: 'var(--color-board-dark)', boxShadow: 'inset 0 0 0 1.5px var(--color-board-line)' },
    lightSquareStyle: { backgroundColor: 'var(--color-board-light)', boxShadow: 'inset 0 0 0 1.5px var(--color-board-line)' },
    darkSquareNotationStyle: { color: 'var(--color-board-coord)', fontWeight: 700 },
    lightSquareNotationStyle: { color: 'var(--color-board-coord)', fontWeight: 700 },
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-ink-800 p-1">
          <button
            onClick={() => {
              setMode('arrow')
              setArrowStart(null)
            }}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${mode === 'arrow' ? 'bg-gold-500 text-ink-950' : 'text-ink-300 hover:text-ink-100'}`}
          >
            Arrow
          </button>
          <button
            onClick={() => {
              setMode('highlight')
              setArrowStart(null)
            }}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${mode === 'highlight' ? 'bg-gold-500 text-ink-950' : 'text-ink-300 hover:text-ink-100'}`}
          >
            Highlight
          </button>
        </div>
        <div className="flex items-center gap-2">
          {PENS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setPenIndex(i)}
              title={p.name}
              aria-label={p.name}
              className="grid h-6 w-6 place-items-center rounded-full transition"
              style={{ boxShadow: penIndex === i ? `0 0 0 2px var(--color-ink-950), 0 0 0 3.5px ${p.value}` : 'none' }}
            >
              <span className="block h-4 w-4 rounded-full" style={{ backgroundColor: p.value }} />
            </button>
          ))}
        </div>
        {highlights.length > 0 && (
          <button onClick={() => onHighlightsChange([])} className="text-xs text-ink-400 hover:text-red-400">
            clear highlights
          </button>
        )}
        {arrows.length > 0 && (
          <button onClick={() => onArrowsChange([])} className="text-xs text-ink-400 hover:text-red-400">
            clear arrows
          </button>
        )}
      </div>
      <p className="text-xs text-ink-400">
        {mode === 'arrow'
          ? arrowStart
            ? `Arrow from ${arrowStart} — click the target square.`
            : 'Click a square to start an arrow, then click where it points.'
          : 'Click a square to toggle a highlight in the selected color.'}
      </p>
      <div className="relative mx-auto max-w-md">
        <Chessboard options={options} />
        <ArrowOverlay arrows={arrows} orientation="white" />
      </div>
    </div>
  )
}
