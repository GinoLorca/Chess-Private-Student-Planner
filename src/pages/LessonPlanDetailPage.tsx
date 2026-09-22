import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import type { LessonSection, Puzzle } from '../types/domain'
import type { PuzzlePatch } from '../lib/data'
import {
  useLesson,
  useLessonContentMutations,
  useLessonHistory,
  useLessonPlanMutations,
  useLessonTemplateMutations,
  useStudent,
  useStudents,
} from '../lib/queries'
import { agendaOptions, sectionOptions, themeOptions } from '../lib/lessonDefaults'
import { PickSheet } from '../components/lesson/PickSheet'
import { DividerPaper, DividerTabs, FolderBody, FolderTab, IndexCard, StatusStamp, StickyNote } from '../components/lesson/Folder'
import { FOLDER_COLORS, onColor } from '../lib/colors'
import { nextStatus } from '../lib/lessonStatus'
import { useSessionSet } from '../hooks/useSessionSet'
import { Page, LoadingPage } from '../components/ui/Page'
import { Button, IconButton } from '../components/ui/Button'
import { InputModal } from '../components/ui/InputModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ActionSheet } from '../components/ui/ActionSheet'
import { ImportSheet } from '../components/import/ImportSheet'
import { FenSheet } from '../components/lesson/FenSheet'
import { patchFromImported } from '../lib/import'
import { Check, ChevronDown, Document, Download, Eye, Knight, LinkIcon, More, Pencil, Plus, Recycle, Target, Trash } from '../components/ui/Icons'
import { answerProblem } from '../lib/solution'
import { copyText, puzzleLink } from '../lib/links'

