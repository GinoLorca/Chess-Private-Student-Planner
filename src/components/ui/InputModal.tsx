import { useState } from 'react'
import { Modal } from './Modal'

export function InputModal({
  open,
  onClose,
  onSubmit,
  title,
  label,
  initialValue = '',
  placeholder,
  submitLabel = 'Save',
}: {
  open: boolean
  onClose: () => void
  onSubmit: (value: string) => void
  title: string
  label: string
  initialValue?: string
  placeholder?: string
  submitLabel?: string
}) {
  const [value, setValue] = useState(initialValue)

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const trimmed = value.trim()
          if (!trimmed) return
          onSubmit(trimmed)
          setValue('')
        }}
      >
        <label className="mb-1 block text-xs font-medium text-ink-300">{label}</label>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="mb-4 w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-gold-500"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-ink-300 hover:text-ink-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-gold-500 px-4 py-1.5 text-sm font-semibold text-ink-950 hover:bg-gold-400"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
