import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import type { LessonSection, Puzzle } from '../types/domain'
import { useLesson, useLessonContentMutations, useLessonPlanMutations, useStudent } from '../lib/queries'
import { normalizeFen } from '../lib/fen'
import { useSessionSet } from '../hooks/useSessionSet'
import { Page, Card, EmptyState, LoadingPage, SectionLabel } from '../components/ui/Page'
import { Button, IconButton } from '../components/ui/Button'
import { InputModal } from '../components/ui/InputModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ActionSheet } from '../components/ui/ActionSheet'
import { Board } from '../components/board/Board'
import { ImportSheet } from '../components/import/ImportSheet'
import { patchFromImported } from '../lib/import'
import { Check, ChevronRight, Download, Eye, Knight, More, Pencil, Plus, Trash } from '../components/ui/Icons'

export function LessonPlanDetailPage() {
  const { studentId = '', lessonPlanId = '' } = useParams<{ studentId: string; lessonPlanId: string }>()
  const navigate = useNavigate()
  const { data: student } = useStudent(studentId)
  const { data: lesson, isLoading } = useLesson(lessonPlanId)
  const planMutations = useLessonPlanMutations(studentId)
  const content = useLessonContentMutations(lessonPlanId)
  const [addingSection, setAddingSection] = useState(false)
  const [sectionMenu, setSectionMenu] = useState<LessonSection | null>(null)
  const [renamingSection, setRenamingSection] = useState<LessonSection | null>(null)
  const [deletingSection, setDeletingSection] = useState<LessonSection | null>(null)
  const [deletingPuzzle, setDeletingPuzzle] = useState<Puzzle | null>(null)
  const [quickAddFor, setQuickAddFor] = useState<LessonSection | null>(null)

  if (isLoading && !lesson) return <LoadingPage />
  if (!lesson) return <Page back={`/students/${studentId}/lessons`}>Lesson not found.</Page>

  const { plan, sections, puzzlesBySection } = lesson
  const base = `/students/${studentId}/lessons/${plan.id}`
  const puzzleCount = Object.values(puzzlesBySection).reduce((n, list) => n + list.length, 0)

  async function addPuzzle(sectionId: string) {
    const puzzle = await content.createPuzzle.mutateAsync({ sectionId })
    navigate(`${base}/puzzles/${puzzle.id}/edit`)
  }

  return (
    <Page back={`/students/${studentId}/lessons`} eyebrow={student?.name} width="wide">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight text-ink">Lesson {plan.number}</h1>
          <TitleField
            key={plan.title}
            value={plan.title}
            placeholder="Add a title…"
            onCommit={(title) => title !== plan.title && planMutations.update.mutate({ id: plan.id, patch: { title } })}
          />
          <TitleField
            key={`theme-${plan.theme ?? ''}`}
            value={plan.theme ?? ''}
            placeholder="Theme block, e.g. Endgames — October"
            small
            onCommit={(theme) => theme !== (plan.theme ?? '') && planMutations.update.mutate({ id: plan.id, patch: { theme } })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Link to={`${base}/coach`} className="contents">
            <Button variant="secondary" icon={<Eye size={18} />} disabled={puzzleCount === 0}>
              Coach view
            </Button>
          </Link>
          <Link to={`${base}/present`} className="contents">
            <Button variant="primary" icon={<Knight size={18} />} disabled={puzzleCount === 0}>
              Present
            </Button>
          </Link>
        </div>
      </div>

      <Agenda
        planId={plan.id}
        items={plan.agenda}
        onChange={(agenda) => planMutations.update.mutate({ id: plan.id, patch: { agenda } })}
      />

      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.id} className="overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <h2 className="flex-1 text-[13px] font-bold tracking-wider text-accent-strong uppercase">
                {section.title || 'Untitled section'}
              </h2>
              <span className="text-[12px] font-semibold text-ink-3 tabular-nums">
                {puzzlesBySection[section.id]?.length ?? 0}
              </span>
              <IconButton label="Section options" className="-mr-2 h-9 w-9" onClick={() => setSectionMenu(section)}>
                <More size={18} />
              </IconButton>
            </div>
            <div>
              {(puzzlesBySection[section.id] ?? []).map((puzzle, i) => (
                <PuzzleRow
                  key={puzzle.id}
                  puzzle={puzzle}
                  index={i}
                  to={`${base}/puzzles/${puzzle.id}`}
                  onDelete={() => setDeletingPuzzle(puzzle)}
                />
              ))}
            </div>
            <div className="flex border-t border-line">
              <button
                onClick={() => setQuickAddFor(section)}
                className="flex h-12 flex-1 items-center justify-center gap-2 text-[15px] font-semibold text-accent transition active:bg-surface-2"
              >
                <Download size={18} /> Quick add
              </button>
              <button
                onClick={() => addPuzzle(section.id)}
                className="flex h-12 flex-1 items-center justify-center gap-2 border-l border-line text-[15px] font-semibold text-accent transition active:bg-surface-2"
              >
                <Plus size={18} /> Blank position
              </button>
            </div>
          </Card>
        ))}

        {sections.length === 0 && (
          <EmptyState
            title="Start with a section"
            body='Sections are the themes of the session — "Back rank", "Can I take it?", "Endgame technique".'
          />
        )}

        <Button variant="soft" block size="lg" icon={<Plus size={18} />} onClick={() => setAddingSection(true)}>
          Add section
        </Button>
      </div>

      <InputModal
        open={addingSection}
        title="New section"
        label="Theme"
        placeholder="e.g. Detect the weakness"
        submitLabel="Add"
        onClose={() => setAddingSection(false)}
        onSubmit={(title) => content.createSection.mutateAsync(title).then(() => undefined)}
      />
      <ActionSheet
        open={Boolean(sectionMenu)}
        onClose={() => setSectionMenu(null)}
        title={sectionMenu?.title || 'Section'}
        items={[
          { label: 'Rename section', icon: <Pencil />, onSelect: () => setRenamingSection(sectionMenu) },
          { label: 'Delete section', icon: <Trash />, danger: true, onSelect: () => setDeletingSection(sectionMenu) },
        ]}
      />
      <InputModal
        open={Boolean(renamingSection)}
        title="Rename section"
        label="Theme"
        initialValue={renamingSection?.title ?? ''}
        onClose={() => setRenamingSection(null)}
        onSubmit={async (title) => {
          if (renamingSection) await content.updateSection.mutateAsync({ id: renamingSection.id, patch: { title } })
        }}
      />
      <ConfirmDialog
        open={Boolean(deletingSection)}
        title={`Delete "${deletingSection?.title || 'this section'}"?`}
        body="All of its positions go with it."
        confirmLabel="Delete"
        onClose={() => setDeletingSection(null)}
        onConfirm={async () => {
          if (deletingSection) await content.deleteSection.mutateAsync(deletingSection.id)
        }}
      />
      <ImportSheet
        open={Boolean(quickAddFor)}
        mode="add"
        onClose={() => setQuickAddFor(null)}
        onImport={async (position) => {
          if (!quickAddFor) return
          await content.createPuzzle.mutateAsync({ sectionId: quickAddFor.id, initial: patchFromImported(position) })
        }}
      />
      <ConfirmDialog
        open={Boolean(deletingPuzzle)}
        title={`Delete ${deletingPuzzle?.label || 'this position'}?`}
        confirmLabel="Delete"
        onClose={() => setDeletingPuzzle(null)}
        onConfirm={async () => {
          if (deletingPuzzle) await content.deletePuzzle.mutateAsync(deletingPuzzle.id)
        }}
      />
    </Page>
  )
}

