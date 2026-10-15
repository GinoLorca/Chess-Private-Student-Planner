// The Lichess opening explorer (Repertoire Lab's src/lib/explorer.js). The
// public host has started demanding authorisation, so a Lichess API token is
// sent when one has been entered.

export interface ExplorerMove {
  uci: string
  san: string
  white: number
  draws: number
  black: number
}
export interface ExplorerData {
  white: number
  draws: number
  black: number
  moves: ExplorerMove[]
}

export class ExplorerError extends Error {
  needsToken = false
}

export async function fetchExplorer(fen: string, db: 'lichess' | 'masters', token?: string): Promise<ExplorerData> {
  let url: string
  if (db === 'masters') {
    url = `https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}&moves=12`
  } else {
    const params = new URLSearchParams({
      variant: 'standard',
      fen,
      moves: '12',
      speeds: 'blitz,rapid,classical',
      ratings: '1200,1400,1600,1800,2000,2200,2500',
    })
    url = `https://explorer.lichess.ovh/lichess?${params}`
  }
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
  if (res.status === 401) {
    const err = new ExplorerError(token ? 'Lichess rejected that API token (401).' : 'Lichess is asking for an API token for explorer requests (401).')
    err.needsToken = true
    throw err
  }
  if (res.status === 429) throw new ExplorerError('Lichess is rate-limiting explorer requests — try again shortly.')
  if (!res.ok) throw new ExplorerError(`Lichess explorer request failed (${res.status})`)
  return res.json()
}

export const explorerTotals = (entry: { white: number; draws: number; black: number }) => entry.white + entry.draws + entry.black

export function pct(part: number, total: number) {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}
