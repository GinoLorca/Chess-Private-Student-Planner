import { useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import type { Puzzle } from '../../types/domain'
import { Board } from '../board/Board'
import { Button, IconButton } from '../ui/Button'
import { ChevronDown, ChevronUp, Grip } from '../ui/Icons'
import { normalizeFen } from '../../lib/fen'

/**
 * A section's positions as a compact list to put in order: drag a row by its
 * handle (a finger or the mouse), or tap ↑ / ↓, which is easier on a phone on
 * the move. Nothing is saved until Done; Cancel leaves the order as it was.
 */
export function ReorderList({ puzzles, onDone, onCancel }: { puzzles: Puzzle[]; onDone: (ordered: Puzzle[]) => void; onCancel: () => void }) {
  const [order, setOrder] = useState(puzzles)
  const changed = order.some((p, i) => p.id !== puzzles[i]?.id)
  const move = (from: number, to: number) =>
    setOrder((list) => {
      if (to < 0 || to >= list.length) return list
      const next = [...list]
      const [p] = next.splice(from, 1)
      next.splice(to, 0, p)
      return next
    })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-[14px] text-ink-2">Drag a position by its handle, or use the arrows. The numbers follow the new order.</p>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={() => onDone(order)} disabled={!changed}>
          Done
        </Button>
      </div>
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2" aria-label="Positions in order">
        {order.map((puzzle, i) => (
          <Row key={puzzle.id} puzzle={puzzle} index={i} last={i === order.length - 1} onUp={() => move(i, i - 1)} onDown={() => move(i, i + 1)} />
        ))}
      </Reorder.Group>
    </div>
  )
}

function Row({ puzzle, index, last, onUp, onDown }: { puzzle: Puzzle; index: number; last: boolean; onUp: () => void; onDown: () => void }) {
  // Only the handle starts a drag, so the page still scrolls under a finger elsewhere on the row.
  const controls = useDragControls()
  const name = puzzle.label || 'Untitled'
  return (
    <Reorder.Item
      value={puzzle}
      dragListener={false}
      dragControls={controls}
      className="reorder-row relative flex items-center gap-2.5 rounded-xl border border-line bg-surface p-2 pr-1.5 shadow-[0_6px_16px_-14px_rgba(0,0,0,0.5)]"
      whileDrag={{ scale: 1.02, boxShadow: '0 14px 28px -12px rgba(0,0,0,0.45)', zIndex: 10 }}
    >
      <button
        type="button"
        aria-label={`Drag ${name}`}
        className="grid h-11 w-9 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-ink-3 hover:bg-surface-2 active:cursor-grabbing"
        onPointerDown={(e) => {
          e.preventDefault()
          controls.start(e)
        }}
      >
        <Grip size={20} />
      </button>
      <span className="w-7 shrink-0 text-right text-[13px] font-bold text-ink-3 tabular-nums">#{index + 1}</span>
      <div className="w-12 shrink-0">
        {/* The puzzle as it's set, like the cards: no marks that show the answer. */}
        <Board
          fen={normalizeFen(puzzle.starting_fen, puzzle.side_to_move)}
          orientation={puzzle.side_to_move === 'b' ? 'black' : 'white'}
          coordinates={false}
          className="rounded-[2px] shadow-none"
        />
      </div>
      <span className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold text-ink">{name}</span>
      <IconButton label={`Move ${name} up`} className="h-10 w-10 shrink-0 text-ink-2" onClick={onUp} disabled={index === 0}>
        <ChevronUp size={18} />
      </IconButton>
      <IconButton label={`Move ${name} down`} className="h-10 w-10 shrink-0 text-ink-2" onClick={onDown} disabled={last}>
        <ChevronDown size={18} />
      </IconButton>
    </Reorder.Item>
  )
}
