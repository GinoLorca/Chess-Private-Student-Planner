import { motion } from 'framer-motion'

export function AddFolderTab({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-ink-600 pt-5 text-ink-500 transition hover:border-gold-500 hover:text-gold-500"
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.96 }}
    >
      <span className="text-3xl leading-none">+</span>
    </motion.button>
  )
}
