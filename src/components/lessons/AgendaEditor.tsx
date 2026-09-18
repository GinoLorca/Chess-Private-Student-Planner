export function AgendaEditor({
  items,
  onChange,
}: {
  items: string[]
  onChange: (items: string[]) => void
}) {
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
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-gold-500">•</span>
          <input
            value={item}
            onChange={(e) => update(i, e.target.value)}
            className="flex-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-sm text-ink-100 outline-none focus:border-gold-500"
          />
          <button onClick={() => remove(i)} className="text-xs text-ink-500 hover:text-red-400">
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ''])}
        className="text-xs text-gold-500 hover:text-gold-400"
      >
        + Add agenda item
      </button>
    </div>
  )
}
