import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Chess, type Square } from 'chess.js'
import { Page } from '../components/ui/Page'
import { useVisuals } from '../state/PieceSetContext'
import { useAppearance } from '../app/providers'
import { useResumeState } from '../lib/resume'
import { PENS, heldPen } from '../lib/pens'
import { Board } from '../analysis/Board'
import { BoardArrows, type Arrow } from '../analysis/BoardArrows'
import { LegalDots } from '../analysis/LegalDots'
import { EvalBar } from '../analysis/EvalBar'
import { MaterialBar } from '../analysis/MaterialBar'
import { PromotionPicker } from '../analysis/PromotionPicker'
import { MoveTree, type HighlightColor } from '../analysis/MoveTree'
import { Engine, formatScore, type EngineLine } from '../analysis/engine'
import { ExplorerError, explorerTotals, fetchExplorer, pct, type ExplorerData } from '../analysis/explorer'
import { lastMoveOf } from '../analysis/legalMoves'
import { materialDiff } from '../analysis/material'
import { paletteFor } from '../analysis/palette'
import { playMoveSound, setSoundSkin, unlockSounds } from '../analysis/sound'
import { useAnalysisSettings, type AnalysisSettings } from '../analysis/settings'
import {
  addMove,
  alternativesAt,
  branchRootOf,
  hasVariations,
  keepMainLineOnly,
  lastMainLineAncestor,
  lineThrough,
  mainLineFrom,
  makeTree,
  nodePath,
  promote,
  promoteOne,
  removeNode,
  type MoveNode,
} from '../analysis/moveTree'
import '../analysis/analysis.css'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// Best move, second, third — three hues rather than three blues, so a glance
// at the board tells you which arrow is which line.
const ARROW_COLORS = ['rgba(56, 176, 120, 0.92)', 'rgba(59, 132, 235, 0.85)', 'rgba(226, 142, 46, 0.85)']

type Marks = { arrows: Arrow[]; squares: Record<string, string> }
const EMPTY_MARKS: Marks = { arrows: [], squares: {} }

const SLOT_COLORS: HighlightColor[] = ['green', 'blue', 'yellow']

// The window, measured the way Repertoire Lab measures it: clientWidth and
// clientHeight leave out the scrollbar and aren't thrown by a zoom.
const pageWidth = () => document.documentElement.clientWidth || window.innerWidth
const pageHeight = () => document.documentElement.clientHeight || window.innerHeight
function useViewport() {
  const [size, setSize] = useState(() => ({ w: pageWidth(), h: pageHeight() }))
  useEffect(() => {
    const onResize = () => setSize({ w: pageWidth(), h: pageHeight() })
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])
  return size
}

// How much of the window the system sits on top of (the iPad's menu bar, the
// home indicator): a board sized in JavaScript has to leave it alone.
function inset(name: string) {
  const px = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  return Number.isFinite(px) ? px : 0
}

/** A path back into this app, never somewhere else. */
const safeBack = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') ? v : '/')

/**
 * The analysis board, carried over from Repertoire Lab (src/views/
 * AnalysisView.jsx there): its board, Stockfish 16 with the evaluation bar,
 * three lines and their arrows, the Lichess opening explorer, the move list
 * with variations, the pens, and the keyboard. Opened from a position, with
 * nothing of the lesson's own arrows on it.
 *
 * /analysis?fen=…&o=white|black&back=<path>&title=…
 */
export function AnalysisPage() {
  const [params] = useSearchParams()
  const fen = useMemo(() => {
    try {
      return new Chess(params.get('fen') ?? START_FEN).fen()
    } catch {
      return START_FEN
    }
  }, [params])
  // The position's own line, as far as it plays legally from the FEN.
  const line = useMemo(() => {
    const out: string[] = []
    const game = new Chess(fen)
    for (const san of (params.get('line') ?? '').split(/\s+/).filter(Boolean)) {
      try {
        out.push(game.move(san).san)
      } catch {
        break
      }
    }
    return out
  }, [fen, params])
  const at = Math.max(0, Math.min(line.length, Number(params.get('at')) || 0))
  return (
    <AnalysisBoard
      key={`${fen}|${line.join(' ')}`}
      baseFen={fen}
      line={line}
      startAt={at}
      startOrientation={params.get('o') === 'black' ? 'black' : 'white'}
      back={safeBack(params.get('back'))}
      title={params.get('title') ?? ''}
    />
  )
}