// Keyed on the saved value by its parent, so a fresh server value resets the draft.
function TitleField({
  value,
  placeholder,
  small,
  onCommit,
}: {
  value: string
  placeholder: string
  small?: boolean
  onCommit: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft.trim())}
      placeholder={placeholder}
      className={clsx(
        'mt-0.5 block w-full max-w-md bg-transparent outline-none placeholder:text-ink-3',
        small ? 'text-[14px] text-ink-3' : 'text-[17px] text-ink-2',
      )}
    />
  )
}

function PuzzleRow({ puzzle, index, to, onDelete }: { puzzle: Puzzle; index: number; to: string; onDelete: () => void }) {
  const excerpt = puzzle.summary.replace(/\s+/g, ' ').trim()
  return (
    <div className={clsx('flex items-center', index > 0 && 'border-t border-line')}>
      <Link to={to} className="flex min-h-18 min-w-0 flex-1 items-center gap-3.5 px-4 py-2.5 transition active:bg-surface-2">
        <div className="w-14 shrink-0">
          <Board
            fen={normalizeFen(puzzle.starting_fen, puzzle.side_to_move)}
            arrows={puzzle.arrows}
            highlights={puzzle.highlights}
            coordinates={false}
            className="rounded-sm shadow-none"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-ink">
            <span className="text-ink-3 tabular-nums">#{index + 1}</span> {puzzle.label}
            {puzzle.solution.length > 0 && (
              <span className="ml-2 font-mono text-[13px] font-medium text-ink-3">
                [{puzzle.solution.map((m) => m.san).join(', ')}]
              </span>
            )}
          </p>
          {excerpt && <p className="truncate text-[13.5px] text-ink-2">{excerpt}</p>}
        </div>
        <ChevronRight className="shrink-0 text-ink-3" />
      </Link>
      <IconButton label="Delete position" className="mr-1 h-9 w-9 text-ink-3" onClick={onDelete}>
        <Trash size={17} />
      </IconButton>
    </div>
  )
}

/**
 * The agenda is the coach's in-session checklist. Items live on the plan;
 * which ones are ticked is per device per session — a fresh lesson starts unticked.
 */
function Agenda({ planId, items, onChange }: { planId: string; items: string[]; onChange: (items: string[]) => void }) {
  const { set: done, toggle } = useSessionSet(`agenda-${planId}`)
  const [adding, setAdding] = useState(false)

  return (
    <Card className="mb-5 px-4 py-3">
      <div className="flex items-center justify-between">
        <SectionLabel className="mb-0">Agenda</SectionLabel>
        <button onClick={() => setAdding(true)} className="text-[14px] font-semibold text-accent">
          + Add item
        </button>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {items.map((item, i) => {
            const key = `${i}:${item}`
            const checked = done.has(key)
            return (
              <li key={key} className="group flex items-center gap-3">
                <button
                  onClick={() => toggle(key)}
                  aria-pressed={checked}
                  className={clsx(
                    'grid h-11 w-11 shrink-0 place-items-center rounded-xl transition',
                    checked ? 'text-accent' : 'text-line-strong',
                  )}
                >
                  <span
                    className={clsx(
                      'grid h-6 w-6 place-items-center rounded-lg border-2',
                      checked ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong',
                    )}
                  >
                    {checked && <Check size={15} />}
                  </span>
                </button>
                <span className={clsx('flex-1 text-[16px]', checked ? 'text-ink-3 line-through' : 'text-ink')}>{item}</span>
                <IconButton
                  label="Remove item"
                  className="h-9 w-9 text-ink-3 opacity-60"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                >
                  <Trash size={16} />
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}
      <InputModal
        open={adding}
        title="Agenda item"
        placeholder="e.g. Review last week's game"
        submitLabel="Add"
        onClose={() => setAdding(false)}
        onSubmit={(text) => onChange([...items, text])}
      />
    </Card>
  )
}
