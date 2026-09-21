import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import * as api from '../lib/data'
import { keys } from '../lib/queries'
import {
  DEFAULT_PIECE_SET,
  PIECE_SETS,
  isPieceSetId,
  normalizePieceSetId,
  renderersFromImages,
  type PieceRenderers,
} from '../lib/pieceSets'
import { DEFAULT_BOARD_THEME, applyBoardColors, clearBoardColors, resolveBoard } from '../lib/boardThemes'
import { FOLDER_SKIN, applySkin, isSkinId } from '../lib/skins'
import type { CustomBoard, CustomPieceSet, UserSettings } from '../types/domain'

interface VisualsContextValue {
  pieceSetId: string
  pieces: PieceRenderers
  customSets: CustomPieceSet[]
  setPieceSetId: (id: string) => void
  boardTheme: string
  customBoard: CustomBoard | null
  setBoardTheme: (id: string, custom?: CustomBoard) => void
  skin: string
  setSkin: (id: string) => void
  settings: UserSettings | null
  updateSettings: (patch: api.SettingsPatch) => void
}

const VisualsContext = createContext<VisualsContextValue | null>(null)
const NO_SETS: CustomPieceSet[] = []

/** Lets a subtree (the Settings previews) render a different set than the coach's pick. */
export const PieceSetOverrideContext = createContext<PieceRenderers | null>(null)

/**
 * Everything about how boards look: the piece set (built-in or imported), the
 * board colours, and the settings row they're saved in. Cached with the rest
 * of the data so the lesson table never waits on it.
 */
export function PieceSetProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const qc = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: keys.settings,
    queryFn: api.getUserSettings,
    enabled: Boolean(session),
  })
  const setsQuery = useQuery({
    queryKey: keys.pieceSets,
    queryFn: api.listCustomPieceSets,
    enabled: Boolean(session),
  })

  const update = useMutation({
    mutationFn: (patch: api.SettingsPatch) => api.updateUserSettings(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: keys.settings })
      const prev = qc.getQueryData<UserSettings | null>(keys.settings)
      qc.setQueryData<UserSettings | null>(keys.settings, (old) => ({
        user_id: old?.user_id ?? '',
        piece_set: old?.piece_set ?? DEFAULT_PIECE_SET,
        updated_at: new Date().toISOString(),
        ...old,
        ...patch,
      }))
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(keys.settings, ctx?.prev ?? null),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.settings }),
  })

  const settings = settingsQuery.data ?? null
  const customSets = setsQuery.data ?? NO_SETS
  const pieceSetId = normalizePieceSetId(settings?.piece_set ?? DEFAULT_PIECE_SET)
  const boardTheme = settings?.board_theme ?? DEFAULT_BOARD_THEME
  const customBoard = settings?.custom_board ?? null
  const skin = settings?.skin && isSkinId(settings.skin) ? settings.skin : FOLDER_SKIN

  const pieces = useMemo<PieceRenderers>(() => {
    if (isPieceSetId(pieceSetId)) return PIECE_SETS[pieceSetId]
    const custom = customSets.find((s) => `custom:${s.id}` === pieceSetId)
    return custom ? renderersFromImages(custom.images) : PIECE_SETS[DEFAULT_PIECE_SET]
  }, [pieceSetId, customSets])

  useEffect(() => {
    // Board colour presets belong to the Folder look; a skin's squares are its own.
    if (skin === FOLDER_SKIN) applyBoardColors(resolveBoard(boardTheme, customBoard))
    else clearBoardColors()
  }, [boardTheme, customBoard, skin])

  useEffect(() => {
    if (settings) applySkin(skin)
  }, [skin, settings])

  const value = useMemo<VisualsContextValue>(
    () => ({
      pieceSetId,
      pieces,
      customSets,
      setPieceSetId: (id) => update.mutate({ piece_set: id }),
      boardTheme,
      customBoard,
      setBoardTheme: (id, custom) => update.mutate(custom ? { board_theme: id, custom_board: custom } : { board_theme: id }),
      skin,
      setSkin: (id) => update.mutate({ skin: id }),
      settings,
      updateSettings: (patch) => update.mutate(patch),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pieceSetId, pieces, customSets, boardTheme, customBoard, skin, settings],
  )

  return <VisualsContext.Provider value={value}>{children}</VisualsContext.Provider>
}

export function usePieceSet() {
  const ctx = useContext(VisualsContext)
  const override = useContext(PieceSetOverrideContext)
  if (!ctx) throw new Error('usePieceSet must be used within PieceSetProvider')
  return override ? { ...ctx, pieces: override } : ctx
}

export const useVisuals = usePieceSet
