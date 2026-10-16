import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { BoardArrow, BoardHighlight } from '../types/domain'
import type { MentionTarget, SideLine } from '../lib/moveMentions'
import { MOVE_ARROW } from '../lib/solution'
import { PENS } from '../lib/pens'

/** A side line is drawn with the blue pen, a threat with the red one. */
const LINE_ARROW = PENS.find((p) => p.id === 'blue')!.value
const THREAT_ARROW = PENS.find((p) => p.id === 'red')!.value
const SQUARE_MARK = 'rgba(232, 179, 57, 0.6)'

export type Demo =
  | { kind: 'line'; line: SideLine; ply: number }
  | { kind: 'threat'; fen: string; san: string; from: string; to: string; black: boolean }

export interface DemoView {
  fen: string
  lastMove: { from: string; to: string } | null
  arrows: BoardArrow[]
  /** Which position this is, for sketches and the square mark. */
  key: string
}

export interface MoveDemo {
  /** A side line or threat up on the board, in place of the answer. */
  demo: Demo | null
  view: DemoView | null
  /** A square named in the text, lit on whatever the board shows. */
  mark: BoardHighlight | null
  pick: (target: MentionTarget) => void
  isOn: (target: MentionTarget) => boolean
  close: () => void
  /** Step a side line; false when there's none up, so the page steps the answer instead. */
  forward: () => boolean
  back: () => boolean
  /** A ply of the side line up: one of its moves, from the bar under the board. */
  goTo: (ply: number) => void
}

function viewOf(demo: Demo, start: string): DemoView {
  if (demo.kind === 'threat') {
    return { fen: demo.fen, lastMove: null, arrows: [{ startSquare: demo.from, endSquare: demo.to, color: THREAT_ARROW }], key: `threat:${demo.fen}:${demo.san}` }
  }
  const { line, ply } = demo
  const move = ply >= 0 ? line.plies[ply] : null
  return {
    fen: move ? move.fen : start,
    lastMove: move ? { from: move.from, to: move.to } : null,
    // The answer's own moves keep the answer's colour; the line's own are blue.
    arrows: move ? [{ startSquare: move.from, endSquare: move.to, color: ply < line.branch ? MOVE_ARROW : LINE_ARROW }] : [],
    key: `line:${line.id}:${ply}`,
  }
}

/**
 * Moves named in an explanation, shown on the board when tapped. One of the
 * answer's moves steps the answer there; a side line takes the board over
 * until it's closed, with Back / Next (and the clicker) walking it; a threat
 * draws its arrow on the position it's threatened in. Squares light up on
 * whatever the board shows. On a phone the board comes into view if it's
 * scrolled away.
 */
export function useMoveDemo({
  start,
  step,
  setStep,
  boardRef,
  reset = '',
}: {
  start: string
  step: number
  setStep: (step: number) => void
  boardRef: RefObject<HTMLElement | null>
  /** When this changes (another position, the eye closed) the answer comes back. */
  reset?: string
}): MoveDemo {
  const [demo, setDemo] = useState<Demo | null>(null)
  const [marked, setMarked] = useState<{ square: string; at: string } | null>(null)
  const [resetAt, setResetAt] = useState(reset)
  if (resetAt !== reset) {
    setResetAt(reset)
    setDemo(null)
    setMarked(null)
  }
  const view = demo ? viewOf(demo, start) : null
  const here = view?.key ?? `step:${step}`
  const markedSquare = marked && marked.at === here ? marked.square : null
  const mark = markedSquare ? { square: markedSquare, color: SQUARE_MARK } : null

  const reveal = useCallback(() => {
    requestAnimationFrame(() => {
      const el = boardRef.current
      if (!el) return
      // Below the sticky top bar, the whole board: scroll just enough to show it all.
      const inset = document.querySelector('header.sticky')?.getBoundingClientRect().bottom ?? 0
      const r = el.getBoundingClientRect()
      const dy = r.top < inset ? r.top - inset - 8 : r.bottom > window.innerHeight ? Math.min(r.bottom - window.innerHeight + 8, r.top - inset - 8) : 0
      if (Math.abs(dy) > 4) window.scrollBy({ top: dy, behavior: 'smooth' })
    })
  }, [boardRef])

  const pick = useCallback(
    (t: MentionTarget) => {
      if (t.kind === 'square') {
        setMarked((m) => (m && m.at === here && m.square === t.square ? null : { square: t.square, at: here }))
      } else if (t.kind === 'main') {
        setDemo(null)
        setStep(t.step)
      } else if (t.kind === 'line') {
        setDemo({ kind: 'line', line: t.line, ply: t.ply })
      } else {
        setDemo({ kind: 'threat', fen: t.fen, san: t.san, from: t.from, to: t.to, black: t.black })
      }
      reveal()
    },
    [here, setStep, reveal],
  )

  const isOn = useCallback(
    (t: MentionTarget) => {
      if (t.kind === 'square') return markedSquare === t.square
      if (t.kind === 'main') return !demo && step === t.step
      if (t.kind === 'line') return demo?.kind === 'line' && demo.line.id === t.line.id && demo.ply === t.ply
      return demo?.kind === 'threat' && demo.fen === t.fen && demo.san === t.san
    },
    [demo, step, markedSquare],
  )

  const close = useCallback(() => setDemo(null), [])
  const forward = useCallback(() => {
    if (!demo) return false
    if (demo.kind === 'line') setDemo({ ...demo, ply: Math.min(demo.line.plies.length - 1, demo.ply + 1) })
    else setDemo(null)
    return true
  }, [demo])
  const back = useCallback(() => {
    if (!demo) return false
    if (demo.kind === 'line') setDemo({ ...demo, ply: Math.max(demo.line.branch - 1, demo.ply - 1) })
    else setDemo(null)
    return true
  }, [demo])
  const goTo = useCallback((ply: number) => setDemo((d) => (d?.kind === 'line' ? { ...d, ply } : d)), [])

  // Escape puts the answer back.
  const up = useRef(false)
  useEffect(() => {
    up.current = Boolean(demo)
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && up.current) {
        e.stopImmediatePropagation()
        setDemo(null)
      }
    }
    // Capture, so it's seen before the page's own Escape (leaving the view).
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return { demo, view, mark, pick, isOn, close, forward, back, goTo }
}
