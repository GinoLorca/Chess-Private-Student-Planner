import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PieceRenderObject } from 'react-chessboard'
import { useAuth } from '../auth/AuthProvider'
import { getUserSettings, updateUserSettings } from '../lib/data'
import { DEFAULT_PIECE_SET, PIECE_SETS, type PieceSetId } from '../lib/pieceSets'

interface PieceSetContextValue {
  pieceSetId: PieceSetId
  pieces: PieceRenderObject
  setPieceSetId: (id: PieceSetId) => void
}

const PieceSetContext = createContext<PieceSetContextValue | null>(null)

/** Lets a subtree (the Settings previews) render a different set than the coach's pick. */
export const PieceSetOverrideContext = createContext<PieceRenderObject | null>(null)

export function PieceSetProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [pieceSetId, setPieceSetIdState] = useState<PieceSetId>(() => {
    try {
      const cached = localStorage.getItem('pieceSet')
      return cached && cached in PIECE_SETS ? (cached as PieceSetId) : DEFAULT_PIECE_SET
    } catch {
      return DEFAULT_PIECE_SET
    }
  })

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
    try {
      localStorage.setItem('pieceSet', id)
    } catch {
      // cache only
    }
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
  const override = useContext(PieceSetOverrideContext)
  if (!ctx) throw new Error('usePieceSet must be used within PieceSetProvider')
  return override ? { ...ctx, pieces: override } : ctx
}
