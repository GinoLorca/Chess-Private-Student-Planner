import { useState } from 'react'
import { Chessboard, ChessboardProvider, SparePiece, fenStringToPositionObject } from 'react-chessboard'
import type { PieceDropHandlerArgs, PositionDataType } from 'react-chessboard'
import { EMPTY_FEN, START_FEN, SPARE_PIECE_TYPES, positionToFen } from '../../lib/chessboardUtils'
import { usePieceSet } from '../../state/PieceSetContext'

export function PositionSetupBoard({
  fen,
  sideToMove,
  onChange,
  onSideToMoveChange,
}: {
  fen: string
  sideToMove: 'w' | 'b'
  onChange: (fen: string) => void
  onSideToMoveChange: (side: 'w' | 'b') => void
}) {
  const [fenDraft, setFenDraft] = useState(fen)
  const position = fenStringToPositionObject(fen, 8, 8)
  const { pieces } = usePieceSet()

  function handleDrop({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!targetSquare) {
      if (piece.isSparePiece) return false
      const next: PositionDataType = { ...position }
      delete next[sourceSquare]
      onChange(positionToFen(next, sideToMove))
      return true
    }
    const next: PositionDataType = { ...position }
    if (!piece.isSparePiece) delete next[sourceSquare]
    next[targetSquare] = { pieceType: piece.pieceType }
    onChange(positionToFen(next, sideToMove))
    return true
  }

  function applyFenDraft() {
    if (!fenDraft.trim()) return
    onChange(fenDraft.trim())
    setFenDraft(fenDraft.trim())
  }

  const options = {
    id: 'setup-board',
    position,
    boardOrientation: 'white' as const,
    allowDragging: true,
    allowDragOffBoard: true,
    allowDrawingArrows: false,
    onPieceDrop: handleDrop,
    pieces,
    darkSquareStyle: { backgroundColor: 'var(--color-board-dark)', boxShadow: 'inset 0 0 0 1.5px var(--color-board-line)' },
    lightSquareStyle: { backgroundColor: 'var(--color-board-light)', boxShadow: 'inset 0 0 0 1.5px var(--color-board-line)' },
    darkSquareNotationStyle: { color: 'var(--color-board-coord)', fontWeight: 700 },
    lightSquareNotationStyle: { color: 'var(--color-board-coord)', fontWeight: 700 },
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={fenDraft}
          onChange={(e) => setFenDraft(e.target.value)}
          placeholder="Paste a FEN from Lichess / Chess.com / Chessable…"
          className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-800 px-2 py-1.5 font-mono text-xs text-ink-100 outline-none focus:border-gold-500"
        />
        <button
          onClick={applyFenDraft}
          className="rounded-lg bg-ink-700 px-3 py-1.5 text-xs font-medium text-ink-100 hover:bg-ink-600"
        >
          Load FEN
        </button>
      </div>

      <ChessboardProvider options={options}>
        <div className="grid grid-cols-6 gap-1 rounded-lg bg-ink-800 p-2">
          {SPARE_PIECE_TYPES.map((pt) => (
            <div key={pt} className="aspect-square">
              <SparePiece pieceType={pt} />
            </div>
          ))}
        </div>
        <div className="mx-auto max-w-[650px]" onContextMenu={(e) => e.preventDefault()}>
          <Chessboard />
        </div>
      </ChessboardProvider>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-ink-800 p-1">
          <button
            onClick={() => onSideToMoveChange('w')}
            className={`rounded-md px-3 py-1 text-xs font-medium ${sideToMove === 'w' ? 'bg-gold-500 text-ink-950' : 'text-ink-300'}`}
          >
            White to move
          </button>
          <button
            onClick={() => onSideToMoveChange('b')}
            className={`rounded-md px-3 py-1 text-xs font-medium ${sideToMove === 'b' ? 'bg-gold-500 text-ink-950' : 'text-ink-300'}`}
          >
            Black to move
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              onChange(START_FEN)
              setFenDraft(START_FEN)
            }}
            className="text-xs text-ink-400 hover:text-ink-100"
          >
            Starting position
          </button>
          <button
            onClick={() => {
              onChange(EMPTY_FEN)
              setFenDraft(EMPTY_FEN)
            }}
            className="text-xs text-ink-400 hover:text-red-400"
          >
            Clear board
          </button>
        </div>
      </div>
    </div>
  )
}
