import { useEffect, useRef } from 'react'
import type { BoardArrow, BoardHighlight } from '../../types/domain'
import { Board, type BoardProps } from './Board'
import { useRightClickDraw } from './useRightClickDraw'

interface DrawableBoardProps extends Omit<BoardProps, 'ref' | 'arrows' | 'highlights'> {
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
  onArrowsChange: (arrows: BoardArrow[]) => void
  onHighlightsChange: (highlights: BoardHighlight[]) => void
  /** A finger is drawing: a swipe around the board should hold off. */
  onDrawingChange?: (drawing: boolean) => void
  /** These marks are a sketch: a plain left click wipes them. Saved marks never go that way. */
  sketch?: boolean
}

/** A read-only board that still takes arrows and highlights: right-drag on a mouse, rest-and-drag on touch. */
export function DrawableBoard({ arrows, highlights, onArrowsChange, onHighlightsChange, onDrawingChange, sketch = false, onPointerDown, ...rest }: DrawableBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const draw = useRightClickDraw({ boardRef, arrows, highlights, onArrowsChange, onHighlightsChange, resetKey: rest.fen, clearOnClick: sketch })
  const drawing = draw.drawing
  const report = useRef(onDrawingChange)
  useEffect(() => {
    report.current = onDrawingChange
  })
  useEffect(() => report.current?.(drawing), [drawing])
  return (
    <Board
      ref={boardRef}
      {...rest}
      arrows={draw.arrows}
      highlights={draw.highlights}
      selected={draw.from ?? rest.selected}
      onPointerDown={(e) => {
        if (!draw.onPointerDown(e)) onPointerDown?.(e)
      }}
      onContextMenu={draw.onContextMenu}
    />
  )
}
