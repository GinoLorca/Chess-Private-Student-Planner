import { useRef } from 'react'
import type { BoardArrow, BoardHighlight } from '../../types/domain'
import { Board, type BoardProps } from './Board'
import { useRightClickDraw } from './useRightClickDraw'

interface DrawableBoardProps extends Omit<BoardProps, 'ref' | 'arrows' | 'highlights'> {
  arrows: BoardArrow[]
  highlights: BoardHighlight[]
  onArrowsChange: (arrows: BoardArrow[]) => void
  onHighlightsChange: (highlights: BoardHighlight[]) => void
}

/** A read-only board that still takes right-drag arrows and right-click highlights. */
export function DrawableBoard({ arrows, highlights, onArrowsChange, onHighlightsChange, onPointerDown, ...rest }: DrawableBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const draw = useRightClickDraw({ boardRef, arrows, highlights, onArrowsChange, onHighlightsChange })
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
