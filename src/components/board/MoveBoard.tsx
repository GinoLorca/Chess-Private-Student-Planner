import { useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Board } from './Board'
import { squareAtPoint, DRAG_THRESHOLD } from './pointer'
import { useRightClickDraw } from './useRightClickDraw'
import { usePieceSet } from '../../state/PieceSetContext'
import { normalizeFen, squareToCell, type Orientation } from '../../lib/fen'
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
  /** When set, right-drag draws arrows and right-click highlights, saved through these. */
  onArrowsChange?: (arrows: BoardArrow[]) => void
  onHighlightsChange?: (highlights: BoardHighlight[]) => void
}

/**
 * Plays legal moves on the board: tap a piece to see where it can go, tap a
 * target (or drag). Illegal positions (a missing king, say) just show the
 * board and let the caller explain why moves can't be recorded.
 */
export function MoveBoard({
  fen,
  orientation = 'white',
  arrows,
  highlights,
  lastMove,
  onMove,
  disabled,
  onArrowsChange,
  onHighlightsChange,
}: MoveBoardProps) {
  const { pieces } = usePieceSet()
  const boardRef = useRef<HTMLDivElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ code: string; x: number; y: number; from: string } | null>(null)
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null)
  // Drawing works on every move board: saved through the handlers when
  // given, otherwise a sketch that goes when the position moves on.
  const draw = useRightClickDraw({
    boardRef,
    arrows: arrows ?? [],
    highlights: highlights ?? [],
    onArrowsChange,
    onHighlightsChange,
    resetKey: fen,
    onHold: () => {
      setSelected(null)
      setDrag(null)
    },
  })

  const chess = useMemo(() => {
    try {
      return new Chess(normalizeFen(fen))
    } catch {
      return null
    }
  }, [fen])

  // Every piece's moves, worked out when the position appears rather than
  // when a piece is pressed, so selecting one shows its moves at once.
  const legal = useMemo(() => {
    const map = new Map<string, Set<string>>()
    if (!chess) return map
    for (const m of chess.moves({ verbose: true })) {
      const set = map.get(m.from) ?? new Set<string>()
      set.add(m.to)
      map.set(m.from, set)
    }
    return map
  }, [chess])
  const targets = (selected && legal.get(selected)) || NO_TARGETS

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
    if (draw.onPointerDown(e)) return
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
      // A finger that rested has become a pen; the piece stays put.
      if (draw.claimed()) return
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return
      // React hears about the drag once, when it starts; after that the piece
      // under the finger is moved directly, so the board isn't re-rendered
      // on every pointer move.
      if (!dragging) setDrag({ code, x: ev.clientX, y: ev.clientY, from: square })
      dragging = true
      placeGhost(ev.clientX, ev.clientY)
    }
    const onUp = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      setDrag(null)
      if (!dragging || draw.claimed()) return
      const to = squareAtPoint(ev.clientX, ev.clientY, boardRef.current)
      if (to && to !== square && tryMove(square, to)) return
      setSelected(square)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  const DragPiece = drag ? pieces[drag.code] : null
  function placeGhost(x: number, y: number) {
    const el = ghostRef.current
    if (el) el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
  }
  const promoColor = chess?.turn() ?? 'w'

  return (
    <>
      <Board
        ref={boardRef}
        fen={fen}
        orientation={orientation}
        arrows={draw.arrows}
        highlights={draw.highlights}
        lastMove={lastMove}
        selected={draw.from}
        hiddenSquares={drag ? [drag.from] : undefined}
        interactive
        onPointerDown={onPointerDown}
        onContextMenu={draw.onContextMenu}
        overlay={
          // The selected piece and its moves, drawn on a layer of their own
          // that's always there: pressing a piece repaints only this, never
          // the squares and pieces beneath (dear with the textured skins).
          <svg className="pointer-events-none absolute inset-0 h-full w-full will-change-transform" viewBox="0 0 8 8" aria-hidden>
            {selected && <SelectRing square={selected} orientation={orientation} />}
            {[...targets].map((sq) => {
              const c = squareToCell(sq, orientation)
              return chess?.get(sq as Square) ? (
                <circle key={sq} cx={c.x + 0.5} cy={c.y + 0.5} r={0.405} fill="none" stroke="var(--board-select)" strokeWidth={0.07} />
              ) : (
                <circle key={sq} cx={c.x + 0.5} cy={c.y + 0.5} r={0.16} fill="var(--board-select)" />
              )
            })}
          </svg>
        }
      />
      {drag && DragPiece && (
        <div
          ref={ghostRef}
          className="pointer-events-none fixed top-0 left-0 z-50 h-16 w-16 drop-shadow-lg will-change-transform"
          style={{ transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -50%)` }}
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

const NO_TARGETS: ReadonlySet<string> = new Set()

/** The pressed piece's square, outlined the way a selected square always was. */
function SelectRing({ square, orientation }: { square: string; orientation: Orientation }) {
  const c = squareToCell(square, orientation)
  return <rect x={c.x + 0.04} y={c.y + 0.04} width={0.92} height={0.92} fill="none" stroke="var(--board-select)" strokeWidth={0.08} />
}
