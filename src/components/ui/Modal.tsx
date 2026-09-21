import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Sheets slide up from the bottom (phone-friendly); dialogs float centred. */
  variant?: 'sheet' | 'dialog'
}

/**
 * On a phone a bottom sheet keeps the controls in thumb reach; on an iPad a
 * centred dialog is closer to the finger that opened it. The variant decides,
 * and the sheet becomes a dialog automatically above the sm breakpoint.
 */
export function Modal({ open, onClose, title, children, variant = 'sheet' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal>
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            className={clsx(
              'relative w-full bg-surface shadow-float',
              variant === 'sheet'
                ? 'pb-safe max-h-[90svh] overflow-y-auto rounded-t-3xl sm:max-w-md sm:rounded-3xl'
                : 'mx-4 max-w-md rounded-3xl',
            )}
            initial={variant === 'sheet' ? { y: 40, opacity: 0 } : { scale: 0.96, opacity: 0 }}
            animate={variant === 'sheet' ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={variant === 'sheet' ? { y: 40, opacity: 0 } : { scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          >
            {variant === 'sheet' && <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />}
            <div className="px-5 pt-4 pb-5">
              {title && <h2 className="mb-3 text-[18px] font-bold text-ink">{title}</h2>}
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
