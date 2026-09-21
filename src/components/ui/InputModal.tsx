import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface InputModalProps {
  open: boolean
  title: string
  label?: string
  placeholder?: string
  initialValue?: string
  submitLabel?: string
  onSubmit: (value: string) => void | Promise<void>
  onClose: () => void
}

export function InputModal({ open, title, initialValue = '', onClose, ...form }: InputModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {/* Keyed on open so every showing starts from the initial value. */}
      <InputForm key={`${open}:${initialValue}`} initialValue={initialValue} onClose={onClose} {...form} />
    </Modal>
  )
}

function InputForm({
  label,
  placeholder,
  initialValue,
  submitLabel = 'Save',
  onSubmit,
  onClose,
}: Omit<InputModalProps, 'open' | 'title' | 'initialValue'> & { initialValue: string }) {
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await onSubmit(trimmed)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        {label && <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>}
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-12 w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-[16px] outline-none focus:border-accent"
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy || !value.trim()}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
