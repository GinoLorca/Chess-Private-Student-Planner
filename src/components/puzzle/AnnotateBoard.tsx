import { useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { Arrow, SquareHandlerArgs } from 'react-chessboard'
import type { BoardArrow, BoardHighlight } from '../../types/domain'

const COLORS = [
  { name: 'green', value: 'rgba(74, 222, 128, 0.9)', fill: 'rgba(74, 222, 128, 0.55)' },
  { name: 'red', value: 'rgba(248, 113, 113, 0.9)', fill: 'rgba(248, 113, 113, 0.55)' },
  { name: 'yellow', value: 'rgba(250, 204, 21, 0.9)', fill: 'rgba(250, 204, 21, 0.55)' },
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
  const [colorIndex, setColorIndex] = useState(0)
  const [arrowStart, setArrowStart] = useState<string | null>(null)
  const activeColor = COLORS[colorIndex]

  function handleSquareClick({ square }: SquareHandlerArgs) {
    if (mode === 'highlight') {
      const existing = highlights.find((h) => h.square === square)
      if (existing && existing.color === activeColor.fill) {
        onHighlightsChange(highlights.filter((h) => h.square !== square))
      } else if (existing) {
        onHighlightsChange(highlights.map((h) => (h.square === square ? { ...h, color: activeColor.fill } : h)))
      } else {
        onHighlightsChange([...highlights, { square, color: activeColor.fill }])
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
      onArrowsChange([...arrows, { startSquare: arrowStart, endSquare: square, color: activeColor.value }])
    }
    setArrowStart(null)
  }

  const squareStyles: Record<string, React.CSSProperties> = Object.fromEntries(
    highlights.map((h) => [h.square, { backgroundColor: h.color, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.25)' }]),
  )
  if (arrowStart) {
    squareStyles[arrowStart] = { ...(squareStyles[arrowStart] || {}), boxShadow: `inset 0 0 0 3px ${activeColor.value}` }
  }

  const options = {
    id: 'annotate-board',
    position: fen,
    boardOrientation: 'white' as const,
    allowDragging: false,
    allowDrawingArrows: false,
    arrows: arrows as Arrow[],
    onSquareClick: handleSquareClick,
    squareStyles,
    darkSquareStyle: { backgroundColor: 'var(--color-board-dark)' },
    lightSquareStyle: { backgroundColor: 'var(--color-board-light)' },
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
            className={`rounded-md px-3 py-1 text-xs font-medium ${mode === 'arrow' ? 'bg-gold-500 text-ink-950' : 'text-ink-300'}`}
          >
            Arrow
          </button>
          <button
            onClick={() => {
              setMode('highlight')
              setArrowStart(null)
            }}
            className={`rounded-md px-3 py-1 text-xs font-medium ${mode === 'highlight' ? 'bg-gold-500 text-ink-950' : 'text-ink-300'}`}
          >
            Highlight
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {COLORS.map((c, i) => (
            <button
              key={c.name}
              onClick={() => setColorIndex(i)}
              className="h-5 w-5 rounded-full"
              style={{ backgroundColor: c.value, boxShadow: colorIndex === i ? '0 0 0 2px #fff' : 'none' }}
              aria-label={c.name}
            />
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
      <div className="mx-auto max-w-md">
        <Chessboard options={options} />
      </div>
    </div>
  )
}
