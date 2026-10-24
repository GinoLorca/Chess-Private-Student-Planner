import { Chess, type Move, type Square } from 'chess.js'
import type { Puzzle, PuzzleLevel, PuzzleLevels, SolutionMove } from '../types/domain'
import { normalizeFen, parsePlacement } from './fen'

// ---------------------------------------------------------------------------
// De-Construct's strip-down: the Beginner and Intermediate versions of a
// position, suggested by taking pieces off while Stockfish (the app's own,
// on the device) confirms the idea still stands.
//
// The idea is the answer's first move. A piece may come off only if, without
// it, that move still works as well as it did (a mate stays a mate, about as
// short; a win stays about as big; a save still saves) and it is still the
// move (whatever else there is still falls as far short as it did). Kings,
// the pieces that move in the answer and the pieces it captures stay. Pieces
// furthest from the action go first, a whole group at a time when the group
// can go together, and one by one when it can't. What can't come off is the
// Beginner; the Intermediate puts back the half of the rest nearest the
// action. Both are looked at again, deeper, before they're offered.
// ---------------------------------------------------------------------------

const MATE = 100_000

interface Probe {
  /** Side-to-move score: centipawns, or ±(MATE − moves) for a mate. */
  value: number
  mate: number | null
  pv: string[]
}

/** A Stockfish of its own (its own worker), asked one thing at a time and answering with a promise. */
class Stockfish {
  private worker = new Worker('/stockfish/stockfish-nnue-16-single.js')
  private ready: Promise<void>
  private chain: Promise<unknown> = Promise.resolve()
  private onLine: ((line: string) => void) | null = null

  constructor() {
    let resolveReady = () => {}
    this.ready = new Promise<void>((r) => (resolveReady = r))
    this.worker.onmessage = (e) => {
      const line = String(e.data)
      if (line === 'uciok') {
        this.worker.postMessage('setoption name MultiPV value 1')
        this.worker.postMessage('setoption name Use NNUE value true')
        this.worker.postMessage('isready')
      } else if (line === 'readyok') resolveReady()
      else this.onLine?.(line)
    }
    this.worker.postMessage('uci')
  }

  /** The best line at this depth, among `moves` only when given (UCI searchmoves); null when there's no legal move. */
  search(fen: string, depth: number, moves?: string[]): Promise<Probe | null> {
    const run = async () => {
      await this.ready
      return new Promise<Probe | null>((resolve) => {
        let last: Probe | null = null
        this.onLine = (line) => {
          if (line.startsWith('info ') && line.includes(' pv ') && !/ multipv [2-9]/.test(line)) {
            const cp = /\bscore cp (-?\d+)/.exec(line)
            const mate = /\bscore mate (-?\d+)/.exec(line)
            const pv = /\bpv (.+)$/.exec(line)?.[1].trim().split(/\s+/) ?? []
            if (cp) last = { value: Number(cp[1]), mate: null, pv }
            else if (mate) {
              const m = Number(mate[1])
              last = { value: m > 0 ? MATE - m : -MATE - m, mate: m, pv }
            }
          } else if (line.startsWith('bestmove')) {
            this.onLine = null
            const best = line.split(/\s+/)[1]
            resolve(!best || best === '(none)' ? null : (last ?? { value: 0, mate: null, pv: [best] }))
          }
        }
        this.worker.postMessage(`position fen ${fen}`)
        this.worker.postMessage(`go depth ${depth}${moves && moves.length ? ` searchmoves ${moves.join(' ')}` : ''}`)
      })
    }
    const p = this.chain.then(run)
    this.chain = p.catch(() => {})
    return p
  }

  quit() {
    this.worker.postMessage('quit')
    this.worker.terminate()
  }
}

const uciOf = (m: Pick<Move, 'from' | 'to' | 'promotion'>) => `${m.from}${m.to}${m.promotion ?? ''}`
const FILES = 'abcdefgh'
const dist = (a: string, b: string) => Math.max(Math.abs(FILES.indexOf(a[0]) - FILES.indexOf(b[0])), Math.abs(Number(a[1]) - Number(b[1])))