export function LessonPlanDetailPage() {
  const { studentId = '', lessonPlanId = '' } = useParams<{ studentId: string; lessonPlanId: string }>()
  const navigate = useNavigate()
  const { data: student } = useStudent(studentId)
  const { data: lesson, isLoading } = useLesson(lessonPlanId)
  const planMutations = useLessonPlanMutations(studentId)
  const content = useLessonContentMutations(lessonPlanId)
  const templates = useLessonTemplateMutations()
  const { data: history } = useLessonHistory()
  const [addingSection, setAddingSection] = useState(false)
  const [pickingTheme, setPickingTheme] = useState(false)
  const [planMenu, setPlanMenu] = useState(false)
  const [recycling, setRecycling] = useState(false)
  const { data: students = [] } = useStudents()
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [sectionMenu, setSectionMenu] = useState<LessonSection | null>(null)
  const [renamingSection, setRenamingSection] = useState<LessonSection | null>(null)
  const [deletingSection, setDeletingSection] = useState<LessonSection | null>(null)
  const [deletingPuzzle, setDeletingPuzzle] = useState<Puzzle | null>(null)
  const [quickAddFor, setQuickAddFor] = useState<LessonSection | null>(null)
  const [addingFens, setAddingFens] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  // Which divider is open. Remembered per lesson for the session, so coming
  // back from a position lands on the same tab.
  const [openSectionId, setOpenSectionId] = useState<string | null>(() => sessionStorage.getItem(`open-section-${lessonPlanId}`))
  function openSection(id: string) {
    setOpenSectionId(id)
    sessionStorage.setItem(`open-section-${lessonPlanId}`, id)
  }

  // "Done, add another" in the editor comes back here with ?quickadd=<section>,
  // which opens the sheet straight away; closing it clears the param.
  const quickAddParam = searchParams.get('quickadd')
  const quickAddSection = quickAddFor ?? lesson?.sections.find((s) => s.id === quickAddParam) ?? null
  function closeQuickAdd() {
    setQuickAddFor(null)
    if (quickAddParam) setSearchParams({}, { replace: true })
  }

  if (isLoading && !lesson) return <LoadingPage />
  if (!lesson) return <Page back={`/students/${studentId}/lessons`}>Lesson not found.</Page>

  const { plan, sections, puzzlesBySection } = lesson
  const base = `/students/${studentId}/lessons/${plan.id}`
  const puzzleCount = Object.values(puzzlesBySection).reduce((n, list) => n + list.length, 0)
  const todoCount = Object.values(puzzlesBySection).reduce((n, list) => n + list.filter((p) => !p.done).length, 0)

  // FENs go into the open section, or a "Positions" section when there is none yet; then straight to the bench.
  async function addFens(positions: PuzzlePatch[]) {
    let sectionId = active?.id
    if (!sectionId) sectionId = (await content.createSection.mutateAsync('Positions')).id
    for (const p of positions) await content.createPuzzle.mutateAsync({ sectionId, initial: p })
    if (positions.length) navigate(`${base}/annotate`)
  }

  async function addPuzzle(sectionId: string) {
    const puzzle = await content.createPuzzle.mutateAsync({ sectionId })
    navigate(`${base}/puzzles/${puzzle.id}/edit`)
  }

  function cycleStatus() {
    const status = nextStatus(plan.status)
    planMutations.update.mutate({
      id: plan.id,
      patch: { status, taught_on: status === 'taught' ? today() : null },
    })
  }

  const folderColor = student?.color ?? FOLDER_COLORS[0]
  const ink = onColor(folderColor)
  // Divider colours: the palette in order, skipping the folder's own colour.
  const dividerPalette = FOLDER_COLORS.filter((c) => c !== folderColor)
  const dividerColor = (i: number) => dividerPalette[i % dividerPalette.length]
  const active = sections.find((sec) => sec.id === openSectionId) ?? sections[0] ?? null
  const activeIndex = active ? sections.indexOf(active) : 0
  const activePuzzles = active ? (puzzlesBySection[active.id] ?? []) : []

  const viewButtons = (compact: boolean) => (
    <>
      {todoCount > 0 && (
        <Link to={`${base}/annotate`} className="contents">
          <Button variant="soft" icon={compact ? undefined : <Pencil size={18} />}>
            Annotate{compact ? '' : ` · ${todoCount}`}
          </Button>
        </Link>
      )}
      <Link to={`${base}/sheet`} className="contents">
        <Button variant={compact ? 'soft' : 'ghost'} icon={compact ? undefined : <Document size={18} />} disabled={puzzleCount === 0}>
          Sheet
        </Button>
      </Link>
      <Link to={`${base}/learn`} className="contents">
        <Button variant="secondary" icon={compact ? undefined : <Target size={18} />} disabled={puzzleCount === 0}>
          Learn
        </Button>
      </Link>
      <Link to={`${base}/coach`} className="contents">
        <Button variant="secondary" icon={compact ? undefined : <Eye size={18} />} disabled={puzzleCount === 0}>
          Coach view
        </Button>
      </Link>
      <Link to={`${base}/present`} className="contents">
        <Button variant="primary" icon={compact ? undefined : <Knight size={18} />} disabled={puzzleCount === 0}>
          Present
        </Button>
      </Link>
    </>
  )

  return (
    <Page
      back={`/students/${studentId}/lessons`}
      width="wide"
      className="pt-6"
      actions={
        <>
          <div className="hidden items-center gap-2 sm:flex">{viewButtons(false)}</div>
          <IconButton label="Lesson options" onClick={() => setPlanMenu(true)}>
            <More />
          </IconButton>
        </>
      }
    >
      <FolderTab color={folderColor} name={student?.name ?? 'Student'} aside={`Lesson ${plan.number}`} logo={student?.logo} />
      <FolderBody color={folderColor}>
        {/* Header: the lesson number, its stamp, title and theme block; the agenda sticky beside it. */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-4">
              <div className="flex items-baseline gap-2.5">
                <span className="text-[12px] font-bold tracking-[0.14em] uppercase sm:text-[14px]" style={{ color: ink.inkFaint }}>
                  Lesson
                </span>
                <span className="folder-number font-display text-[60px] leading-[0.9] font-bold tracking-[-0.02em] sm:text-[76px]" style={{ color: ink.ink }}>
                  {plan.number}
                </span>
              </div>
              <div className="ml-1 flex min-w-0 flex-col gap-2 pt-1">
                <div className="flex items-center gap-3">
                  <StatusStamp status={plan.status} onTap={cycleStatus} />
                  <TitleField
                    key={plan.title}
                    value={plan.title}
                    placeholder="Add a title…"
                    onCommit={(title) => title !== plan.title && planMutations.update.mutate({ id: plan.id, patch: { title } })}
                    ink={ink.ink}
                    placeholderInk={ink.inkFaint}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setPickingTheme(true)}
                  className={clsx(
                    'inline-flex h-8 max-w-full items-center gap-2 self-start rounded-full pr-3 pl-2.5 text-[14px] font-semibold transition',
                  )}
                  style={{ background: ink.chip, color: plan.theme ? ink.ink : ink.inkFaint }}
                >
                  <span className={clsx('block h-2 w-2 rounded-full', plan.theme ? 'bg-[#2e7d5b]' : 'bg-black/25')} />
                  <span className="truncate">{plan.theme || 'Theme block'}</span>
                  <ChevronDown size={14} className="shrink-0" />
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:hidden">{viewButtons(true)}</div>
          </div>

          <StickyNote className="mt-3 w-full lg:mt-0 lg:w-[300px] lg:shrink-0">
            <Agenda
              planId={plan.id}
              items={plan.agenda}
              options={agendaOptions(history)}
              onChange={(agenda) => planMutations.update.mutate({ id: plan.id, patch: { agenda } })}
            />
          </StickyNote>
        </div>

        <div className="mt-5">
          <DividerTabs
            tabs={sections.map((sec, i) => ({
              id: sec.id,
              title: sec.title,
              color: dividerColor(i),
              count: puzzlesBySection[sec.id]?.length ?? 0,
              warn: (puzzlesBySection[sec.id] ?? []).some((pz) => Boolean(answerProblem(pz))),
            }))}
            activeId={active?.id ?? null}
            onPick={openSection}
            onAdd={() => setAddingSection(true)}
          />
          <DividerPaper color={active ? dividerColor(activeIndex) : 'var(--line-strong)'}>
            {active ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-[13px] font-bold tracking-[0.1em] text-ink-2 uppercase">{active.title || 'Untitled section'}</h2>
                  <IconButton label="Section options" className="-mr-2 h-9 w-9 text-ink-3" onClick={() => setSectionMenu(active)}>
                    <More size={18} />
                  </IconButton>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {activePuzzles.map((puzzle, i) => (
                    <IndexCard
                      key={puzzle.id}
                      puzzle={puzzle}
                      index={i}
                      to={`${base}/puzzles/${puzzle.id}`}
                      onDelete={() => setDeletingPuzzle(puzzle)}
                    />
                  ))}
                  <div className="add-slot flex min-h-[120px] flex-wrap items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-line-strong p-4">
                    <Button variant="primary" icon={<Plus size={18} />} onClick={() => setAddingFens(true)}>
                      FENs
                    </Button>
                    <Button variant="secondary" icon={<Download size={18} />} onClick={() => setQuickAddFor(active)}>
                      Quick add
                    </Button>
                    <Button variant="ghost" onClick={() => addPuzzle(active.id)}>
                      Blank position
                    </Button>
                  </div>
                </div>
                {activePuzzles.length === 0 && (
                  <p className="mt-3 text-[13px] text-ink-3">
                    Paste a Lichess or Chess.com link, a FEN, or several at once. Each becomes an index card here.
                  </p>
                )}
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="font-display text-[22px] font-semibold text-ink">Start with the positions</p>
                <p className="mx-auto mt-1 max-w-sm text-[14px] text-ink-2">
                  Paste the FENs and annotate them one by one. Sections ("Back rank", "Can I take it?") are optional: tap + Section above.
                </p>
                <Button variant="primary" className="mt-4" icon={<Plus size={18} />} onClick={() => setAddingFens(true)}>
                  FENs
                </Button>
              </div>
            )}
          </DividerPaper>
        </div>
      </FolderBody>

      <FenSheet
        open={addingFens}
        title="Add positions"
        submitLabel={(n) => (n === 0 ? 'Nothing to add' : `Add ${n} position${n === 1 ? '' : 's'}`)}
        onClose={() => setAddingFens(false)}
        onSubmit={addFens}
      />
      <PickSheet
        open={addingSection}
        title="Add sections"
        multi
        options={sectionOptions(history)}
        current={sections.map((s) => s.title)}
        placeholder="Or type a new theme…"
        onClose={() => setAddingSection(false)}
        onPick={async (titles) => {
          for (const title of titles) await content.createSection.mutateAsync(title)
        }}
      />
      <PickSheet
        open={pickingTheme}
        title="Theme block"
        options={themeOptions(history)}
        current={plan.theme ? [plan.theme] : []}
        placeholder="e.g. Endgames — October"
        emptyHint="A theme block is the multi-week topic this lesson belongs to. Type the first one; after that it's a tap."
        onClose={() => setPickingTheme(false)}
        onPick={([theme]) => planMutations.update.mutate({ id: plan.id, patch: { theme } })}
      />
      <ActionSheet
        open={planMenu}
        onClose={() => setPlanMenu(false)}
        title={`Lesson ${plan.number}`}
        items={[
          {
            label: 'Duplicate as next lesson',
            icon: <Plus />,
            onSelect: async () => {
              const copy = await planMutations.duplicate.mutateAsync({ planId: plan.id })
              navigate(`/students/${studentId}/lessons/${copy.id}`)
            },
          },
          ...(students.some((s) => s.id !== studentId)
            ? [{ label: 'Recycle for another student…', icon: <Recycle />, onSelect: () => setRecycling(true) }]
            : []),
          { label: 'Save shape as template', icon: <Document />, onSelect: () => setSavingTemplate(true) },
          ...(puzzleCount > 0
            ? [
                {
                  label: 'Copy links to all positions',
                  icon: <LinkIcon />,
                  onSelect: () =>
                    copyText(
                      sections
                        .flatMap((s) => puzzlesBySection[s.id] ?? [])
                        .map((p, i) => `${p.label || `#${i + 1}`} — ${puzzleLink(p.id)}`)
                        .join('\n'),
                    ),
                },
              ]
            : []),
          ...(plan.theme
            ? [{ label: 'Clear theme block', icon: <Trash />, onSelect: () => planMutations.update.mutate({ id: plan.id, patch: { theme: '' } }) }]
            : []),
        ]}
      />
      {/* Recycle: the whole lesson, positions and annotations included,
          becomes another student's next lesson. */}
      <ActionSheet
        open={recycling}
        onClose={() => setRecycling(false)}
        title={`Recycle Lesson ${plan.number} for…`}
        items={students
          .filter((s) => s.id !== studentId)
          .map((s) => ({
            label: s.name,
            icon: <Recycle />,
            onSelect: async () => {
              const copy = await planMutations.duplicate.mutateAsync({ planId: plan.id, studentId: s.id })
              navigate(`/students/${s.id}/lessons/${copy.id}`)
            },
          }))}
      />
      <InputModal
        open={savingTemplate}
        title="Save as template"
        label="Template name"
        placeholder="e.g. Tactics night"
        initialValue={plan.theme || plan.title}
        submitLabel="Save"
        onClose={() => setSavingTemplate(false)}
        onSubmit={async (name) => {
          await templates.create.mutateAsync({
            name,
            theme: plan.theme ?? '',
            sections: sections.map((s) => s.title),
            agenda: plan.agenda,
          })
        }}
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
        open={Boolean(quickAddSection)}
        mode="add"
        onClose={closeQuickAdd}
        onImport={async (position, { batch }) => {
          if (!quickAddSection) return
          const puzzle = await content.createPuzzle.mutateAsync({
            sectionId: quickAddSection.id,
            initial: patchFromImported(position),
          })
          // One at a time goes straight into the editor: the answer is set, the
          // explanation is what's left. A batch stays here to show the tally.
          if (!batch) navigate(`${base}/puzzles/${puzzle.id}/edit`)
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
  onCommit,
  ink,
  placeholderInk,
}: {
  value: string
  placeholder: string
  onCommit: (v: string) => void
  ink: string
  placeholderInk: string
}) {
  const [draft, setDraft] = useState(value)
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft.trim())}
      placeholder={placeholder}
      className="block min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-(--ph)"
      style={{ color: ink, '--ph': placeholderInk } as React.CSSProperties}

    />
  )
}

