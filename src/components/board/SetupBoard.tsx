import { useRef, useState } from 'react'
import clsx from 'clsx'
import { Board } from './Board'
import { squareAtPoint, DRAG_THRESHOLD } from './pointer'
import { usePieceSet } from '../../state/PieceSetContext'
import { PIECE_CODES } from '../../lib/pieceSets'
import {
  EMPTY_PLACEMENT,
  START_PLACEMENT,
  normalizeFen,
  parsePlacement,
  serializePlacement,
  type Orientation,
  type PieceCode,
  type Placement,
} from '../../lib/fen'
import { Button } from '../ui/Button'
import { Trash } from '../ui/Icons'

interface SetupBoardProps {
  fen: string
  side: 'w' | 'b'
  onChange: (fen: string, side: 'w' | 'b') => void
}

type Held = { code: PieceCode; from: 'tray' | string }

/**
 * Position editor built for fingers: tap a tray piece to pick it up, then tap
 * squares to stamp it; tap a piece on the board to lift it and tap where it
 * goes; drag works too. A lifted piece dropped off the board is removed.
 */
export function SetupBoard({ fen, side, onChange }: SetupBoardProps) {
  const { pieces } = usePieceSet()
  const [orientation, setOrientation] = useState<Orientation>('white')
  const [held, setHeld] = useState<Held | null>(null)
  const [drag, setDrag] = useState<{ code: PieceCode; x: number; y: number } | null>(null)
  const [fenDraft, setFenDraft] = useState('')
  const boardRef = useRef<HTMLDivElement>(null)
  const placement = parsePlacement(fen)

  function commit(next: Placement, nextSide = side) {
    onChange(`${serializePlacement(next)} ${nextSide} - - 0 1`, nextSide)
  }

  function place(square: string, code: PieceCode, from: Held['from']) {
    const next: Placement = { ...placement }
    if (from !== 'tray') delete next[from]
    next[square] = code
    commit(next)
  }

  function remove(square: string) {
    const next: Placement = { ...placement }
    delete next[square]
    commit(next)
  }

  // --- tap handling ---------------------------------------------------------
  function tapSquare(square: string) {
    if (held) {
      if (held.from === square) {
        // Tapping the lifted piece again puts it back down.
        setHeld(null)
        return
      }
      place(square, held.code, held.from)
      // Stamping from the tray keeps the piece in hand for the next square;
      // moving a board piece drops it.
      if (held.from !== 'tray') setHeld(null)
      return
    }
    const code = placement[square]
    if (code) setHeld({ code, from: square })
  }

  // --- drag handling ----------------------------------------------------------
  function startPointer(e: React.PointerEvent, code: PieceCode, from: Held['from']) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return
      dragging = true
      setDrag({ code, x: ev.clientX, y: ev.clientY })
    }
    const onUp = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      setDrag(null)
      if (!dragging) {
        if (from === 'tray') setHeld(held?.from === 'tray' && held.code === code ? null : { code, from: 'tray' })
        else tapSquare(from)
        return
      }
      const square = squareAtPoint(ev.clientX, ev.clientY, boardRef.current)
      if (square) place(square, code, from)
      else if (from !== 'tray') remove(from)
      setHeld(null)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  function onBoardPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const square = squareAtPoint(e.clientX, e.clientY, boardRef.current)
    if (!square) return
    const code = placement[square]
    if (code && !held) {
      startPointer(e, code, square)
      return
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return
    tapSquare(square)
  }

  function applyFen() {
    const text = fenDraft.trim()
    if (!text) return
    try {
      const normalized = normalizeFen(text, side)
      parsePlacement(normalized)
      const nextSide = normalized.split(' ')[1] as 'w' | 'b'
      onChange(normalized, nextSide)
      setFenDraft('')
    } catch {
      // ignore unparseable input; the field keeps the text for correction
    }
  }

  const HeldPiece = held ? pieces[held.code] : null
  const DragPiece = drag ? pieces[drag.code] : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-1 rounded-xl bg-surface-2 p-1.5">
        {PIECE_CODES.map((code) => {
          const Piece = pieces[code]
          const active = held?.from === 'tray' && held.code === code
          return (
            <button
              key={code}
              aria-label={`Pick up ${code}`}
              aria-pressed={active}
              onPointerDown={(e) => startPointer(e, code, 'tray')}
              className={clsx(
                'aspect-square touch-none rounded-lg p-1 transition',
                active ? 'bg-accent-soft ring-2 ring-accent' : 'hover:bg-surface-3',
              )}
            >
              <Piece />
            </button>
          )
        })}
      </div>

      <div className="mx-auto w-full max-w-[560px]">
        <Board
          ref={boardRef}
          fen={fen}
          orientation={orientation}
          selected={held && held.from !== 'tray' ? held.from : null}
          hiddenSquares={drag && held?.from && held.from !== 'tray' ? [held.from] : undefined}
          interactive
          onPointerDown={onBoardPointerDown}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-surface-2 p-1">
          {(['w', 'b'] as const).map((s) => (
            <button
              key={s}
              onClick={() => commit(placement, s)}
              className={clsx(
                'h-9 rounded-lg px-3 text-[14px] font-semibold transition',
                side === s ? 'bg-surface text-ink shadow-card' : 'text-ink-2',
              )}
            >
              {s === 'w' ? 'White' : 'Black'} to move
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>
          Flip
        </Button>
        <div className="flex-1" />
        {held && held.from !== 'tray' && (
          <Button size="sm" variant="danger" icon={<Trash size={16} />} onClick={() => {
            remove(held.from)
            setHeld(null)
          }}>
            Remove piece
          </Button>
        )}
        {held?.from === 'tray' && HeldPiece && (
          <span className="flex items-center gap-2 text-[13px] text-ink-2">
            <span className="h-6 w-6">
              <HeldPiece />
            </span>
            Tap squares to place · tap again to put down
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={() => commit(parsePlacement(START_PLACEMENT))}>
          Start position
        </Button>
        <Button size="sm" variant="ghost" onClick={() => commit(parsePlacement(EMPTY_PLACEMENT))}>
          Clear
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          applyFen()
        }}
        className="flex gap-2"
      >
        <input
          value={fenDraft}
          onChange={(e) => setFenDraft(e.target.value)}
          placeholder={fen}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface-2 px-3 font-mono text-[13px] outline-none focus:border-accent"
        />
        <Button type="submit" size="md" variant="secondary" disabled={!fenDraft.trim()}>
          Load FEN
        </Button>
      </form>

      {drag && DragPiece && (
        <div
          className="pointer-events-none fixed z-50 h-16 w-16 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg"
          style={{ left: drag.x, top: drag.y }}
        >
          <DragPiece />
        </div>
      )}
    </div>
  )
}
