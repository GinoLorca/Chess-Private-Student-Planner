import { useSessionSet } from '../../hooks/useSessionSet'

export function AgendaEditor({
  items,
  onChange,
  storageKey,
}: {
  items: string[]
  onChange: (items: string[]) => void
  storageKey: string
}) {
  const { set: doneSet, toggle } = useSessionSet(`agenda-done:${storageKey}`)

  function update(i: number, value: string) {
    const next = [...items]
    next[i] = value
    onChange(next)
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const done = doneSet.has(String(i))
        return (
          <div key={i} className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => toggle(String(i))}
              title={done ? 'Mark as not done' : 'Mark as done'}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold transition ${
                done ? 'border-gold-500 bg-gold-500 text-ink-950' : 'border-ink-600 bg-ink-800 text-transparent hover:border-gold-500'
              }`}
            >
              ✓
            </button>
            <input
              value={item}
              onChange={(e) => update(i, e.target.value)}
              className={`flex-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-sm outline-none focus:border-gold-500 ${
                done ? 'text-ink-500 line-through' : 'text-ink-100'
              }`}
            />
            <button onClick={() => remove(i)} className="text-xs text-ink-500 hover:text-red-400">
              ✕
            </button>
          </div>
        )
      })}
      <button
        onClick={() => onChange([...items, ''])}
        className="text-xs text-gold-500 hover:text-gold-400"
      >
        + Add agenda item
      </button>
    </div>
  )
}
