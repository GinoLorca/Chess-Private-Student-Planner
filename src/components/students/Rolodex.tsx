import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { animate, motion, useMotionValue, useTransform, type MotionValue } from 'framer-motion'
import clsx from 'clsx'
import type { Student } from '../../types/domain'
import { LogoBadge } from '../lesson/Folder'
import { onColor } from '../../lib/colors'
import { useFolderCounts } from '../../lib/queries'
import { More } from '../ui/Icons'

interface RolodexProps {
  students: Student[]
  onOpen: (student: Student) => void
  onMenu: (student: Student) => void
}

/** How far apart neighbouring cards sit on the wheel, and how much a flick moves it. */
const STEP_DEG = 34
const STEP_Y = 92
const DRAG_PX_PER_CARD = 120
const VISIBLE = 4

/**
 * The student folders on a wheel, like a desk Rolodex: the one in front faces
 * you, the rest curl away above and below. Flick up or down (or scroll, or
 * use the arrow keys) to turn it; tap the front folder and it pops out
 * toward you before opening. The strip underneath jumps straight to a name.
 */
export function Rolodex({ students, onOpen, onMenu }: RolodexProps) {
  const progress = useMotionValue(0)
  const [current, setCurrent] = useState(0)
  const [popping, setPopping] = useState<string | null>(null)
  const count = students.length
  const stopAnim = useRef<(() => void) | null>(null)

  const clamp = (v: number) => Math.max(0, Math.min(count - 1, v))

  function settle(target: number, velocity = 0) {
    const to = clamp(Math.round(target))
    stopAnim.current?.()
    const controls = animate(progress, to, { type: 'spring', stiffness: 260, damping: 28, velocity })
    stopAnim.current = () => controls.stop()
    setCurrent(to)
  }

  useEffect(() => {
    const unsub = progress.on('change', (v) => {
      const near = clamp(Math.round(v))
      setCurrent((c) => (c === near ? c : near))
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  // Keep the wheel in range when a folder is added or removed.
  useEffect(() => {
    if (progress.get() > count - 1) settle(count - 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  // --- input: drag, wheel, keys ---------------------------------------------
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    stopAnim.current?.()
    const startY = e.clientY
    const startP = progress.get()
    let lastY = startY
    let lastT = performance.now()
    let velocity = 0
    let moved = false
    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY
      if (Math.abs(dy) > 4) moved = true
      const now = performance.now()
      velocity = ((lastY - ev.clientY) / DRAG_PX_PER_CARD) / Math.max(1, now - lastT) * 1000
      lastY = ev.clientY
      lastT = now
      // Dragging down brings the folders above into view (progress decreases).
      const raw = startP - dy / DRAG_PX_PER_CARD
      const over = raw < 0 ? raw : raw > count - 1 ? raw - (count - 1) : 0
      progress.set(raw - over * 0.75)
    }
    const onUp = (ev: PointerEvent) => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      if (!moved) {
        // A tap. Pointer capture makes the click land on the wheel itself, so
        // work out what was under the finger here instead of via onClick.
        const el = document.elementFromPoint(ev.clientX, ev.clientY)
        const menu = el?.closest?.('[data-menu]') as HTMLElement | null
        const card = el?.closest?.('[data-index]') as HTMLElement | null
        if (menu && card) onMenu(students[Number(card.dataset.index)])
        else if (card) {
          const i = Number(card.dataset.index)
          tapCard(i, students[i])
        }
        return
      }
      const flick = Math.abs(velocity) > 1.5 ? Math.sign(velocity) : 0
      settle(progress.get() + flick * 0.6, velocity)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  const wheelAccum = useRef(0)
  function onWheel(e: React.WheelEvent) {
    wheelAccum.current += e.deltaY
    if (Math.abs(wheelAccum.current) < 40) return
    const dir = Math.sign(wheelAccum.current)
    wheelAccum.current = 0
    settle(Math.round(progress.get()) + dir)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        settle(Math.round(progress.get()) + 1)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        settle(Math.round(progress.get()) - 1)
      } else if (e.key === 'Enter' && students[current] && !popping) {
        pop(students[current])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, students, popping])

  function pop(student: Student) {
    setPopping(student.id)
    window.setTimeout(() => onOpen(student), 380)
  }

  function tapCard(i: number, student: Student) {
    if (popping) return
    if (i === current) pop(student)
    else settle(i)
  }

  const front = students[current]

  return (
    <div className="select-none">
      <div
        className="relative mx-auto h-[440px] w-full max-w-[560px] touch-none [perspective:1400px] sm:h-[480px]"
        onPointerDown={onPointerDown}
        onWheel={onWheel}
        role="listbox"
        aria-label="Students"
        aria-activedescendant={front ? `folder-${front.id}` : undefined}
      >
        {/* The spindle the folders hang off, for a hint of the machine. */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        {students.map((s, i) => (
          <Card
            key={s.id}
            index={i}
            student={s}
            progress={progress}
            count={count}
            isFront={i === current}
            popping={popping === s.id}
            dimmed={popping !== null && popping !== s.id}
          />
        ))}
      </div>

      {/* Jump strip: straight to a name without spinning. */}
      <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {students.map((s, i) => (
          <button
            key={s.id}
            onClick={() => settle(i)}
            className={clsx(
              'flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold transition',
              i === current ? 'border-ink bg-ink' : 'border-line-strong bg-surface text-ink-2',
            )}
            style={i === current ? { color: 'var(--bg)' } : undefined}
          >
            <span className="block h-3 w-3 rounded-sm" style={{ background: s.color }} />
            {shortName(s.name)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[12.5px] text-on-bg-2">Flick to turn · tap the front folder to open</p>
    </div>
  )
}

function Card({
  index,
  student,
  progress,
  count,
  isFront,
  popping,
  dimmed,
}: {
  index: number
  student: Student
  progress: MotionValue<number>
  count: number
  isFront: boolean
  popping: boolean
  dimmed: boolean
}) {
  // Offset from the front: 0 faces you, negative is above (curled back), positive below.
  const offset = useTransform(progress, (p) => index - p)
  const rotateX = useTransform(offset, (o) => o * STEP_DEG)
  const y = useTransform(offset, (o) => Math.sin(Math.max(-1.5, Math.min(1.5, o)) * 0.9) * STEP_Y * 1.15 + o * 10)
  const z = useTransform(offset, (o) => -Math.abs(o) * 150)
  const scale = useTransform(offset, (o) => 1 - Math.min(Math.abs(o), 3) * 0.06)
  const opacity = useTransform(offset, (o) => (Math.abs(o) > VISIBLE ? 0 : 1 - Math.min(Math.abs(o), VISIBLE) * 0.2))
  const zIndex = useTransform(offset, (o) => count - Math.round(Math.abs(o) * 10))
  // Lighting: a lamp above and slightly left. Cards curled back (above the
  // front) fall into shadow faster than cards below; a sheen slides across
  // the cover as a card turns through the light, and the top edge catches a
  // rim highlight when it faces you.
  const shade = useTransform(offset, (o) => (o < 0 ? Math.min(-o, 2) * 0.3 : Math.min(o, 2) * 0.16))
  const sheenPos = useTransform(offset, (o) => `${55 - Math.max(-1.5, Math.min(1.5, o)) * 70}% 0%`)
  const sheenOpacity = useTransform(offset, (o) => Math.max(0, 0.55 - Math.abs(o) * 0.45))
  const rim = useTransform(offset, (o) => Math.max(0, 0.45 - Math.abs(o) * 0.4))
  const pointerEvents = useTransform(offset, (o) => (Math.abs(o) > VISIBLE ? 'none' : 'auto'))

  const { data: counts } = useFolderCounts(isFront ? student.id : undefined)
  const lessons = counts?.lesson_plan
  const ink = useMemo(() => onColor(student.color), [student.color])
  const dark = ink.dark

  return (
    <motion.div
      id={`folder-${student.id}`}
      data-index={index}
      role="option"
      aria-selected={isFront}
      style={{ rotateX, y, z, scale, opacity, zIndex, pointerEvents, transformStyle: 'preserve-3d' }}
      className="absolute inset-x-3 top-1/2 h-[250px] -translate-y-1/2 [backface-visibility:hidden] sm:inset-x-6"
    >
      <motion.div
        animate={
          popping
            ? { scale: 1.16, y: -22, rotateX: -8, boxShadow: '0 40px 70px -20px rgba(0,0,0,0.55)' }
            : dimmed
              ? { scale: 0.96, opacity: 0.5 }
              : { scale: 1, y: 0, rotateX: 0, opacity: 1, boxShadow: '0 18px 40px -22px rgba(0,0,0,0.45)' }
        }
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        className="relative h-full cursor-pointer rounded-2xl"
      >
        {/* Tab */}
        <span
          className="absolute -top-6 left-6 flex h-7 w-[44%] items-center rounded-t-xl px-3 text-[12px] font-bold tracking-wider uppercase"
          style={{ background: student.color, color: dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)', filter: 'brightness(0.94)' }}
        >
          {initials(student.name)}
        </span>
        {/* Folder body */}
        <div
          className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border p-5"
          style={{
            background: `linear-gradient(165deg, ${student.color} 0%, ${student.color} 58%, ${mix(student.color)} 100%)`,
            borderColor: 'rgba(0,0,0,0.12)',
          }}
        >
          {/* Rim light along the top edge, brightest when the card faces you. */}
          <motion.span
            className="pointer-events-none absolute inset-x-0 top-0 h-2/5"
            style={{ opacity: rim, background: 'linear-gradient(to bottom, rgba(255,255,255,0.7), rgba(255,255,255,0))' }}
          />
          {/* The sheen that travels across the cover as the card turns. */}
          <motion.span
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: sheenOpacity,
              backgroundImage: 'linear-gradient(105deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0) 65%)',
              backgroundSize: '220% 100%',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: sheenPos,
            }}
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-widest uppercase" style={{ color: ink.inkFaint }}>
                Student
              </p>
              <h2 className="mt-1 line-clamp-2 text-balance text-[26px] leading-tight font-bold sm:text-[30px]" style={{ color: ink.ink }}>
                {student.name}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                data-menu
                aria-label={`Options for ${student.name}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
                style={{ color: ink.inkSoft }}
              >
                <More size={20} />
              </button>
            </div>
          </div>
          {/* The school badge, stamped in the clear band between the name and the foot of the cover. */}
          {student.logo && (
            <div className="pointer-events-none absolute inset-x-0 top-[92px] bottom-[48px] grid place-items-center">
              <LogoBadge
                logo={student.logo}
                size={104}
                className="-rotate-3 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5),inset_0_0_0_3px_rgba(0,0,0,0.08)]"
              />
            </div>
          )}
          <div className="relative flex items-end justify-between">
            <p className="text-[14px] font-semibold" style={{ color: ink.inkSoft }}>
              {isFront && lessons !== undefined ? `${lessons} lesson${lessons === 1 ? '' : 's'}` : ' '}
            </p>
            <span
              className="rounded-full px-3 py-1.5 text-[13px] font-bold transition"
              style={
                isFront
                  ? { background: dark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.75)', color: dark ? '#1a1a19' : '#fff' }
                  : { background: ink.chip, color: ink.inkSoft }
              }
            >
              {isFront ? 'Open' : ''}
            </span>
          </div>
          {/* Depth shading as the card turns away. */}
          <motion.span className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: shade }} />
        </div>
      </motion.div>
    </motion.div>
  )
}

function initials(name: string): string {
  const nick = /"([^"]+)"/.exec(name)?.[1]
  if (nick) return nick
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function shortName(name: string): string {
  const nick = /"([^"]+)"/.exec(name)?.[1]
  return nick ?? name.split(/\s+/)[0]
}


/** A slightly deeper version of the folder colour for the bottom edge. */
function mix(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const f = (c: number) => Math.max(0, Math.round(c * 0.86))
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
}
