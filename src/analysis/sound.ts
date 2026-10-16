// Repertoire Lab's move sounds (src/lib/sound.js there): the recorded move,
// capture, check and checkmate sounds it ships, the Chess Arcade skins' own
// where they brought one, and the synthesized wooden knocks as the fallback
// for anything not covered (castling has no recording). Everything goes
// through Web Audio. Shared by every board in the app, not just analysis.

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { ARCADE_THEMES } from '../lib/arcadeThemes.generated'

type Ctx = AudioContext

let ctx: Ctx | null = null
let master: GainNode | null = null

function getCtx(): Ctx | null {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 1
    master.connect(ctx.destination)
  }
  return ctx
}

const out = () => {
  getCtx()
  return (master ?? ctx?.destination) as AudioNode
}

// Browsers keep audio suspended until a user gesture. Creating/resuming the
// context inside a gesture handler unlocks it, so do that on the first press.
let unlocking = false
export function unlockSounds() {
  if (unlocking || typeof window === 'undefined') return
  unlocking = true
  const unlock = () => {
    const c = getCtx()
    if (c && c.state === 'suspended') c.resume().catch(() => {})
  }
  window.addEventListener('pointerdown', unlock, { capture: true })
  window.addEventListener('keydown', unlock, { capture: true })
}

/** One percussive knock: a pitch-dropping sine "thump" plus a tiny noise click. */
function knock(c: Ctx, delay: number, { freq, dur, vol, clickVol }: { freq: number; dur: number; vol: number; clickVol: number }) {
  const t = c.currentTime + delay
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(g).connect(out())
  osc.start(t)
  osc.stop(t + dur + 0.02)

  const len = Math.floor(c.sampleRate * 0.012)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2200
  bp.Q.value = 0.9
  const ng = c.createGain()
  ng.gain.setValueAtTime(clickVol, t)
  src.connect(bp).connect(ng).connect(out())
  src.start(t)
}

/** A bright short ping layered over the knock to mark check. */
function checkChime(c: Ctx, delay: number) {
  const t = c.currentTime + delay
  const osc = c.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(880, t)
  osc.frequency.exponentialRampToValueAtTime(1174.66, t + 0.05)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
  osc.connect(g).connect(out())
  osc.start(t)
  osc.stop(t + 0.18)
}

/** Checkmate: the knock of the move that delivered it, then a short rising three-note figure. */
function mateFlourish(c: Ctx) {
  knock(c, 0, { freq: 150, dur: 0.09, vol: 0.9, clickVol: 0.28 })
  ;[
    [523.25, 0.1],
    [659.25, 0.22],
    [783.99, 0.34],
  ].forEach(([freq, delay], i) => {
    const t = c.currentTime + delay
    const osc = c.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, t)
    const g = c.createGain()
    const dur = i === 2 ? 0.45 : 0.16
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g).connect(out())
    osc.start(t)
    osc.stop(t + dur + 0.02)
  })
}

function synthBase(c: Ctx, isCapture: boolean) {
  if (isCapture) knock(c, 0, { freq: 145, dur: 0.09, vol: 0.9, clickVol: 0.3 })
  else knock(c, 0, { freq: 195, dur: 0.07, vol: 0.75, clickVol: 0.22 })
}

function scheduleFor(c: Ctx, san: string) {
  if (san.endsWith('#')) {
    mateFlourish(c)
  } else if (san.startsWith('O-O')) {
    knock(c, 0, { freq: 200, dur: 0.06, vol: 0.6, clickVol: 0.18 })
    knock(c, 0.09, { freq: 170, dur: 0.07, vol: 0.65, clickVol: 0.18 })
  } else {
    synthBase(c, san.includes('x'))
    if (san.endsWith('+')) checkChime(c, 0.02)
  }
}

type SoundKey = 'move' | 'capture' | 'castle' | 'check' | 'checkmate' | 'promote' | 'win' | 'lose' | 'matchStart'
/** Chess Arcade's nine events, less the moves: a solved position, a given-up one, a lesson starting. */
export type EventSound = 'win' | 'lose' | 'matchStart'

const DEFAULT_SOUNDS: Partial<Record<SoundKey, string>> = {
  move: '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  check: '/sounds/check.mp3',
  checkmate: '/sounds/checkmate.mp3',
  win: '/sounds/win.mp3',
  lose: '/sounds/lose.mp3',
  matchStart: '/sounds/matchStart.mp3',
}

