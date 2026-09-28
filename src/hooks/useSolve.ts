import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { playableSteps, sameMove, type LineStep } from '../lib/solution'

/**
 * Playing the recorded line out with the answer hidden. A right move stays
 * and the other side answers after a beat; a wrong one shakes the board and
 * goes back. A line that stops replaying legally is played up to that point;
 * with no playable line at all, any legal move goes, so the position can
 * still be worked through. Once the line is played out, onSolved gets the
 * last step after a beat, so the page can bring the answer back.
 */
export function useSolve(recorded: LineStep[], positionId: string, onSolved?: (step: number) => void) {
  const line = useMemo(() => playableSteps(recorded), [recorded])
  const free = line.length < 2
  const [step, setStep] = useState(0)
  const [played, setPlayed] = useState<LineStep[]>([])
  const [wrong, setWrong] = useState<string | null>(null)
  const [misses, setMisses] = useState(0)
  const reply = useRef<number | undefined>(undefined)
  const reveal = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(reply.current)
      window.clearTimeout(reveal.current)
    },
    [],
  )
  const solvedRef = useRef(onSolved)
  useEffect(() => {
    solvedRef.current = onSolved
  })
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
    if (after >= last) return finish(after)
    // The other side answers after a beat, then it's the solver's move again.
    reply.current = window.setTimeout(() => {
      if (live.current !== positionId) return
      setStep(after + 1)
      if (after + 1 >= last) finish(after + 1)
    }, 550)
  }
  // The stamp shows for a moment, then the answer comes back.
  const finish = (at: number) => {
    reveal.current = window.setTimeout(() => live.current === positionId && solvedRef.current?.(at), 1200)
  }
  const reset = () => {
    window.clearTimeout(reply.current)
    window.clearTimeout(reveal.current)
    setStep(0)
    setPlayed([])
    setWrong(null)
    setMisses(0)
  }
  return { steps, step: at, current, wrong, misses, solved, tryMove, reset }
}

export type Solve = ReturnType<typeof useSolve>
