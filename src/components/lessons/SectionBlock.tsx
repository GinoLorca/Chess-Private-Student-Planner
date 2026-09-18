import { useEffect, useState } from 'react'
import { createPuzzle, deletePuzzle, deleteSection, listPuzzles, updateSection } from '../../lib/api'
import type { LessonSection, Puzzle } from '../../types/domain'

export function SectionBlock({
  section,
  onOpenPuzzle,
  onDeleted,
}: {
  section: LessonSection
  onOpenPuzzle: (puzzleId: string) => void
  onDeleted: () => void
}) {
  const [title, setTitle] = useState(section.title)
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null)

  useEffect(() => {
    listPuzzles(section.id).then(setPuzzles)
  }, [section.id])

  async function handleAddPuzzle() {
    const puzzle = await createPuzzle(section.id)
    setPuzzles((prev) => [...(prev ?? []), puzzle])
    onOpenPuzzle(puzzle.id)
  }

  async function handleDeletePuzzle(id: string) {
    await deletePuzzle(id)
    setPuzzles((prev) => prev?.filter((p) => p.id !== id) ?? null)
  }

  async function handleDeleteSection() {
    if (!confirm(`Delete section "${section.title || 'Untitled'}" and its puzzles?`)) return
    await deleteSection(section.id)
    onDeleted()
  }

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => updateSection(section.id, { title })}
          placeholder="Section theme, e.g. Tactics: My Opponent's Move"
          className="flex-1 border-b border-transparent bg-transparent text-sm font-semibold uppercase tracking-wide text-gold-400 outline-none focus:border-gold-500"
        />
        <button onClick={handleDeleteSection} className="text-xs text-ink-500 hover:text-red-400">
          delete section
        </button>
      </div>

      <div className="space-y-2">
        {puzzles?.map((puzzle, i) => (
          <button
            key={puzzle.id}
            onClick={() => onOpenPuzzle(puzzle.id)}
            className="group flex w-full items-start justify-between gap-3 rounded-lg border border-ink-800 bg-ink-950/60 px-3 py-2 text-left hover:border-gold-600/50"
          >
            <div>
              <div className="text-sm font-medium text-ink-100">
                #{i + 1} — {puzzle.label || 'Untitled'}
              </div>
              {puzzle.summary && <div className="mt-0.5 line-clamp-1 text-xs text-ink-400">{puzzle.summary}</div>}
            </div>
            <span
              onClick={(e) => {
                e.stopPropagation()
                handleDeletePuzzle(puzzle.id)
              }}
              className="shrink-0 text-xs text-ink-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
            >
              delete
            </span>
          </button>
        ))}
      </div>

      <button onClick={handleAddPuzzle} className="mt-3 text-xs text-gold-500 hover:text-gold-400">
        + Add position
      </button>
    </div>
  )
}
