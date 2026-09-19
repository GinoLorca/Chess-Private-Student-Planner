import { useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { START_FEN } from '../lib/chessboardUtils'
import { PIECE_SET_OPTIONS, PIECE_SETS } from '../lib/pieceSets'
import type { PieceSetId } from '../lib/pieceSets'
import { usePieceSet } from '../state/PieceSetContext'

function PieceSetPreview({ id }: { id: PieceSetId }) {
  const options = {
    id: `preview-${id}`,
    position: START_FEN,
    allowDragging: false,
    allowDrawingArrows: false,
    showNotation: false,
    pieces: PIECE_SETS[id],
    darkSquareStyle: { backgroundColor: 'var(--color-board-dark)', boxShadow: 'inset 0 0 0 1px var(--color-board-line)' },
    lightSquareStyle: { backgroundColor: 'var(--color-board-light)', boxShadow: 'inset 0 0 0 1px var(--color-board-line)' },
  }
  return (
    <div className="pointer-events-none overflow-hidden rounded-lg">
      <Chessboard options={options} />
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { pieceSetId, setPieceSetId } = usePieceSet()

  return (
    <div className="mx-auto min-h-svh max-w-3xl px-6 py-10">
      <button onClick={() => navigate('/')} className="mb-6 text-xs text-ink-400 hover:text-ink-100">
        ← Back
      </button>

      <h1 className="font-marker mb-1 text-3xl text-gold-500">Settings</h1>
      <p className="mb-8 text-sm text-ink-300">Choose how the chess pieces look everywhere in the app.</p>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Chess piece set</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PIECE_SET_OPTIONS.map((opt) => {
          const active = pieceSetId === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => setPieceSetId(opt.id)}
              className={`rounded-xl border-2 p-3 text-left transition ${
                active ? 'border-gold-500 bg-gold-500/5' : 'border-ink-800 bg-ink-900/50 hover:border-ink-600'
              }`}
            >
              <div className="mx-auto w-full max-w-[180px]">
                <PieceSetPreview id={opt.id} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-100">{opt.label}</span>
                {active && <span className="text-[10.5px] font-bold uppercase tracking-wide text-gold-500">Selected</span>}
              </div>
              <p className="mt-0.5 text-xs text-ink-400">{opt.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
