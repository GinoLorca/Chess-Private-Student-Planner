import { useCallback, useEffect, useState } from 'react'

// The analysis board's own options, the ones Repertoire Lab keeps in its
// Settings (src/lib/settingsDefaults.js there), with the same defaults. Kept
// on this device; the board's gear menu changes them.
export interface AnalysisSettings {
  evalBar: boolean
  engineLines: boolean
  engineArrows: boolean
  arrowBest: boolean
  arrowSecond: boolean
  arrowThird: boolean
  engineAuto: boolean
  soundEnabled: boolean
  showLegalMoves: boolean
  checkHighlight: boolean
  lastMoveHighlight: boolean
  /** ↑/↓ step one move (a presenter clicker) instead of jumping to the first or last. */
  clickerMode: boolean
  /** Sent to the Lichess opening explorer, which now asks for one. */
  lichessToken: string
}

export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  evalBar: true,
  engineLines: true,
  engineArrows: true,
  arrowBest: true,
  arrowSecond: true,
  arrowThird: true,
  engineAuto: true,
  soundEnabled: true,
  showLegalMoves: true,
  checkHighlight: true,
  lastMoveHighlight: true,
  clickerMode: false,
  lichessToken: '',
}

const KEY = 'analysis-settings'

function read(): AnalysisSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_ANALYSIS_SETTINGS, ...(JSON.parse(raw) as Partial<AnalysisSettings>) } : DEFAULT_ANALYSIS_SETTINGS
  } catch {
    return DEFAULT_ANALYSIS_SETTINGS
  }
}

export function useAnalysisSettings(): [AnalysisSettings, (patch: Partial<AnalysisSettings>) => void] {
  const [settings, setSettings] = useState(read)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      // storage off: the choices last until the page is closed
    }
  }, [settings])
  const update = useCallback((patch: Partial<AnalysisSettings>) => setSettings((s) => ({ ...s, ...patch })), [])
  return [settings, update]
}