// The sound sets that came over with the Chess Arcade themes (generated by
// scripts/import-arcade-themes.mjs). A theme that brought its own voice for
// an event uses it; anything else falls through to the default, and then to
// the synthesized knock.
const SKIN_SOUNDS: Record<string, Partial<Record<SoundKey, string>>> = Object.fromEntries(
  ARCADE_THEMES.filter((t) => t.sounds.length).map((t) => [t.id, Object.fromEntries(t.sounds.map((k) => [k, `/sounds/themes/${t.id}/${k}.mp3`]))]),
)

// ---------------------------------------------------------------------------
// Settings → Sounds: on or off for this device (on unless switched off).
// ---------------------------------------------------------------------------
const ON_KEY = 'sounds-on'
const ON_EVENT = 'sounds-on-change'
let onFallback = true
export function soundsOn(): boolean {
  try {
    return localStorage.getItem(ON_KEY) !== '0'
  } catch {
    return onFallback
  }
}
export function setSoundsOn(on: boolean) {
  onFallback = on
  try {
    localStorage.setItem(ON_KEY, on ? '1' : '0')
  } catch {
    // held for this visit
  }
  window.dispatchEvent(new Event(ON_EVENT))
}
export function useSoundsOn(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(ON_EVENT, cb)
      window.addEventListener('storage', cb)
      return () => {
        window.removeEventListener(ON_EVENT, cb)
        window.removeEventListener('storage', cb)
      }
    },
    soundsOn,
    () => true,
  )
}

let soundSkin: string | null = null
export function setSoundSkin(skin: string) {
  soundSkin = SKIN_SOUNDS[skin] ? skin : null
}

const sourceFor = (key: SoundKey) => (soundSkin && SKIN_SOUNDS[soundSkin][key]) || DEFAULT_SOUNDS[key] || null

const buffers = new Map<string, AudioBuffer>() // src -> decoded
async function bufferFor(c: Ctx, src: string) {
  const known = buffers.get(src)
  if (known) return known
  const bytes = await (await fetch(src)).arrayBuffer()
  const buf = await c.decodeAudioData(bytes)
  buffers.set(src, buf)
  return buf
}

async function playRecorded(key: SoundKey): Promise<boolean> {
  const src = sourceFor(key)
  if (!src) return false
  const c = getCtx()
  if (!c) return false
  if (c.state !== 'running') {
    try {
      await c.resume()
    } catch {
      return false
    }
  }
  try {
    const node = c.createBufferSource()
    node.buffer = await bufferFor(c, src)
    node.connect(out())
    node.start()
    return true
  } catch {
    return false
  }
}

/** Resume may be pending from a just-happened gesture: play once it lands. */
function withAudio(fn: (c: Ctx) => void) {
  try {
    const c = getCtx()
    if (!c) return
    if (c.state === 'running') fn(c)
    else
      c.resume()
        .then(() => {
          if (c.state === 'running') fn(c)
        })
        .catch(() => {})
  } catch {
    // audio is best-effort
  }
}

/** A solved position, a given-up one, or a lesson starting, in the skin's voice. */
export function playEventSound(key: EventSound) {
  if (!soundsOn()) return
  void playRecorded(key)
}

/** The sound for one move, by its SAN. */
export function playMoveSound(san: string) {
  if (!san || !soundsOn()) return
  if (san.endsWith('#')) {
    void playRecorded('checkmate').then((done) => done || withAudio((c) => scheduleFor(c, san)))
    return
  }
  if (san.startsWith('O-O')) {
    void playRecorded('castle').then((done) => done || withAudio((c) => scheduleFor(c, san)))
    return
  }
  // A move that both captures and checks plays both voices at once, the way
  // chess.com layers them.
  const isCapture = san.includes('x')
  const isCheck = san.endsWith('+')
  if (san.includes('=')) void playRecorded('promote')
  void Promise.all([playRecorded(isCapture ? 'capture' : 'move'), isCheck ? playRecorded('check') : Promise.resolve(true)]).then(
    ([baseDone, checkDone]) => {
      if (baseDone && checkDone) return
      withAudio((c) => {
        if (!baseDone) synthBase(c, isCapture)
        if (isCheck && !checkDone) checkChime(c, 0.02)
      })
    },
  )
}

/**
 * A board's move sound: plays when the position shown changes to one reached
 * by a move (stepping the answer, playing a move, walking a side line), not
 * when the board first appears.
 */
export function useMoveSound(at: string, san: string | undefined) {
  const shown = useRef(at)
  useEffect(() => {
    if (shown.current === at) return
    shown.current = at
    if (san) playMoveSound(san)
  }, [at, san])
}

/** An event sound when `happened` turns true: a position solved, the answer given up. */
export function useEventSound(happened: boolean, key: EventSound) {
  const was = useRef(happened)
  useEffect(() => {
    if (happened && !was.current) playEventSound(key)
    was.current = happened
  }, [happened, key])
}
