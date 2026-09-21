import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import type { LessonPlan, LessonTemplate, NewLessonInit } from '../../types/domain'
import { useLesson, useLessonTemplateMutations, useLessonTemplates } from '../../lib/queries'
import { Modal } from '../ui/Modal'
import { IconButton } from '../ui/Button'
import { ChevronLeft, ChevronRight, Document, Plus, Trash } from '../ui/Icons'

interface NewLessonSheetProps {
  open: boolean
  /** Newest first, as the list page has them. */
  plans: LessonPlan[]
  onClose: () => void
  onCreate: (init: NewLessonInit) => Promise<void>
  onDuplicate: (planId: string) => Promise<void>
}

/**
 * "New lesson" is a choice, not a form: the same shape as last time, a saved
 * template, a copy of any earlier lesson, or blank. Every row is one tap.
 */
export function NewLessonSheet({ open, plans, onClose, onCreate, onDuplicate }: NewLessonSheetProps) {
  const [stage, setStage] = useState<'start' | 'copy'>('start')
  const [busy, setBusy] = useState(false)
  const last = plans[0]
  const { data: lastBundle } = useLesson(open ? last?.id : undefined)
  const { data: templates } = useLessonTemplates()
  const templateMutations = useLessonTemplateMutations()

  function close() {
    setStage('start')
    onClose()
  }

  async function run(work: () => Promise<void>) {
    setBusy(true)
    try {
      await work()
      close()
    } finally {
      setBusy(false)
    }
  }

  const lastSections = lastBundle?.sections.map((s) => s.title) ?? []

  return (
    <Modal open={open} onClose={close} title={stage === 'start' ? 'New lesson' : 'Copy which lesson?'}>
      {stage === 'start' ? (
        <div className="-mx-2 flex flex-col gap-1">
          {last && (
            <Row
              disabled={busy || !lastBundle}
              icon={<Plus size={20} />}
              title={`Same shape as Lesson ${last.number}`}
              subtitle={describe(lastSections, last.agenda, last.theme)}
              primary
              onClick={() =>
                run(() =>
                  onCreate({
                    theme: last.theme,
                    agenda: last.agenda,
                    sections: lastSections,
                  }),
                )
              }
            />
          )}

          {templates && templates.length > 0 && (
            <>
              <p className="mt-2 mb-1 px-3 text-[12px] font-semibold tracking-wider text-ink-3 uppercase">Templates</p>
              {templates.map((t) => (
                <Row
                  key={t.id}
                  disabled={busy}
                  icon={<Document size={20} />}
                  title={t.name}
                  subtitle={describe(t.sections, t.agenda, t.theme === t.name ? '' : t.theme)}
                  onClick={() => run(() => onCreate(fromTemplate(t)))}
                  trailing={
                    <IconButton
                      label={`Delete template ${t.name}`}
                      className="h-9 w-9 text-ink-3"
                      onClick={(e) => {
                        e.stopPropagation()
                        templateMutations.remove.mutate(t.id)
                      }}
                    >
                      <Trash size={16} />
                    </IconButton>
                  }
                />
              ))}
            </>
          )}

          <p className="mt-2 mb-1 px-3 text-[12px] font-semibold tracking-wider text-ink-3 uppercase">Or</p>
          {plans.length > 0 && (
            <Row
              disabled={busy}
              icon={<ChevronRight size={20} />}
              title="Copy a lesson, positions included"
              subtitle="Re-run an earlier lesson as the next one"
              onClick={() => setStage('copy')}
            />
          )}
          <Row
            disabled={busy}
            icon={<Plus size={20} />}
            title="Blank lesson"
            subtitle="Just the next number"
            onClick={() => run(() => onCreate({}))}
          />
        </div>
      ) : (
        <div className="-mx-2 flex flex-col gap-1">
          <button
            onClick={() => setStage('start')}
            className="mb-1 flex h-10 items-center gap-1 px-3 text-[14px] font-semibold text-accent"
          >
            <ChevronLeft size={16} /> Back
          </button>
          {plans.map((p) => (
            <Row
              key={p.id}
              disabled={busy}
              icon={<span className="text-[15px] font-bold tabular-nums">{p.number}</span>}
              title={p.title || `Lesson ${p.number}`}
              subtitle={[p.theme, p.title ? `Lesson ${p.number}` : ''].filter(Boolean).join(' · ') || undefined}
              onClick={() => run(() => onDuplicate(p.id))}
            />
          ))}
        </div>
      )}
    </Modal>
  )
}

function fromTemplate(t: LessonTemplate): NewLessonInit {
  return { theme: t.theme, agenda: t.agenda, sections: t.sections }
}

function describe(sections: string[], agenda: string[], theme?: string): string | undefined {
  const parts: string[] = []
  if (sections.length) parts.push(sections.join(' · '))
  if (agenda.length) parts.push(`${agenda.length} agenda item${agenda.length === 1 ? '' : 's'}`)
  if (theme) parts.unshift(theme)
  return parts.length ? parts.join(' — ') : 'No sections yet'
}

function Row({
  icon,
  title,
  subtitle,
  trailing,
  primary,
  disabled,
  onClick,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  trailing?: ReactNode
  primary?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <div className="flex items-center">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={clsx(
          'flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left transition active:bg-surface-2 disabled:opacity-50',
          primary && 'bg-accent-soft',
        )}
      >
        <span
          className={clsx(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
            primary ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2',
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold text-ink">{title}</span>
          {subtitle && <span className="block truncate text-[13px] text-ink-2">{subtitle}</span>}
        </span>
      </button>
      {trailing}
    </div>
  )
}
