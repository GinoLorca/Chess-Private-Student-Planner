import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { getUserSettings, updateUserSettings } from '../lib/api'
import { DEFAULT_PIECE_SET, PIECE_SETS, type PieceSetId } from '../lib/pieceSets'
import type { PieceRenderObject } from 'react-chessboard'

interface PieceSetContextValue {
  pieceSetId: PieceSetId
  pieces: PieceRenderObject
  setPieceSetId: (id: PieceSetId) => void
}

const PieceSetContext = createContext<PieceSetContextValue | null>(null)

export function PieceSetProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [pieceSetId, setPieceSetIdState] = useState<PieceSetId>(DEFAULT_PIECE_SET)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    getUserSettings().then((settings) => {
      if (!cancelled && settings) setPieceSetIdState(settings.piece_set)
    })
    return () => {
      cancelled = true
    }
  }, [session])

  function setPieceSetId(id: PieceSetId) {
    setPieceSetIdState(id)
    updateUserSettings({ piece_set: id }).catch(() => {
      // Preference still applies for this session even if the sync write fails.
    })
  }

  return (
    <PieceSetContext.Provider value={{ pieceSetId, pieces: PIECE_SETS[pieceSetId], setPieceSetId }}>
      {children}
    </PieceSetContext.Provider>
  )
}

export function usePieceSet() {
  const ctx = useContext(PieceSetContext)
  if (!ctx) throw new Error('usePieceSet must be used within PieceSetProvider')
  return ctx
}
