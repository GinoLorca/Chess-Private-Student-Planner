import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  getPresses,
  plainBoard,
  quietBackground,
  setPlainBoard,
  setQuietBackground,
  setSpeedCheck,
  speedCheckOn,
  speedReport,
  startSpeedCheck,
  subscribe,
} from '../../lib/speedCheck'
import { copyText } from '../../lib/links'

let version = 0
const bump = () => version++

/**
 * The board speed check, on screen: the last few presses of a piece with
 * how long each step took, two switches to rule causes in or out, and the
 * report to copy and send. Shown only while the check is on.
 */
export function SpeedCheckPanel() {
  const [on, setOn] = useState(speedCheckOn)
  useEffect(() => {
    if (on) startSpeedCheck()
  }, [on])
  useSyncExternalStore(
    (l) =>
      subscribe(() => {
        bump()
        l()
      }),
    () => version,
  )
  const [plain, setPlain] = useState(plainBoard)
  const [quiet, setQuiet] = useState(quietBackground)
  const [copied, setCopied] = useState(false)
  if (!on) return null
  const presses = getPresses().slice(0, 4)
  const ms = (n: number | undefined) => (n === undefined ? '…' : `${Math.round(n)}`)
  const skin = document.documentElement.getAttribute('data-skin') ?? 'folder'
  const chip = 'rounded-full border border-white/25 px-2.5 py-1 text-[11px] font-bold'
  return (
    <div className="fixed right-2 bottom-2 z-[60] w-[310px] rounded-xl bg-black/85 p-2.5 font-mono text-[11px] leading-snug text-white shadow-lg">
      <div className="mb-1 flex items-center justify-between font-sans text-[12px] font-bold">
        <span>Board speed check</span>
        <button
          type="button"
          onClick={() => {
            setSpeedCheck(false)
            setPlainBoard(false)
            setQuietBackground(false)
            setOn(false)
          }}
          className="px-1 text-white/70"
          aria-label="Turn the speed check off"
        >
          ✕
        </button>
      </div>
      {presses.length === 0 ? (
        <p className="text-white/70">Press and drag a piece a few times.</p>
      ) : (
        presses.map((p, i) => (
          <p key={`${p.at}-${i}`} className="border-t border-white/10 py-0.5">
            lit {ms(p.selectedPainted)} · lifted {ms(p.liftedPainted)} · 1st move {ms(p.firstMove)} · gap {ms(p.longestMoveGap)}
            {p.stalls.length > 0 && <span className="text-[#ff8f6b]"> · froze {p.stalls.map(([, len]) => len).join('+')}</span>}
            {(p.cacheUpdates > 0 || p.saves > 0) && <span className="text-[#ffd37a]"> · bg {p.cacheUpdates}/{p.saves}</span>}
          </p>
        ))
      )}
      <div className="mt-1.5 flex flex-wrap gap-1.5 font-sans">
        <button
          type="button"
          aria-pressed={plain}
          onClick={() => {
            setPlainBoard(!plain)
            setPlain(!plain)
          }}
          className={`${chip} ${plain ? 'bg-white text-black' : ''}`}
        >
          Skin effects off
        </button>
        <button
          type="button"
          aria-pressed={quiet}
          onClick={() => {
            setQuietBackground(!quiet)
            setQuiet(!quiet)
          }}
          className={`${chip} ${quiet ? 'bg-white text-black' : ''}`}
        >
          Background off
        </button>
        <button
          type="button"
          onClick={async () => {
            if (await copyText(speedReport(skin))) {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }
          }}
          className={`${chip} bg-[#2f8f4e]`}
        >
          {copied ? 'Copied' : 'Copy report'}
        </button>
      </div>
    </div>
  )
}