function AnalysisBoard({
  baseFen,
  line,
  startAt,
  startOrientation,
  back,
  title,
}: {
  baseFen: string
  /** The position's recorded line, loaded as the main line. */
  line: string[]
  /** The move of it the board opens on: 0 for the position itself. */
  startAt: number
  startOrientation: 'white' | 'black'
  back: string
  title: string
}) {
  const { skin } = useVisuals()
  const { resolved } = useAppearance()
  const palette = useMemo(() => paletteFor(skin, resolved), [skin, resolved])
  useEffect(() => {
    setSoundSkin(skin)
    unlockSounds()
  }, [skin])
  const [settings, setSettings] = useAnalysisSettings()

  // The line is a tree: playing something else from an earlier move keeps
  // what came after as a variation. `head` is the move the board is on. All
  // of it comes back if iOS closes the app while the board is open.
  const key = `analysis:${baseFen}:${line.join(' ')}`
  // The line sent with the position is the main line, ready to step through.
  const [sentTree] = useState(() => makeTree(line))
  const [tree, setTree] = useResumeState<MoveNode>(`${key}:tree`, sentTree)
  const [head, setHead] = useResumeState(`${key}:head`, () => (startAt > 0 ? mainLineFrom(sentTree)[startAt - 1].id : 'root'))
  const [orientation, setOrientation] = useResumeState<'white' | 'black'>(`${key}:o`, startOrientation)
  // Arrows and squares drawn with the pens, kept per position.
  const [annotations, setAnnotations] = useResumeState<Record<string, Marks>>(`${key}:marks`, {})
  // A colour on a whole variation, keyed by the branch's own root id.
  const [variationHighlights, setVariationHighlights] = useResumeState<Record<string, HighlightColor>>(`${key}:hl`, {})

  const [engineOn, setEngineOn] = useState(settings.engineAuto)
  const [engineLines, setEngineLines] = useState<Record<number, EngineLine>>({})
  const [engineStatus, setEngineStatus] = useState<'off' | 'starting' | 'running'>('off')
  const [db, setDb] = useState<'lichess' | 'masters'>('lichess')
  const [explorer, setExplorer] = useState<ExplorerData | null>(null)
  const [explorerError, setExplorerError] = useState<{ message: string; needsToken: boolean } | null>(null)
  const [tokenDraft, setTokenDraft] = useState('')
  const [sidePane, setSidePane] = useState<'engine' | 'explorer'>('engine')
  const [drawColor, setDrawColor] = useState(PENS[0].value)
  const [drawMode, setDrawMode] = useState(false)
  const [drawFrom, setDrawFrom] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null) // click-to-move: the piece you tapped
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: 'w' | 'b' } | null>(null)
  const [boardMenu, setBoardMenu] = useState(false)
  const engineRef = useRef<Engine | null>(null)
  const { w: viewportWidth, h: viewportHeight } = useViewport()

  const showEvalBar = settings.evalBar
  const showEngineLines = settings.engineLines
  const showEngineArrows = settings.engineArrows
  const arrowOn = [settings.arrowBest, settings.arrowSecond, settings.arrowThird]

  // ---------- The line ----------

  const lineNodes = useMemo(() => lineThrough(tree, head), [tree, head])
  const moves = useMemo(() => lineNodes.map((n) => n.san as string), [lineNodes])
  const ply = useMemo(() => nodePath(tree, head).length, [tree, head])
  /** Step to a point on the current line by its ply number. */
  const setPly = (value: number | ((p: number) => number)) => {
    const n = typeof value === 'function' ? value(ply) : value
    const clamped = Math.max(0, Math.min(moves.length, n))
    setHead(clamped === 0 ? 'root' : lineNodes[clamped - 1].id)
  }

  const game = useMemo(() => {
    const c = new Chess(baseFen)
    // A move that can't be played from here stops the replay instead of throwing.
    for (let i = 0; i < ply; i += 1) {
      try {
        if (!c.move(moves[i])) break
      } catch {
        break
      }
    }
    return c
  }, [baseFen, moves, ply])
  const fen = game.fen()
  const fenRef = useRef(fen) // read by the engine listener, which is set up once
  useEffect(() => {
    fenRef.current = fen
  })

  // A position set up from a lesson rarely starts the game: number and colour
  // the move list from wherever it actually begins.
  const baseMeta = useMemo(() => {
    const parts = baseFen.trim().split(/\s+/)
    return { startNumber: Number(parts[5]) || 1, startColor: (parts[1] === 'b' ? 'b' : 'w') as 'w' | 'b' }
  }, [baseFen])

  // ---------- Variations ----------

  const assignHighlight = (nodeId: string, color: HighlightColor | null) => {
    const rootId = branchRootOf(tree, nodeId)
    if (!rootId) return
    setVariationHighlights((prev) => {
      const next = { ...prev }
      if (!color || next[rootId] === color) delete next[rootId]
      else next[rootId] = color
      return next
    })
  }

  // 1 / 2 / 3: jump into the top / second / third alternative tried here and
  // mark that line; the same number again clears it and steps back out.
  const pickAlternative = (slot: number) => {
    const color = SLOT_COLORS[slot]
    const currentBranch = branchRootOf(tree, head)
    if (currentBranch && variationHighlights[currentBranch] === color) {
      setVariationHighlights((prev) => {
        const next = { ...prev }
        delete next[currentBranch]
        return next
      })
      setHead(lastMainLineAncestor(tree, head))
      return
    }
    const target = alternativesAt(tree, head)[slot]
    if (!target) return
    setVariationHighlights((prev) => ({ ...prev, [target.id]: color }))
    setHead(target.id)
  }

  // ---------- Keyboard (roughly what chess.com and Lichess use) ----------

  const toggle = (k: keyof AnalysisSettings) => setSettings({ [k]: !settings[k] } as Partial<AnalysisSettings>)
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          setPly(ply - 1)
          return
        case 'ArrowRight':
          e.preventDefault()
          setPly(ply + 1)
          return
        // A presenter clicker's back/forward send ↑/↓: with that setting on
        // they step one move; otherwise they jump to the first or last.
        case 'ArrowUp':
          e.preventDefault()
          setPly(settings.clickerMode ? ply - 1 : 0)
          return
        case 'ArrowDown':
          e.preventDefault()
          setPly(settings.clickerMode ? ply + 1 : moves.length)
          return
        // Other clickers send PageUp / PageDown: one move, whatever the setting.
        case 'PageUp':
          e.preventDefault()
          setPly(ply - 1)
          return
        case 'PageDown':
          e.preventDefault()
          setPly(ply + 1)
          return
        case 'Home':
          e.preventDefault()
          setPly(0)
          return
        case 'End':
          e.preventDefault()
          setPly(moves.length)
          return
        default:
          break
      }
      // Pen keys aren't here: they're held during a drag, not pressed once.
      switch (e.key.toLowerCase()) {
        case 'x':
          setOrientation((o) => (o === 'white' ? 'black' : 'white'))
          break
        case 'e':
          setEngineOn((v) => !v)
          break
        case 'a':
          toggle('engineArrows')
          break
        case 'l':
          toggle('engineLines')
          break
        case 'b':
          toggle('evalBar')
          break
        case 'k':
          toggle('checkHighlight')
          break
        case 'd':
          setDrawMode((d) => !d)
          break
        case 'o':
          setSidePane((p) => (p === 'engine' ? 'explorer' : 'engine'))
          break
        case '1':
          pickAlternative(0)
          break
        case '2':
          pickAlternative(1)
          break
        case '3':
          pickAlternative(2)
          break
        case '9':
          setHead(lastMainLineAncestor(tree, head))
          break
        default:
          break
      }
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---------- Engine ----------

  useEffect(() => {
    if (!engineOn) {
      engineRef.current?.stop()
      setEngineStatus('off')
      return
    }
    if (!engineRef.current) {
      engineRef.current = new Engine()
      engineRef.current.onInfo((info) => {
        // A search already running when you moved on still reports for a few
        // hundred milliseconds: those lines belong to the old position.
        if (info.fen !== fenRef.current) return
        setEngineLines((lines) => ({ ...lines, [info.multipv]: info }))
        setEngineStatus('running')
      })
    }
    setEngineLines({})
    setEngineStatus('starting')
    void engineRef.current.analyze(fen)
  }, [fen, engineOn])

  useEffect(
    () => () => {
      engineRef.current?.quit()
      engineRef.current = null
    },
    [],
  )

  // ---------- Lichess explorer ----------

  useEffect(() => {
    if (sidePane !== 'explorer') return
    setExplorer(null)
    setExplorerError(null)
    const t = window.setTimeout(async () => {
      try {
        setExplorer(await fetchExplorer(fen, db, settings.lichessToken || undefined))
      } catch (err) {
        setExplorerError({ message: err instanceof Error ? err.message : String(err), needsToken: err instanceof ExplorerError && err.needsToken })
      }
    }, 450)
    return () => window.clearTimeout(t)
  }, [fen, db, sidePane, settings.lichessToken])

  // ---------- The pens ----------

  const marks = annotations[fen] ?? EMPTY_MARKS
  const updateMarks = (fn: (m: Marks) => Marks) => setAnnotations((all) => ({ ...all, [fen]: fn(all[fen] ?? EMPTY_MARKS) }))

  const addArrow = (from: string, to: string, color = drawColor) =>
    updateMarks((m) => ({
      ...m,
      // Drawing the same arrow twice removes it, like Lichess.
      arrows: m.arrows.some((a) => a[0] === from && a[1] === to && a[2] === color)
        ? m.arrows.filter((a) => !(a[0] === from && a[1] === to))
        : [...m.arrows.filter((a) => !(a[0] === from && a[1] === to)), [from, to, color]],
    }))
  const toggleSquare = (square: string, color = drawColor) =>
    updateMarks((m) => {
      const squares = { ...m.squares }
      if (squares[square] === color) delete squares[square]
      else squares[square] = color
      return { ...m, squares }
    })
  const clearMarks = () =>
    setAnnotations((all) => {
      const next = { ...all }
      delete next[fen]
      return next
    })
  const hasMarks = marks.arrows.length > 0 || Object.keys(marks.squares).length > 0
  const markedCount = Object.values(annotations).filter((m) => m.arrows.length > 0 || Object.keys(m.squares).length > 0).length

  // The colour a drag ending now uses: a held pen key (Z, R, F, C), else the pen picked below.
  const currentPenColor = () => heldPen()?.value ?? drawColor

  // Right-click drag on a mouse: press on the origin square, release on the target.
  const rightFrom = useRef<string | null>(null)
  const squareAt = (e: { target: EventTarget | null }) => (e.target as Element | null)?.closest?.('[data-square]')?.getAttribute('data-square') ?? null
  const onMouseDown = (e: ReactMouseEvent) => {
    if (e.button !== 2) return
    rightFrom.current = squareAt(e)
  }
  const onMouseUp = (e: ReactMouseEvent) => {
    // A plain left click on the board wipes this position's marks.
    if (e.button === 0) {
      if (hasMarks && !drawMode) clearMarks()
      return
    }
    if (e.button !== 2) return
    const from = rightFrom.current
    const to = squareAt(e)
    rightFrom.current = null
    if (!from || !to) return
    const color = currentPenColor()
    if (from === to) toggleSquare(from, color)
    else addArrow(from, to, color)
  }

  // Draw mode (a finger, a pencil, or a mouse's left button): press a square
  // and drag to another for an arrow, release without moving for a highlight.
  // The square under the finger at release is found with elementFromPoint: a
  // touch locks its target to wherever the gesture started.
  const squareFromPoint = (x: number, y: number) => document.elementFromPoint(x, y)?.closest?.('[data-square]')?.getAttribute('data-square') ?? null
  const isDrawButton = (e: ReactPointerEvent) => e.pointerType !== 'mouse' || e.button === 0
  const onDrawPointerDown = (e: ReactPointerEvent) => {
    if (!drawMode || !e.isPrimary || !isDrawButton(e)) return
    const square = squareFromPoint(e.clientX, e.clientY)
    if (!square) return
    e.preventDefault()
    setDrawFrom(square)
  }
  const onDrawPointerUp = (e: ReactPointerEvent) => {
    if (!drawMode || !e.isPrimary || !drawFrom || !isDrawButton(e)) return
    const square = squareFromPoint(e.clientX, e.clientY)
    if (square) {
      const color = currentPenColor()
      if (square === drawFrom) toggleSquare(square, color)
      else addArrow(drawFrom, square, color)
    }
    setDrawFrom(null)
  }

  // ---------- The board ----------

  const position = useMemo(() => {
    try {
      return new Chess(fen)
    } catch {
      return null
    }
  }, [fen])
  const material = useMemo(() => (position ? materialDiff(position) : { capturedByWhite: [], capturedByBlack: [], diff: 0 }), [position])
  const lastMove = useMemo(() => lastMoveOf(moves, ply, baseFen), [moves, ply, baseFen])

  // A move played or stepped to clicks, as in Repertoire Lab.
  const prevPlyRef = useRef(ply)
  useEffect(() => {
    const prev = prevPlyRef.current
    prevPlyRef.current = ply
    if (!settings.soundEnabled || ply === prev || ply === 0) return
    const san = moves[ply - 1]
    if (san) playMoveSound(san)
  }, [ply, settings.soundEnabled, moves])

  // Keep the move you're on in view in a long list.
  const moveListRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = moveListRef.current
    if (!box) return
    const el = box.querySelector<HTMLElement>('.mt-move.current')
    if (!el) {
      if (ply === 0) box.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    const top = el.offsetTop
    const bottom = top + el.offsetHeight
    const view = box.clientHeight
    if (top < box.scrollTop || bottom > box.scrollTop + view) {
      box.scrollTo({ top: Math.max(0, top - (view - el.offsetHeight) / 2), behavior: 'instant' })
    }
  }, [ply, moves.length])

  // Stockfish's top moves as arrows, one colour each, matching the dot beside its line.
  const engineArrows = useMemo(() => {
    if (!engineOn || !showEngineArrows || !position) return []
    const out: Arrow[] = []
    ;[1, 2, 3].forEach((n, i) => {
      if (!arrowOn[i]) return
      const san = engineLines[n]?.sans?.[0]
      if (!san) return
      try {
        const mv = new Chess(position.fen()).move(san)
        if (mv) out.push([mv.from, mv.to, ARROW_COLORS[i]])
      } catch {
        // the line may lag a move behind the board
      }
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineOn, showEngineArrows, engineLines, position, arrowOn[0], arrowOn[1], arrowOn[2]])

  // Highlighted squares; a picked piece glows blue.
  const squareStyles = useMemo(() => {
    const styles: Record<string, Record<string, string>> = {}
    if (picked) styles[picked] = { background: 'rgba(59, 156, 255, 0.5)' }
    for (const [sq, color] of Object.entries(marks.squares)) styles[sq] = { background: `${color}66`, boxShadow: `inset 0 0 0 3px ${color}` }
    if (drawFrom) styles[drawFrom] = { background: `${drawColor}88` }
    return styles
  }, [marks.squares, drawFrom, drawColor, picked])

  // ---------- Moves ----------

  // Every move goes into the tree: something new from an earlier point starts
  // a variation there; a move already recorded is simply followed.
  const record = (san: string) => {
    const { tree: next, nodeId } = addMove(tree, head, san)
    setTree(next)
    setHead(nodeId)
  }
  const playSan = (san: string) => {
    let mv = null
    try {
      mv = new Chess(fen).move(san)
    } catch {
      mv = null
    }
    if (mv) record(mv.san)
  }
  const commitMove = (from: string, to: string, promotion?: string) => {
    let mv = null
    try {
      mv = new Chess(fen).move({ from, to, promotion: promotion ?? 'q' })
    } catch {
      mv = null
    }
    if (!mv) return false
    record(mv.san)
    setPicked(null)
    setPendingPromotion(null)
    return true
  }
  const onPieceDrop = (from: string, to: string) => {
    if (drawMode) return false // in draw mode the board is a canvas, not a game
    let needsChoice = false
    try {
      needsChoice = new Chess(fen).moves({ square: from as Square, verbose: true }).some((m) => m.to === to && m.promotion)
    } catch {
      needsChoice = false
    }
    if (needsChoice) {
      setPendingPromotion({ from, to, color: new Chess(fen).turn() })
      return false // the board waits; the picker decides which piece lands
    }
    return commitMove(from, to)
  }
  // Click-to-move, so a trackpad or a finger can play without dragging.
  const onSquareClick = (square: string) => {
    if (drawMode) return
    if (picked) {
      // Tapping the piece you just picked puts it back down.
      if (picked === square) {
        setPicked(null)
        return
      }
      const played = onPieceDrop(picked, square)
      setPicked(played ? null : position?.get(square as Square) ? square : null)
      return
    }
    const piece = position?.get(square as Square)
    if (piece && piece.color === position?.turn()) setPicked(square)
  }

  // ---------- Size: the board takes what's left beside the panels ----------

  const BOARD_MAX = 760
  // Three side-by-side columns need real width; below that the engine and
  // moves share one column, and below that everything stacks under the board.
  // 1040 catches every iPad in landscape.
  const wide = viewportWidth >= 1040
  const tight = wide && viewportWidth < 1380
  const compact = tight || (viewportWidth >= 900 && viewportHeight < 960)
  const layoutClass = viewportWidth < 900 ? 'stacked' : wide ? 'three-col' : 'two-col'

  const [layoutEl, setLayoutEl] = useState<HTMLDivElement | null>(null)
  const [layoutW, setLayoutW] = useState(0)
  useEffect(() => {
    if (!layoutEl || typeof ResizeObserver === 'undefined') return
    const read = (w: number) => {
      if (w > 200) setLayoutW(w)
    }
    // Debounced past react-chessboard's ~300ms move animation, so a scrollbar
    // flickering in mid-slide can't resize the board under a moving piece.
    let pending = 0
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      window.clearTimeout(pending)
      pending = window.setTimeout(() => read(w), 350)
    })
    ro.observe(layoutEl)
    read(layoutEl.getBoundingClientRect().width)
    return () => {
      window.clearTimeout(pending)
      ro.disconnect()
    }
  }, [layoutEl])
  // A turned iPad or a resized window changes the layout at once: measure then too.
  useLayoutEffect(() => {
    if (!layoutEl) return
    const w = layoutEl.getBoundingClientRect().width
    if (w > 200) setLayoutW(w)
  }, [layoutEl, viewportWidth, layoutClass])

  // How tall the engine column comes to, so the moves column beside it can run as far.
  const [engineColEl, setEngineColEl] = useState<HTMLDivElement | null>(null)
  const [sideH, setSideH] = useState(0)
  useEffect(() => {
    if (!engineColEl || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setSideH(Math.ceil(engineColEl.getBoundingClientRect().height)))
    ro.observe(engineColEl)
    return () => ro.disconnect()
  }, [engineColEl])

  const EVAL_W = showEvalBar ? 26 : 0
  // On a Mac or an iPad the board is a tenth bigger than the rules below alone allow.
  const BOARD_GROW = viewportWidth > 600 ? 1.1 : 1
  const growing = BOARD_GROW > 1
  const SIDES_W =
    layoutClass === 'three-col' ? (tight ? (growing ? 296 : 310) + 210 + 2 * 14 : 340 + 260 + 2 * 22) : layoutClass === 'two-col' ? (growing ? 348 : 400) + 22 : 0
  const boardRoom = layoutEl && layoutW ? layoutW - SIDES_W - EVAL_W : 0
  // Keep the whole board on screen, with the pens and step controls under it:
  // cap by height as well as width, less what the system sits on.
  const systemChrome = inset('--safe-top') + inset('--safe-bottom')
  const heightCap = Math.max(320, viewportHeight - systemChrome - (tight ? 330 : 290))
  // And never so big that the step controls under it fall off the bottom of
  // the window: the top bar, the material rows, the pens and the controls
  // come to 285px here. (Repertoire Lab's tenth-bigger board otherwise
  // pushes them a scroll away on a Mac.)
  const fitCap = viewportHeight - systemChrome - 285
  // Whole squares only: a fractional square leaves the last file looking wider.
  const boardWidth =
    Math.floor(Math.max(280, Math.min(BOARD_MAX * BOARD_GROW, boardRoom || 520, heightCap * BOARD_GROW, fitCap, viewportWidth - 48)) / 8) * 8

  const layoutStyle = {
    '--board-h': `${boardWidth + 86}px`,
    '--board-col': `${boardWidth + EVAL_W}px`,
    '--side-h': `${sideH}px`,
  } as CSSProperties
  const paletteStyle = palette.tokens as CSSProperties

  const moveLabelNow = (() => {
    if (ply === 0) return 'start'
    const virtualPly = ply + (baseMeta.startColor === 'b' ? 1 : 0)
    const num = Math.floor((virtualPly - 1) / 2) + baseMeta.startNumber
    return `${num}${virtualPly % 2 === 1 ? '.' : '…'}${moves[ply - 1]}`
  })()
  const totals = explorer ? explorerTotals(explorer) : 0

  const settingRow = (k: keyof AnalysisSettings, label: string, dot?: string) => (
    <label key={k} className={`board-menu-row${settings[k] ? ' on' : ''}`}>
      <input type="checkbox" checked={Boolean(settings[k])} onChange={(e) => setSettings({ [k]: e.target.checked } as Partial<AnalysisSettings>)} />
      {dot && <span className="pv-dot" style={{ background: dot }} />}
      {label}
    </label>
  )

  return (
    <Page back={back} width="full">
      <div className="rl-analysis" data-rl-skin={skin} data-rl-theme={resolved} style={paletteStyle}>
        <div ref={setLayoutEl} className={`analysis-layout ${layoutClass}${tight ? ' tight' : ''}${compact ? ' compact' : ''}`} style={layoutStyle}>
          <div
            className="analysis-board"
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onPointerDown={onDrawPointerDown}
            onPointerUp={onDrawPointerUp}
            onPointerCancel={() => setDrawFrom(null)}
            onContextMenu={(e) => e.preventDefault()}
            data-no-pull
            data-swipe-own
          >
            <div className="board-with-eval">
              {showEvalBar && <EvalBar score={engineLines[1]?.score} running={engineOn && engineStatus === 'running'} flipped={orientation === 'black'} />}
              <div className="board-column" style={{ width: boardWidth }}>
                <MaterialBar
                  pieces={orientation === 'white' ? material.capturedByBlack : material.capturedByWhite}
                  capturedColor={orientation === 'white' ? 'white' : 'black'}
                  advantage={orientation === 'white' ? Math.max(0, -material.diff) : Math.max(0, material.diff)}
                />
                <div className="board-frame" style={{ position: 'relative', width: boardWidth, height: boardWidth, touchAction: drawMode ? 'none' : undefined }}>
                  <Board
                    id="analysis"
                    position={fen}
                    palette={palette}
                    onPieceDrop={onPieceDrop}
                    onSquareClick={onSquareClick}
                    onPieceDragBegin={(_piece, square) => setPicked(square)}
                    onPieceDragEnd={() => setPicked(null)}
                    onPromotionCheck={() => false}
                    arePiecesDraggable={!drawMode}
                    customSquareStyles={squareStyles}
                    lastMove={lastMove}
                    markCheck={settings.checkHighlight}
                    markLast={settings.lastMoveHighlight}
                    boardOrientation={orientation}
                    boardWidth={boardWidth}
                  />
                  {pendingPromotion && (
                    <PromotionPicker
                      square={pendingPromotion.to}
                      color={pendingPromotion.color}
                      boardWidth={boardWidth}
                      orientation={orientation}
                      palette={palette}
                      onPick={(piece) => commitMove(pendingPromotion.from, pendingPromotion.to, piece)}
                      onCancel={() => setPendingPromotion(null)}
                    />
                  )}
                  <BoardArrows arrows={[...engineArrows, ...marks.arrows]} boardWidth={boardWidth} orientation={orientation} />
                  {/* Above the arrows: an engine arrow crossing a dot used to look like two dots on one square. */}
                  {settings.showLegalMoves && <LegalDots game={position} square={picked} boardWidth={boardWidth} orientation={orientation} />}
                </div>
                <MaterialBar
                  pieces={orientation === 'white' ? material.capturedByWhite : material.capturedByBlack}
                  capturedColor={orientation === 'white' ? 'black' : 'white'}
                  advantage={orientation === 'white' ? Math.max(0, material.diff) : Math.max(0, -material.diff)}
                />
              </div>
            </div>

            <div className="annotate-bar" style={{ maxWidth: boardWidth + EVAL_W }}>
              <span className="board-menu-wrap">
                <button className={`small${boardMenu ? ' primary' : ''}`} title="Board options" aria-label="Board options" onClick={() => setBoardMenu((o) => !o)}>
                  <GearIcon />
                </button>
                {boardMenu && (
                  <div className="board-menu" onMouseLeave={() => setBoardMenu(false)}>
                    {settingRow('evalBar', 'Evaluation bar')}
                    {settingRow('engineLines', 'Engine lines')}
                    {settingRow('engineArrows', 'Engine arrows')}
                    {/* Which of the three candidates get drawn. */}
                    <div className={`board-menu-group${showEngineArrows ? '' : ' off'}`}>
                      {settingRow('arrowBest', 'Best move', ARROW_COLORS[0])}
                      {settingRow('arrowSecond', '2nd best', ARROW_COLORS[1])}
                      {settingRow('arrowThird', '3rd best', ARROW_COLORS[2])}
                    </div>
                    {settingRow('engineAuto', 'Engine on when the board opens')}
                    {settingRow('showLegalMoves', 'Legal-move dots')}
                    {settingRow('soundEnabled', 'Move sounds')}
                    {settingRow('clickerMode', 'Presenter clicker: ↑/↓ step one move')}
                  </div>
                )}
              </span>
              <button
                className={`small${drawMode ? ' primary' : ''}`}
                title={drawMode ? 'Drawing: press a square and drag to another for an arrow, or release without moving to highlight it' : 'Draw arrows and highlights (also: right-click drag on a mouse)'}
                onClick={() => {
                  setDrawMode((d) => !d)
                  setDrawFrom(null)
                }}
              >
                <PencilIcon /> {drawMode ? 'Drawing' : 'Draw'}
              </button>
              <span className="pens">
                {PENS.map((p) => (
                  <button
                    key={p.value}
                    className={`pen${drawColor === p.value ? ' active' : ''}`}
                    style={{ background: p.value }}
                    title={`${p.name} (hold ${p.key.toUpperCase()} while dragging)`}
                    aria-label={`${p.name} pen`}
                    onClick={() => setDrawColor(p.value)}
                  />
                ))}
              </span>
              <span style={{ flex: 1 }} />
              {markedCount > 1 && <span className="muted-note">{markedCount} positions marked</span>}
              <button className="small ghost" disabled={!hasMarks} onClick={clearMarks}>
                Clear
              </button>
            </div>
            {/* On a tablet the two-line reminder pushes the controls off the screen, and there's no right-click there anyway. */}
            <div className="muted-note draw-hint" style={{ maxWidth: boardWidth + EVAL_W }}>
              {tight || viewportWidth < 900 ? (
                <>
                  Press <strong>Draw</strong>, then drag a square to mark up the board · left-click to clear
                </>
              ) : (
                <>
                  Right-click drag to draw in the pen picked above · hold <kbd>Z</kbd> <kbd>R</kbd> <kbd>F</kbd> <kbd>C</kbd> while dragging for green / red / blue /
                  yellow · left-click the board to clear
                </>
              )}
            </div>

            <div className="viewer-controls">
              <button title="Start" aria-label="Start" onClick={() => setPly(0)}>
                <SkipStartIcon />
              </button>
              <button aria-label="Back one move" onClick={() => setPly((p) => Math.max(0, p - 1))}>
                ◀
              </button>
              <button aria-label="Forward one move" onClick={() => setPly((p) => Math.min(moves.length, p + 1))}>
                ▶
              </button>
              <button title="End" aria-label="End" onClick={() => setPly(moves.length)}>
                <SkipEndIcon />
              </button>
              <button onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>⇅ Flip</button>
              <button
                title="Back to the position and its line as they were sent here"
                onClick={() => {
                  setTree(sentTree)
                  setHead('root')
                  setAnnotations({})
                  setVariationHighlights({})
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="analysis-engine" ref={setEngineColEl}>
            {/* Beside the board, not above it: the board's height is sized to leave room for its own controls only. */}
            <div className="analysis-title">
              <span className="muted-note">Analysis board</span>
              {title && <strong>{title}</strong>}
            </div>
            <div className="panel side-tabs-panel">
              <div className="side-tabs">
                <button className={sidePane === 'engine' ? 'active' : ''} onClick={() => setSidePane('engine')}>
                  Engine
                </button>
                <button className={sidePane === 'explorer' ? 'active' : ''} onClick={() => setSidePane('explorer')}>
                  Explorer
                </button>
              </div>

              {sidePane === 'engine' && (
                <div>
                  <h3>
                    Stockfish 16
                    {engineStatus === 'running' && engineLines[1] && <span className="depth-tag">depth {engineLines[1].depth}</span>}
                    <span className="spacer" />
                    <button className="small" onClick={() => setEngineOn((v) => !v)}>
                      {engineOn ? (
                        'Stop'
                      ) : (
                        <>
                          <PlayIcon /> Analyze
                        </>
                      )}
                    </button>
                  </h3>
                  {!engineOn && (
                    <div style={{ color: 'var(--muted)', fontSize: 14 }}>Engine is off — press Analyze for the lines, the arrows on the board and the evaluation bar.</div>
                  )}
                  {engineOn && !showEngineArrows && (
                    <div className="muted-note" style={{ margin: '2px 0 10px' }}>
                      Arrows are off.{' '}
                      <button className="linkish" onClick={() => setSettings({ engineArrows: true })}>
                        Show them on the board
                      </button>
                    </div>
                  )}
                  {engineOn && engineStatus === 'starting' && <div style={{ color: 'var(--muted)', fontSize: 14 }}>Starting engine…</div>}
                  {engineOn && !showEngineLines && (
                    <div style={{ color: 'var(--muted)', fontSize: 14 }}>Lines are hidden — the bar beside the board still follows the evaluation.</div>
                  )}
                  {engineOn &&
                    showEngineLines &&
                    [1, 2, 3].map((n) => {
                      const line = engineLines[n]
                      if (!line) return null
                      const good = line.score.type === 'mate' ? line.score.value > 0 : line.score.value >= 0
                      return (
                        <div key={n} className="engine-line" onClick={() => line.sans[0] && playSan(line.sans[0])}>
                          {showEngineArrows && (
                            <span
                              className="pv-dot"
                              style={{ background: ARROW_COLORS[n - 1] }}
                              title={`Drawn on the board in this colour${n === 1 ? ' — the engine’s first choice' : ''}`}
                            />
                          )}
                          <span className={`eval ${good ? 'white-good' : 'black-good'}`}>{formatScore(line.score)}</span>
                          <span className="pv">{line.sans.join(' ')}</span>
                        </div>
                      )
                    })}
                </div>
              )}

              {sidePane === 'explorer' && (
                <div>
                  <h3>
                    Opening explorer
                    <span className="spacer" />
                    <select value={db} onChange={(e) => setDb(e.target.value as 'lichess' | 'masters')}>
                      <option value="lichess">Lichess players</option>
                      <option value="masters">Masters</option>
                    </select>
                  </h3>
                  {explorerError && (
                    <div style={{ color: 'var(--muted)', fontSize: 14 }}>
                      {explorerError.message}
                      {explorerError.needsToken && (
                        <form
                          className="token-row"
                          onSubmit={(e) => {
                            e.preventDefault()
                            setSettings({ lichessToken: tokenDraft.trim() })
                          }}
                        >
                          <input
                            type="password"
                            value={tokenDraft}
                            onChange={(e) => setTokenDraft(e.target.value)}
                            placeholder="Lichess API token (lichess.org/account/oauth/token)"
                            autoComplete="off"
                          />
                          <button type="submit" className="small primary" disabled={!tokenDraft.trim()}>
                            Use
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                  {!explorer && !explorerError && <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div>}
                  {explorer && explorer.moves.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 14 }}>No games from this position.</div>}
                  {explorer && explorer.moves.length > 0 && (
                    <table className="explorer-table">
                      <thead>
                        <tr>
                          <th>Move</th>
                          <th>Games</th>
                          <th>%</th>
                          <th>White / Draw / Black</th>
                        </tr>
                      </thead>
                      <tbody>
                        {explorer.moves.map((m) => {
                          const total = explorerTotals(m)
                          return (
                            <tr key={m.uci} onClick={() => playSan(m.san)}>
                              <td>{m.san}</td>
                              <td>{total.toLocaleString()}</td>
                              <td>{pct(total, totals)}</td>
                              <td>
                                <div className="wdl-bar">
                                  <span className="w" style={{ width: pct(m.white, total) }}>
                                    {pct(m.white, total)}
                                  </span>
                                  <span className="d" style={{ width: pct(m.draws, total) }} />
                                  <span className="b" style={{ width: pct(m.black, total) }}>
                                    {pct(m.black, total)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="analysis-moves-col">
            <div className="panel analysis-movelist-panel">
              <div className="movelist-head">
                <span>Moves</span>
                <span className="muted-note">
                  {moveLabelNow} · {ply} of {moves.length}
                </span>
                <span style={{ flex: 1 }} />
                {hasVariations(tree) && (
                  <button
                    className="small ghost"
                    title="Delete every variation, keeping the main line"
                    onClick={() => {
                      setTree(keepMainLineOnly(tree))
                      setHead('root')
                    }}
                  >
                    Clear variations
                  </button>
                )}
              </div>
              <div
                className="movelist-scroll"
                ref={moveListRef}
                style={
                  layoutClass === 'stacked'
                    ? undefined
                    : {
                        // In two columns the moves share the height with the
                        // engine above them; in three they get the board's.
                        maxHeight: layoutClass === 'two-col' ? Math.max(150, (boardWidth + 86) * 0.44 - 52) : Math.max(200, Math.max(boardWidth + 86, sideH) - 130),
                      }
                }
              >
                {moves.length === 0 && ply === 0 && tree.children.length === 0 ? (
                  <div className="muted-note">Play a move on the board, or tap an engine line.</div>
                ) : (
                  <MoveTree
                    root={tree}
                    headId={head}
                    highlights={variationHighlights}
                    onHighlight={assignHighlight}
                    startNumber={baseMeta.startNumber}
                    startColor={baseMeta.startColor}
                    onGo={setHead}
                    onPromote={(id) => setTree(promote(tree, id))}
                    onPromoteOne={(id) => setTree(promoteOne(tree, id))}
                    onDelete={(id) => {
                      // Standing on the move you're deleting: step back first.
                      const trail = nodePath(tree, id)
                      if (nodePath(tree, head).some((n) => n.id === id)) setHead(trail.length > 1 ? trail[trail.length - 2].id : 'root')
                      setTree(removeNode(tree, id))
                    }}
                    portalStyle={paletteStyle}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  )
}

// Repertoire Lab's own icons (src/components/Icons.jsx there): one 24-grid
// line set with a 1.8 stroke, at the sizes it uses them.
function Icon({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden width={size} height={size}>
      {children}
    </svg>
  )
}
const GearIcon = () => (
  <Icon size={15}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.2 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.4 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.4-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.4 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z" />
  </Icon>
)
const PencilIcon = () => (
  <Icon size={15}>
    <path d="M4 20h4L18 10a2.1 2.1 0 0 0-3-3L5 17z" />
    <path d="M13.5 6.5l3 3" />
  </Icon>
)
const PlayIcon = () => (
  <Icon size={14}>
    <path d="M7.5 4.8 19 12 7.5 19.2z" fill="currentColor" stroke="none" />
  </Icon>
)
const SkipStartIcon = () => (
  <Icon size={16}>
    <path d="M18.5 5.5v13L8 12z" fill="currentColor" stroke="none" />
    <path d="M6 5.5v13" />
  </Icon>
)
const SkipEndIcon = () => (
  <Icon size={16}>
    <path d="M5.5 5.5v13L16 12z" fill="currentColor" stroke="none" />
    <path d="M18 5.5v13" />
  </Icon>
)
