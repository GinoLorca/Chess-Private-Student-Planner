import { Modal } from './Modal'

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="mb-4 text-sm text-ink-300">{message}</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-ink-300 hover:text-ink-100">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm()
            onClose()
          }}
          className="rounded-lg bg-red-500/90 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-500"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
