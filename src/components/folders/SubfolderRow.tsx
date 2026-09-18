import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export function SubfolderRow({
  icon,
  label,
  count,
  onClick,
}: {
  icon: ReactNode
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-ink-800"
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.99 }}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-800 text-gold-500 transition-colors group-hover:bg-gold-500 group-hover:text-ink-950">
        {icon}
      </span>
      <span className="flex-1 text-[15px] font-medium text-ink-100">{label}</span>
      <span className="rounded-full bg-ink-800 px-2 py-0.5 text-xs font-semibold text-ink-300 group-hover:bg-gold-500/20 group-hover:text-gold-400">
        {count}
      </span>
    </motion.button>
  )
}

export function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"
        fill="currentColor"
      />
    </svg>
  )
}
