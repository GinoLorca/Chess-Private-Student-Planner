import { Link, useParams } from 'react-router-dom'
import { useLesson, usePuzzle, useStudent } from '../lib/queries'
import { normalizeFen } from '../lib/fen'
import { Page, Card, LoadingPage, SectionLabel } from '../components/ui/Page'
import { Button } from '../components/ui/Button'
import { Board } from '../components/board/Board'
import { Pencil, Play } from '../components/ui/Icons'

/**
 * The read view of one position: what the coach glances at right before a
 * lesson. Everything is visible at once — no reveal step — because this is
 * for the coach's eyes, not the student's.
 */
export function PuzzlePage() {
  const { studentId = '', lessonPlanId = '', puzzleId = '' } = useParams()
  const { data: student } = useStudent(studentId)
  const { data: lesson } = useLesson(lessonPlanId)
  const { data: puzzle, isLoading } = usePuzzle(puzzleId)

  if (isLoading && !puzzle) return <LoadingPage />
  const base = `/students/${studentId}/lessons/${lessonPlanId}`
  if (!puzzle) return <Page back={base}>Position not found.</Page>

  const section = lesson?.sections.find((s) => s.id === puzzle.section_id)
  const fen = normalizeFen(puzzle.starting_fen, puzzle.side_to_move)
  const toMove = puzzle.side_to_move === 'w' ? 'White' : 'Black'

  return (
    <Page
      back={base}
      eyebrow={[student?.name, lesson ? `Lesson ${lesson.plan.number}` : null, section?.title].filter(Boolean).join(' · ')}
      width="wide"
      actions={
        <>
          <Link to={`${base}/coach?p=${puzzle.id}`}>
            <Button variant="ghost" size="sm" icon={<Play size={16} />}>
              Coach view
            </Button>
          </Link>
          <Link to={`${base}/puzzles/${puzzle.id}/edit`}>
            <Button variant="primary" size="sm" icon={<Pencil size={16} />}>
              Edit
            </Button>
          </Link>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div className="mx-auto w-full max-w-[560px]">
          <div className="mb-2 flex items-baseline justify-between">
            <h1 className="text-[26px] font-bold tracking-tight text-ink">{puzzle.label || 'Untitled position'}</h1>
            <span className="text-[14px] font-semibold text-ink-2">{toMove} to play</span>
          </div>
          <Board fen={fen} arrows={puzzle.arrows} highlights={puzzle.highlights} orientation={puzzle.side_to_move === 'b' ? 'black' : 'white'} />
        </div>

        <div className="space-y-4">
          {puzzle.quiz_prompt && (
            <Card className="p-4">
              <SectionLabel>Quiz prompt</SectionLabel>
              <p className="text-[17px] leading-snug font-medium text-ink">{puzzle.quiz_prompt}</p>
            </Card>
          )}

          <Card className="p-4">
            <SectionLabel>Answer</SectionLabel>
            {puzzle.solution.length === 0 ? (
              <p className="text-[15px] text-ink-3">No solution recorded yet.</p>
            ) : (
              <ol className="space-y-1.5">
                {puzzle.solution.map((move, i) => (
                  <li key={i} className="flex items-baseline gap-3">
                    <span className="w-6 shrink-0 text-right font-mono text-[13px] text-ink-3 tabular-nums">{i + 1}.</span>
                    <span className="font-mono text-[17px] font-semibold text-ink">{move.san}</span>
                    {move.comment && <span className="text-[14px] text-ink-2">{move.comment}</span>}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {puzzle.summary && (
            <Card className="p-4">
              <SectionLabel>Explanation</SectionLabel>
              <p className="text-[16px] leading-relaxed whitespace-pre-wrap text-ink">{puzzle.summary}</p>
            </Card>
          )}

          {puzzle.reference_url && (
            <a
              href={puzzle.reference_url}
              target="_blank"
              rel="noreferrer"
              className="block text-[14px] font-medium text-accent underline-offset-2 hover:underline"
            >
              {puzzle.reference_label || puzzle.reference_url} ↗
            </a>
          )}
        </div>
      </div>
    </Page>
  )
}
