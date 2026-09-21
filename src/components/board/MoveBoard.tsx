import { useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Board } from './Board'
import { squareAtPoint, DRAG_THRESHOLD } from './pointer'
import { usePieceSet } from '../../state/PieceSetContext'
import { normalizeFen, type Orientation } from '../../lib/fen'
import type { BoardArrow, BoardHighlight } from '../../types/domain'
import { Modal } from '../ui/Modal'

interface MoveBoardProps {
  fen: string
  orientation?: Orientation
  arrows?: BoardArrow[]
  highlights?: BoardHighlight[]
  lastMove?: { from: string; to: string } | null
  /** Called with the SAN and resulting FEN of a legal move. */
  onMove: (san: string, fen: string) => void
  disabled?: boolean
}

/**
 * Plays legal moves on the board: tap a piece to see where it can go, tap a
 * target (or drag). Illegal positions (a missing king, say) just show the
 * board and let the caller explain why moves can't be recorded.
 */
export function MoveBoard({ fen, orientation = 'white', arrows, highlights, lastMove, onMove, disabled }: MoveBoardProps) {
  const { pieces } = usePieceSet()
  const boardRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ code: string; x: number; y: number; from: string } | null>(null)
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null)

  const chess = useMemo(() => {
    try {
      return new Chess(normalizeFen(fen))
    } catch {
      return null
    }
  }, [fen])

  const targets = useMemo(() => {
    if (!chess || !selected) return new Set<string>()
    return new Set(chess.moves({ square: selected as Square, verbose: true }).map((m) => m.to as string))
  }, [chess, selected])

  function tryMove(from: string, to: string, promotionPiece?: string): boolean {
    if (!chess) return false
    const candidates = chess.moves({ square: from as Square, verbose: true }).filter((m) => m.to === to)
    if (candidates.length === 0) return false
    if (candidates.some((m) => m.promotion) && !promotionPiece) {
      setPromotion({ from, to })
      return true
    }
    const next = new Chess(chess.fen())
    const move = next.move({ from, to, promotion: promotionPiece ?? 'q' })
    onMove(move.san, next.fen())
    setSelected(null)
    return true
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || !chess) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const square = squareAtPoint(e.clientX, e.clientY, boardRef.current)
    if (!square) return
    const piece = chess.get(square as Square)
    const isOwn = piece && piece.color === chess.turn()

    if (selected && targets.has(square)) {
      tryMove(selected, square)
      return
    }
    if (!isOwn) {
      setSelected(null)
      return
    }

    setSelected(square)
    const code = `${piece.color}${piece.type.toUpperCase()}`
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startY = e.clientY
    let dragging = false
    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return
      dragging = true
      setDrag({ code, x: ev.clientX, y: ev.clientY, from: square })
    }
    const onUp = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      setDrag(null)
      if (!dragging) return
      const to = squareAtPoint(ev.clientX, ev.clientY, boardRef.current)
      if (to && to !== square && tryMove(square, to)) return
      setSelected(square)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  const DragPiece = drag ? pieces[drag.code] : null
  const promoColor = chess?.turn() ?? 'w'

  return (
    <>
      <Board
        ref={boardRef}
        fen={fen}
        orientation={orientation}
        arrows={arrows}
        highlights={highlights}
        lastMove={lastMove}
        selected={selected}
        hiddenSquares={drag ? [drag.from] : undefined}
        interactive
        onPointerDown={onPointerDown}
        onContextMenu={(e) => e.preventDefault()}
        overlay={
          targets.size > 0 && (
            <div className="pointer-events-none absolute inset-0 grid grid-cols-8 grid-rows-8">
              {Array.from({ length: 64 }, (_, i) => {
                const x = i % 8
                const y = Math.floor(i / 8)
                const file = orientation === 'white' ? x : 7 - x
                const rank = orientation === 'white' ? 7 - y : y
                const sq = `${'abcdefgh'[file]}${rank + 1}`
                if (!targets.has(sq)) return <div key={sq} />
                const capture = chess?.get(sq as Square)
                return (
                  <div key={sq} className="grid place-items-center">
                    <span
                      className="block rounded-full"
                      style={
                        capture
                          ? { width: '88%', height: '88%', boxShadow: 'inset 0 0 0 0.3em var(--board-select)' }
                          : { width: '32%', height: '32%', background: 'var(--board-select)' }
                      }
                    />
                  </div>
                )
              })}
            </div>
          )
        }
      />
      {drag && DragPiece && (
        <div
          className="pointer-events-none fixed z-50 h-16 w-16 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg"
          style={{ left: drag.x, top: drag.y }}
        >
          <DragPiece />
        </div>
      )}
      <Modal open={Boolean(promotion)} onClose={() => setPromotion(null)} title="Promote to" variant="dialog">
        <div className="grid grid-cols-4 gap-2">
          {(['q', 'r', 'b', 'n'] as const).map((p) => {
            const Piece = pieces[`${promoColor}${p.toUpperCase()}`]
            return (
              <button
                key={p}
                onClick={() => {
                  if (promotion) tryMove(promotion.from, promotion.to, p)
                  setPromotion(null)
                }}
                className="aspect-square rounded-xl bg-surface-2 p-2 hover:bg-surface-3"
              >
                <Piece />
              </button>
            )
          })}
        </div>
      </Modal>
    </>
  )
}
