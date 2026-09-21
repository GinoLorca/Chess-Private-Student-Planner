import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Chip, ChipRow } from '../ui/Chip'
import { Plus } from '../ui/Icons'

interface PickSheetProps {
  open: boolean
  title: string
  /** Most-used first; the coach's own history, then built-ins. */
  options: string[]
  /** Options already in use, shown selected (multi) or dimmed (single). */
  current?: string[]
  /** Single: tap picks and closes. Multi: tap toggles, Done commits. */
  multi?: boolean
  placeholder?: string
  emptyHint?: string
  onPick: (values: string[]) => void | Promise<void>
  onClose: () => void
}

/**
 * The one sheet behind every "add a section / theme / agenda item" tap: what
 * the coach has used before is a chip, and typing is only for something new.
 */
export function PickSheet({ open, title, ...rest }: PickSheetProps) {
  return (
    <Modal open={open} onClose={rest.onClose} title={title}>
      <PickForm key={String(open)} {...rest} />
    </Modal>
  )
}

function PickForm({
  options,
  current = [],
  multi,
  placeholder = 'Or type something new…',
  emptyHint,
  onPick,
  onClose,
}: Omit<PickSheetProps, 'open' | 'title'>) {
  const [chosen, setChosen] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const shown = dedupe([...options, ...current.filter((c) => !options.includes(c))])

  async function commit(values: string[]) {
    const cleaned = dedupe(values.map((v) => v.trim()).filter(Boolean))
    if (cleaned.length === 0) return
    setBusy(true)
    try {
      await onPick(cleaned)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  function tap(value: string) {
    if (!multi) return void commit([value])
    setChosen((c) => (c.includes(value) ? c.filter((v) => v !== value) : [...c, value]))
  }

  function addCustom() {
    const v = custom.trim()
    if (!v) return
    if (!multi) return void commit([v])
    setChosen((c) => (c.includes(v) ? c : [...c, v]))
    setCustom('')
  }

  return (
    <div className="space-y-4">
      {shown.length > 0 ? (
        <ChipRow>
          {shown.map((value) => {
            const inUse = current.includes(value)
            return (
              <Chip
                key={value}
                selected={multi ? chosen.includes(value) : false}
                disabled={multi && inUse}
                className={inUse ? 'opacity-45' : undefined}
                title={inUse ? 'Already in this lesson' : undefined}
                onClick={() => tap(value)}
              >
                {value}
              </Chip>
            )
          })}
        </ChipRow>
      ) : (
        emptyHint && <p className="text-[14px] text-ink-3">{emptyHint}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          addCustom()
        }}
        className="flex gap-2"
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={placeholder}
          className="h-12 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface-2 px-3.5 text-[16px] outline-none focus:border-accent"
        />
        <Button type="submit" variant="secondary" disabled={!custom.trim()} icon={<Plus size={16} />}>
          {multi ? 'Add' : 'Use'}
        </Button>
      </form>

      {multi && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] text-ink-3">
            {chosen.length === 0 ? 'Tap what to add' : `${chosen.length} to add`}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={busy || chosen.length === 0} onClick={() => commit(chosen)}>
              {busy ? 'Adding…' : 'Done'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)]
}