type Placement = Record<string, string>

/** The pieces of a FEN, square → 'wK', as a plain record. */
const piecesOf = (fen: string): Placement => {
  const out: Placement = {}
  for (const [sq, code] of Object.entries(parsePlacement(fen))) if (code) out[sq] = code
  return out
}

function placementFen(p: Placement): string {
  const rows: string[] = []
  for (let rank = 8; rank >= 1; rank--) {
    let row = ''
    let empty = 0
    for (const f of FILES) {
      const code = p[`${f}${rank}`]
      if (!code) {
        empty++
        continue
      }
      if (empty) row += empty
      empty = 0
      row += code[0] === 'w' ? code[1] : code[1].toLowerCase()
    }
    rows.push(row + (empty || ''))
  }
  return rows.join('/')
}

/** The position with these pieces: castling only where king and rook still stand at home, no en passant unless the answer takes so. */
function fenOf(p: Placement, side: 'w' | 'b', castling: string, ep: string): string {
  const rights = [...castling.replace('-', '')]
    .filter((r) => {
      const [king, rook] = { K: ['e1', 'h1'], Q: ['e1', 'a1'], k: ['e8', 'h8'], q: ['e8', 'a8'] }[r] ?? []
      const c = r === r.toUpperCase() ? 'w' : 'b'
      return p[king] === `${c}K` && p[rook] === `${c}R`
    })
    .join('')
  return `${placementFen(p)} ${side} ${rights || '-'} ${ep} 0 1`
}

/** A position fit to be a puzzle: legal, the side not to move not in check, and the key move playable. */
function playable(fen: string, key: string): Chess | null {
  try {
    const chess = new Chess(fen)
    // The side that just "moved" can't be left in check.
    const turn = chess.turn()
    const theirKing = Object.entries(piecesOf(fen)).find(([, code]) => code === `${turn === 'w' ? 'b' : 'w'}K`)?.[0]
    if (!theirKing || chess.isAttacked(theirKing as Square, turn)) return null
    const legal = chess.moves({ verbose: true })
    if (!legal.some((m) => uciOf(m) === key)) return null
    return chess
  } catch {
    return null
  }
}

export interface Progress {
  /** Positions Stockfish has looked at so far. */
  looked: number
  /** Pieces that could come off, and how many have so far. */
  candidates: number
  removed: number
  stage: 'start' | 'stripping' | 'intermediate' | 'checking'
}

export interface Suggestion {
  levels: PuzzleLevels
  /** Why a level is missing, or anything the coach should know. */
  note?: string
}

/**
 * The suggested Beginner and Intermediate for a position with a recorded
 * answer. `depth` is how deep each look is during the strip-down (a deeper
 * check of the two results follows). Takes a few seconds to half a minute.
 */
