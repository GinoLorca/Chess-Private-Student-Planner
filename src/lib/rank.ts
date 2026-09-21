/** Rank strings by how often they've been used, most-used first; blanks dropped. */
export function rankByUse(values: string[]): string[] {
  const counts = new Map<string, number>()
  for (const raw of values) {
    const v = raw.trim()
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v)
}
