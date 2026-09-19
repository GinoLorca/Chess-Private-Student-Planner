import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPuzzle, deletePuzzle, deleteSection, listPuzzles, updateSection } from '../../lib/api'
import type { LessonSection, Puzzle } from '../../types/domain'
import { PuzzleThumb } from './PuzzleThumb'

export function SectionBlock({
  section,
  studentId,
  lessonPlanId,
  onOpenPuzzle,
  onDeleted,
  onPuzzlesChanged,
  reviewedIds,
}: {
  section: LessonSection
  studentId: string
  lessonPlanId: string
  onOpenPuzzle: (puzzleId: string) => void
  onDeleted: () => void
  onPuzzlesChanged: () => void
  reviewedIds: Set<string>
}) {
  const [title, setTitle] = useState(section.title)
  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    listPuzzles(section.id).then((rows) => {
      setPuzzles(rows)
      onPuzzlesChanged()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id])

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  async function handleAddPuzzle() {
    const puzzle = await createPuzzle(section.id)
    setPuzzles((prev) => [...(prev ?? []), puzzle])
    onPuzzlesChanged()
    onOpenPuzzle(puzzle.id)
  }

  async function handleDeletePuzzle(id: string) {
    await deletePuzzle(id)
    setPuzzles((prev) => prev?.filter((p) => p.id !== id) ?? null)
    onPuzzlesChanged()
  }

  async function handleDeleteSection() {
    if (!confirm(`Delete section "${section.title || 'Untitled'}" and its puzzles?`)) return
    await deleteSection(section.id)
    onDeleted()
  }

  const reviewedCount = puzzles?.filter((p) => reviewedIds.has(p.id)).length ?? 0

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/50 p-4">
      <div className={`flex items-start gap-2 ${collapsed ? '' : 'mb-3'}`}>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand section' : 'Collapse section'}
          className={`mt-0.5 shrink-0 text-ink-400 transition-transform hover:text-ink-100 ${collapsed ? '-rotate-90' : ''}`}
        >
          ▾
        </button>
        <textarea
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => updateSection(section.id, { title })}
          placeholder="Section theme, e.g. Tactics: My Opponent's Move"
          rows={1}
          className="flex-1 resize-none overflow-hidden border-b border-transparent bg-transparent text-sm font-semibold uppercase leading-snug tracking-wide text-gold-400 outline-none focus:border-gold-500"
        />
        {puzzles && (
          <span className="mt-0.5 shrink-0 rounded-full bg-ink-800 px-2 py-0.5 text-[10.5px] font-bold text-ink-400">
            {reviewedCount}/{puzzles.length}
          </span>
        )}
        <button onClick={handleDeleteSection} className="mt-0.5 shrink-0 text-xs text-ink-500 hover:text-red-400">
          delete section
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="space-y-2">
            {puzzles?.map((puzzle, i) => {
              const reviewed = reviewedIds.has(puzzle.id)
              return (
                <div
                  key={puzzle.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenPuzzle(puzzle.id)}
                  onKeyDown={(e) => e.key === 'Enter' && onOpenPuzzle(puzzle.id)}
                  className={`group flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border bg-ink-950/60 px-3 py-2 text-left transition-colors ${
                    reviewed ? 'border-green-700/40' : 'border-ink-800 hover:border-gold-600/50'
                  }`}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <PuzzleThumb fen={puzzle.starting_fen} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-ink-100">
                        #{i + 1} — {puzzle.label || 'Untitled'}
                        {reviewed && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" title="Reviewed" />}
                      </span>
                      {puzzle.summary && (
                        <span className="mt-0.5 block truncate text-xs text-ink-400">{puzzle.summary}</span>
                      )}
                    </span>
                  </span>
                  <Link
                    to={`/students/${studentId}/lessons/${lessonPlanId}/puzzles/${puzzle.id}/study`}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 rounded-full bg-ink-800 px-2.5 py-1 text-[10.5px] font-semibold text-ink-300 opacity-0 transition group-hover:opacity-100 hover:bg-gold-500 hover:text-ink-950"
                  >
                    Study
                  </Link>
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeletePuzzle(puzzle.id)
                    }}
                    className="shrink-0 text-xs text-ink-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                  >
                    delete
                  </span>
                </div>
              )
            })}
          </div>

          <button onClick={handleAddPuzzle} className="mt-3 text-xs text-gold-500 hover:text-gold-400">
            + Add position
          </button>
        </>
      )}
    </div>
  )
}