export async function suggestLevels(
  puzzle: Puzzle,
  {
    depth = 12,
    finalDepth = 16,
    keepLine = true,
    onProgress,
    signal,
  }: {
    depth?: number
    finalDepth?: number
    /**
     * The whole answer, not just its first move: Stockfish's line from the key
     * move must still follow the recorded one, as far as it did in the
     * position itself (the same sacrifices, the same forced replies, the same
     * win at the end). Off, only the first move has to survive, and more comes off.
     */
    keepLine?: boolean
    onProgress?: (p: Progress) => void
    signal?: AbortSignal
  } = {},
): Promise<Suggestion> {
  const fen0 = normalizeFen(puzzle.starting_fen === 'start' ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : puzzle.starting_fen, puzzle.side_to_move)
  const [, side, castling, ep0] = fen0.split(' ') as [string, 'w' | 'b', string, string]
  if (!puzzle.solution.length) throw new Error('Record the answer first: De-Construct keeps its first move as the idea.')

  // The answer, replayed: its first move is the idea; the pieces that move in
  // it, the ones it takes, and the kings stay.
  const replay = new Chess(fen0)
  const keep = new Set<string>()
  const action = new Set<string>()
  const origin = new Map<string, string>(Object.keys(piecesOf(fen0)).map((sq) => [sq, sq]))
  let key = ''
  // The recorded answer as engine moves, to hold the levels' lines against.
  const line: string[] = []
  for (const [i, step] of puzzle.solution.entries()) {
    let m: Move
    try {
      m = replay.move(step.san)
    } catch {
      if (i === 0) throw new Error(`The answer's first move, ${step.san}, isn't legal in this position.`)
      break
    }
    if (i === 0) key = uciOf(m)
    line.push(uciOf(m))
    keep.add(origin.get(m.from) ?? m.from)
    action.add(m.from)
    action.add(m.to)
    if (m.captured) {
      const takenOn = m.flags.includes('e') ? `${m.to[0]}${m.from[1]}` : m.to
      keep.add(origin.get(takenOn) ?? takenOn)
    }
    // Castling moves the rook too.
    if (m.flags.includes('k') || m.flags.includes('q')) {
      const rank = m.from[1]
      const [rf, rt] = m.flags.includes('k') ? [`h${rank}`, `f${rank}`] : [`a${rank}`, `d${rank}`]
      keep.add(origin.get(rf) ?? rf)
      origin.set(rt, origin.get(rf) ?? rf)
      origin.delete(rf)
    }
    origin.set(m.to, origin.get(m.from) ?? m.from)
    origin.delete(m.from)
  }
  const keyIsEp = new Chess(fen0).moves({ verbose: true }).some((m) => uciOf(m) === key && m.flags.includes('e'))
  const ep = keyIsEp ? ep0 : '-'
  const start = piecesOf(fen0)
  for (const [sq, code] of Object.entries(start)) {
    if (code[1] !== 'K') continue
    keep.add(sq)
    action.add(sq)
  }

  const engine = new Stockfish()
  let looked = 0
  const report = (p: Omit<Progress, 'looked'>) => onProgress?.({ ...p, looked })
  try {
    /** The key move's score, and the best of everything else, at this depth. */
    const measure = async (fen: string, at: number) => {
      const chess = new Chess(fen)
      const others = chess.moves({ verbose: true }).map(uciOf).filter((u) => u !== key)
      looked++
      const [mine, rest] = await Promise.all([engine.search(fen, at, [key]), others.length ? engine.search(fen, at, others) : Promise.resolve(null)])
      return { mine, rest }
    }
    report({ candidates: 0, removed: 0, stage: 'start' })
    const base = await measure(fen0, depth)
    if (!base.mine) throw new Error("Stockfish couldn't look at this position.")
    const baseGap = base.mine.value - (base.rest?.value ?? -MATE * 2)
    // How short of the key move everything else must still fall: clearly short
    // (a pawn and a half, or under half the original margin) when the move was
    // decisive; about as short as before when it was close.
    const neededGap = baseGap >= 160 ? Math.min(baseGap * 0.4, 150) : Math.max(0, baseGap - 50)
    // How far Stockfish's own line in the position itself follows the recorded
    // answer, at each depth: a level's line has to follow it at least as far.
    const along = (pv: string[]) => {
      let n = 0
      while (n < pv.length && n < line.length && pv[n] === line[n]) n++
      return n
    }
    const agreed = new Map<number, number>([[depth, along(base.mine.pv)]])
    const agreedAt = async (at: number) => {
      if (!agreed.has(at)) agreed.set(at, along((await measure(fen0, at)).mine?.pv ?? [key]))
      return agreed.get(at)!
    }

    const holds = async (fen: string, at: number) => {
      if (signal?.aborted) throw new DOMException('Stopped', 'AbortError')
      if (!playable(fen, key)) return null
      // Checked before Stockfish is asked, since it costs nothing: the same defences.
      if (keepLine && !sameDefences(fen0, fen, line)) return null
      const { mine, rest } = await measure(fen, at)
      if (!mine) return null
      if (base.mine!.mate !== null && base.mine!.mate > 0) {
        // A mate stays a mate, at most a move longer.
        if (mine.mate === null || mine.mate <= 0 || mine.mate > base.mine!.mate + 1) return null
      } else if (mine.value < Math.min(base.mine!.value - 100, base.mine!.value * 0.6)) return null
      const gap = mine.value - (rest?.value ?? -MATE * 2)
      if (gap < neededGap) return null
      if (keepLine) {
        const need = Math.max(1, await agreedAt(at))
        const got = along(mine.pv)
        // Short only where the line itself ends sooner, in a mate.
        if (got < need && !(got === mine.pv.length && mine.mate !== null && mine.mate > 0)) return null
      }
      return mine
    }

    // Furthest from the action first; at the same distance, pawns before pieces.
    const actionSquares = [...action]
    const away = (sq: string) => Math.min(...actionSquares.map((a) => dist(sq, a)))
    const candidates = Object.keys(start)
      .filter((sq) => !keep.has(sq))
      .sort((a, b) => away(b) - away(a) || Number(start[b][1] === 'P') - Number(start[a][1] === 'P') || a.localeCompare(b))

    let current: Placement = { ...start }
    const removed: string[] = []
    // Every position the strip-down passed through, each one Stockfish agreed still holds the idea.
    const path: Placement[] = []
    const without = (p: Placement, squares: string[]) => {
      const next = { ...p }
      for (const sq of squares) delete next[sq]
      return next
    }
    const tryGroup = async (group: string[]): Promise<void> => {
      if (group.length === 0) return
      const trial = without(current, group)
      if (await holds(fenOf(trial, side, castling, ep), depth)) {
        current = trial
        removed.push(...group)
        path.push(trial)
        report({ candidates: candidates.length, removed: removed.length, stage: 'stripping' })
        return
      }
      if (group.length === 1) return
      const mid = Math.ceil(group.length / 2)
      await tryGroup(group.slice(0, mid))
      await tryGroup(group.slice(mid))
    }
    report({ candidates: candidates.length, removed: 0, stage: 'stripping' })
    await tryGroup(candidates)

    if (removed.length === 0) {
      return { levels: {}, note: 'Every piece matters here: without any one of them the idea changes. Build the easier versions by hand if you want them.' }
    }

    // Intermediate: halfway along the way down (the far pieces gone, the
    // nearer ones still on), a step Stockfish already agreed to. When the
    // pieces all came off in one go, the nearest of them go back on instead.
    report({ candidates: candidates.length, removed: removed.length, stage: 'intermediate' })
    const nearest = [...removed].sort((a, b) => away(a) - away(b) || a.localeCompare(b))
    const total = Object.keys(start).length
    const end = Object.keys(current).length
    const halfway = (total + end) / 2
    let middle: Placement | null =
      path
        .slice(0, -1)
        .map((p) => ({ p, n: Object.keys(p).length }))
        .filter(({ n }) => n < total && n > end)
        .sort((a, b) => Math.abs(a.n - halfway) - Math.abs(b.n - halfway))[0]?.p ?? null
    if (!middle && removed.length >= 2) {
      const tries = [...new Set([Math.ceil(removed.length / 2), Math.ceil(removed.length / 3), Math.ceil((removed.length * 2) / 3)])].filter((k) => k > 0 && k < removed.length)
      // The nearest back first (more to think about around the idea), then the
      // furthest (more to see past on the way to it).
      const farthest = [...nearest].reverse()
      search: for (const order of [nearest, farthest]) {
        for (const k of tries) {
          const trial: Placement = { ...current }
          for (const sq of order.slice(0, k)) trial[sq] = start[sq]
          if (await holds(fenOf(trial, side, castling, ep), depth)) {
            middle = trial
            break search
          }
        }
      }
    }

    // A deeper look at both, and their answers from it.
    report({ candidates: candidates.length, removed: removed.length, stage: 'checking' })
    // When the deeper look disagrees, the nearest pieces go back one at a time
    // (up to four) until it agrees; failing that the level is offered unchecked.
    const level = async (p: Placement, spare: string[]): Promise<PuzzleLevel> => {
      let fen = fenOf(p, side, castling, ep)
      let deep = await holds(fen, finalDepth)
      for (let i = 0, trial = { ...p }; !deep && i < Math.min(4, spare.length); i++) {
        trial = { ...trial, [spare[i]]: start[spare[i]] }
        const f = fenOf(trial, side, castling, ep)
        const d = await holds(f, finalDepth)
        if (d) {
          fen = f
          deep = d
        }
      }
      const line = deep ?? (await engine.search(fen, depth, [key]))
      return {
        starting_fen: fen,
        side_to_move: side,
        label: '',
        quiz_prompt: puzzle.quiz_prompt,
        summary: '',
        solution: answerFrom(fen, line?.pv ?? [key], puzzle.solution),
        arrows: [],
        highlights: [],
        made: { by: 'engine', checked: Boolean(deep) },
      }
    }
    const levels: PuzzleLevels = { beginner: await level(current, nearest) }
    if (middle) {
      const m = middle
      levels.intermediate = await level(m, nearest.filter((sq) => !m[sq]))
    }
    // An Intermediate the Beginner caught up with while being checked is no in-between.
    if (levels.intermediate && levels.beginner && levels.intermediate.starting_fen.split(' ')[0] === levels.beginner.starting_fen.split(' ')[0]) delete levels.intermediate
    for (const l of Object.values(levels)) if (l) l.label = l.solution[0]?.san ?? puzzle.label
    return {
      levels,
      note: middle ? undefined : removed.length < 2 ? 'Only one piece could come off, so there is no in-between.' : 'No in-between held the idea, so there is no Intermediate.',
    }
  } finally {
    engine.quit()
  }
}