/**
 * The agenda is the coach's in-session checklist. Items live on the plan;
 * which ones are ticked is per device per session — a fresh lesson starts unticked.
 */
function Agenda({
  planId,
  items,
  options,
  onChange,
}: {
  planId: string
  items: string[]
  options: string[]
  onChange: (items: string[]) => void
}) {
  const { set: done, toggle } = useSessionSet(`agenda-${planId}`)
  const [adding, setAdding] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold tracking-[0.16em] text-sticky-ink/60 uppercase">Agenda</span>
        <button onClick={() => setAdding(true)} className="h-7 text-[13px] font-bold text-sticky-ink/80 underline decoration-sticky-ink/40 underline-offset-2">
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
                    'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition',
                    checked ? 'text-accent' : 'text-sticky-ink/40',
                  )}
                >
                  <span
                    className={clsx(
                      'grid h-6 w-6 place-items-center rounded-lg border-2',
                      checked ? 'border-accent bg-accent text-accent-ink' : 'border-sticky-ink/35',
                    )}
                  >
                    {checked && <Check size={15} />}
                  </span>
                </button>
                <span className={clsx('flex-1 text-[16px]', checked ? 'text-sticky-ink/50 line-through' : 'text-sticky-ink')}>{item}</span>
                <IconButton
                  label="Remove item"
                  className="h-9 w-9 text-sticky-ink/50"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                >
                  <Trash size={16} />
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}
      <PickSheet
        open={adding}
        title="Add to agenda"
        multi
        options={options}
        current={items}
        placeholder="Or type a new item…"
        onClose={() => setAdding(false)}
        onPick={(picked) => onChange([...items, ...picked.filter((p) => !items.includes(p))])}
      />
    </div>
  )
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
