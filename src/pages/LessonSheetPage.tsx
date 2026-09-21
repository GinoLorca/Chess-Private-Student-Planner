import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import type { Puzzle } from '../types/domain'
import { useLesson, useStudent } from '../lib/queries'
import { normalizeFen } from '../lib/fen'
import { Board } from '../components/board/Board'
import { effectiveQuizPrompt } from '../lib/prompts'
import { Button } from '../components/ui/Button'
import { LoadingPage, Page } from '../components/ui/Page'
import { Document } from '../components/ui/Icons'

/**
 * The whole lesson as one scrollable sheet, in the format the coach's old
 * hand-made docs used: theme heading, "#1 — Kg7 [Kg7, Rd8, Kf7]", the
 * explanation, then the annotated board beside the quiz prompt. Print it
 * (Share → Print on an iPad) for a PDF — no screenshots involved.
 */
export function LessonSheetPage() {
  const { studentId = '', lessonPlanId = '' } = useParams()
  const { data: student } = useStudent(studentId)
  const { data: lesson, isLoading } = useLesson(lessonPlanId)
  const base = `/students/${studentId}/lessons/${lessonPlanId}`
  const date = useMemo(() => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), [])

  if (isLoading && !lesson) return <LoadingPage />
  if (!lesson) return <Page back={base}>Lesson not found.</Page>

  // Positions are numbered straight through the lesson, across sections.
  const numbers = new Map<string, number>()
  lesson.sections.forEach((section) =>
    (lesson.puzzlesBySection[section.id] ?? []).forEach((p) => numbers.set(p.id, numbers.size + 1)),
  )

  return (
    <Page
      back={base}
      width="wide"
      className="sheet"
      actions={
        <Button variant="primary" size="sm" icon={<Document size={16} />} onClick={() => window.print()} className="print:hidden">
          Print / Save PDF
        </Button>
      }
    >
      <header className="mb-8 border-b border-line pb-4">
        <p className="text-[13px] font-semibold tracking-wider text-ink-3 uppercase">{student?.name}</p>
        <h1 className="mt-1 text-[30px] leading-tight font-bold tracking-tight text-ink">
          Lesson {lesson.plan.number}
          {lesson.plan.title && <span className="font-medium text-ink-2"> — {lesson.plan.title}</span>}
        </h1>
        <p className="mt-1 text-[14px] text-ink-3">
          {[lesson.plan.theme, date].filter(Boolean).join(' · ')}
        </p>
      </header>

      {lesson.sections.map((section) => {
        const puzzles = lesson.puzzlesBySection[section.id] ?? []
        if (puzzles.length === 0) return null
        return (
          <section key={section.id} className="mb-10">
            <h2 className="mb-5 inline-block border-b-[3px] border-accent pb-0.5 text-[22px] leading-snug font-bold text-ink">
              {section.title || 'Untitled section'}
            </h2>
            <div className="space-y-8">
              {puzzles.map((puzzle) => (
                <SheetPuzzle key={puzzle.id} puzzle={puzzle} number={numbers.get(puzzle.id) ?? 0} sectionTitle={section.title} />
              ))}
            </div>
          </section>
        )
      })}
    </Page>
  )
}

function SheetPuzzle({ puzzle, number, sectionTitle }: { puzzle: Puzzle; number: number; sectionTitle: string }) {
  const fen = normalizeFen(puzzle.starting_fen, puzzle.side_to_move)
  const toMove = puzzle.side_to_move === 'w' ? 'White' : 'Black'
  const line = puzzle.solution.map((m) => m.san).join(', ')

  return (
    <article className="break-inside-avoid">
      <p className="text-[18px] text-ink">
        <span className="text-ink-3">#{number} — </span>
        <span className="font-bold">{puzzle.label || puzzle.solution[0]?.san || 'Position'}</span>
        {line && <span className="text-ink-2"> [{line}]</span>}
      </p>
      {puzzle.summary && (
        <p className="mt-1.5 max-w-3xl text-[16px] leading-relaxed whitespace-pre-wrap text-ink">{puzzle.summary}</p>
      )}
      <div className="mt-3 grid max-w-3xl grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <div className="p-2">
          <Board
            fen={fen}
            arrows={puzzle.arrows}
            highlights={puzzle.highlights}
            orientation={puzzle.side_to_move === 'b' ? 'black' : 'white'}
            className="rounded-md shadow-none"
          />
        </div>
        <div className="flex flex-col border-l border-line">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[13px] font-semibold text-ink">{sectionTitle}</p>
          </div>
          <div className="flex-1 px-4 py-3">
            <p className="text-[15px] leading-snug text-ink">{effectiveQuizPrompt(puzzle, sectionTitle)}</p>
          </div>
          <div className="border-t border-line px-4 py-3">
            <p className="text-[13px] font-semibold text-ink-2">Quiz</p>
            <p className="text-[15px] font-medium text-ink">{toMove} to play!</p>
          </div>
        </div>
      </div>
      {puzzle.solution.some((m) => m.comment) && (
        <ul className="mt-2 max-w-3xl space-y-0.5 text-[14px] text-ink-2">
          {puzzle.solution
            .filter((m) => m.comment)
            .map((m, i) => (
              <li key={i}>
                <span className="font-mono font-semibold text-ink">{m.san}</span> — {m.comment}
              </li>
            ))}
        </ul>
      )}
    </article>
  )
}
