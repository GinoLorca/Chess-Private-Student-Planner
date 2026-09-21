import clsx from 'clsx'
import type { ReactNode } from 'react'
import { Modal } from './Modal'

export interface ActionItem {
  label: string
  icon?: ReactNode
  danger?: boolean
  onSelect: () => void
}

/** The "…" menu: a list of big, tappable rows in a sheet. */
export function ActionSheet({
  open,
  onClose,
  title,
  items,
}: {
  open: boolean
  onClose: () => void
  title?: string
  items: ActionItem[]
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="-mx-2 flex flex-col">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
            className={clsx(
              'flex h-12 items-center gap-3 rounded-xl px-3 text-left text-[16px] font-medium transition active:bg-surface-2',
              item.danger ? 'text-danger' : 'text-ink',
            )}
          >
            {item.icon && <span className="text-ink-3">{item.icon}</span>}
            {item.label}
          </button>
        ))}
      </div>
    </Modal>
  )
}