/**
 * Whether the defending side, played through the recorded answer, has no way
 * out of a check it didn't have in the position itself: no block, flight or
 * capture that a missing piece used to stop (the queen interposing on g2
 * once the g3 pawn is gone). Those turn the idea into another one even when
 * Stockfish still plays the same line.
 */
function sameDefences(original: string, level: string, line: string[]): boolean {
  const a = new Chess(original)
  let b: Chess
  try {
    b = new Chess(level)
  } catch {
    return false
  }
  for (const [i, uci] of line.entries()) {
    // The defender is to move on every other ply, after the solver's moves.
    if (i % 2 === 1 && b.inCheck()) {
      const before = new Set(a.moves({ verbose: true }).map(uciOf))
      if (b.moves({ verbose: true }).some((m) => !before.has(uciOf(m)))) return false
    }
    const move = { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }
    try {
      a.move(move)
      b.move(move)
    } catch {
      // The line stops replaying here; Stockfish's agreement covers the rest.
      return true
    }
  }
  return true
}

/**
 * The answer for a level: Stockfish's line from it, as long as the original
 * answer (or to the mate), with the original's notes kept on the moves that
 * are still the same moves.
 */
function answerFrom(fen: string, pv: string[], original: SolutionMove[]): SolutionMove[] {
  const chess = new Chess(fen)
  const out: SolutionMove[] = []
  let same = true
  for (const uci of pv.slice(0, Math.max(1, original.length))) {
    let m: Move
    try {
      m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    } catch {
      break
    }
    same = same && original[out.length]?.san === m.san
    const comment = same ? original[out.length]?.comment : undefined
    out.push({ san: m.san, fen: chess.fen(), ...(comment ? { comment } : {}) })
    if (chess.isGameOver()) break
  }
  return out
}
