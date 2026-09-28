import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { playableSteps, sameMove, type LineStep } from '../lib/solution'

/**
 * Playing the recorded line out with the answer hidden. A right move stays
 * and the other side answers after a beat; a wrong one shakes the board and
 * goes back. A line that stops replaying legally is played up to that point;
 * with no playable line at all, any legal move goes, so the position can
 * still be worked through.
 */
export function useSolve(recorded: LineStep[], positionId: string) {
  const line = useMemo(() => playableSteps(recorded), [recorded])
  const free = line.length < 2
  const [step, setStep] = useState(0)
  const [played, setPlayed] = useState<LineStep[]>([])
  const [wrong, setWrong] = useState<string | null>(null)
  const [misses, setMisses] = useState(0)
  const reply = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(reply.current), [])
  // A reply still pending when the position changes belongs to the old one.
  const live = useRef(positionId)
  useEffect(() => {
    live.current = positionId
  })
  // A different position starts fresh.
  const [owner, setOwner] = useState(positionId)
  if (owner !== positionId) {
    setOwner(positionId)
    setStep(0)
    setPlayed([])
    setWrong(null)
    setMisses(0)
  }

  const steps = free ? [line[0], ...played] : line
  const last = steps.length - 1
  const at = free ? last : Math.min(step, last)
  const solved = !free && step >= last
  const current = steps[at]

  const tryMove = (san: string, fen: string) => {
    if (free) {
      const from = new Chess(current.fen).move(san)
      setPlayed((p) => [...p, { index: p.length + 1, fen, san, from: from.from, to: from.to }])
      return
    }
    if (solved) return
    const expected = steps[step + 1]
    if (!expected || !sameMove(san, expected.san ?? '')) {
      setWrong(san)
      setMisses((n) => n + 1)
      return
    }
    setWrong(null)
    const after = step + 1
    setStep(after)
    if (after >= last) return
    // The other side answers after a beat, then it's the solver's move again.
    reply.current = window.setTimeout(() => live.current === positionId && setStep(after + 1), 550)
  }
  const reset = () => {
    window.clearTimeout(reply.current)
    setStep(0)
    setPlayed([])
    setWrong(null)
    setMisses(0)
  }
  return { steps, step: at, current, wrong, misses, solved, tryMove, reset }
}

export type Solve = ReturnType<typeof useSolve>
