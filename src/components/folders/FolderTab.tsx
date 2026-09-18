import { motion } from 'framer-motion'
import { useState } from 'react'

export function FolderTab({
  name,
  color,
  onOpen,
  onLongPress,
}: {
  name: string
  color: string
  onOpen: () => void
  onLongPress?: () => void
}) {
  const [popped, setPopped] = useState(false)

  function handleClick() {
    if (popped) return
    setPopped(true)
    // let the pop/flip animation play before navigating away
    setTimeout(onOpen, 320)
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      onContextMenu={(e) => {
        if (!onLongPress) return
        e.preventDefault()
        onLongPress()
      }}
      className="group relative block w-full cursor-pointer select-none pt-5 text-left"
      whileHover={{ y: -6, rotate: -1 }}
      whileTap={{ scale: 0.97 }}
      animate={popped ? { scale: [1, 1.08, 1.02], rotate: [0, -3, 0], y: [0, -10, -4] } : {}}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      style={{ transformOrigin: 'bottom center' }}
    >
      {/* tab */}
      <div
        className="absolute left-5 top-0 h-6 w-[45%] rounded-t-md shadow-sm"
        style={{ background: shade(color, -12) }}
      />

      {/* folder body */}
      <div
        className="relative flex h-32 flex-col justify-end overflow-hidden rounded-lg rounded-tl-none p-4 shadow-[0_8px_18px_-6px_rgba(0,0,0,0.55)] ring-1 ring-black/10 transition-shadow group-hover:shadow-[0_14px_24px_-8px_rgba(0,0,0,0.6)]"
        style={{
          background: `linear-gradient(160deg, ${shade(color, 6)} 0%, ${color} 45%, ${shade(color, -8)} 100%)`,
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-white/10" />
        <span
          className="font-marker text-2xl leading-none text-ink-950/80"
          style={{ transform: 'rotate(-1.5deg)' }}
        >
          {name}
        </span>
      </div>
    </motion.button>
  )
}

export function shade(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const r = Math.min(255, Math.max(0, (num >> 16) + amt))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt))
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}
