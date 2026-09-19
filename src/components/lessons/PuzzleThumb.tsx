import { DisplayBoard } from '../puzzle/DisplayBoard'

export function PuzzleThumb({ fen }: { fen: string }) {
  return (
    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md ring-1 ring-ink-700">
      <DisplayBoard fen={fen} showNotation={false} />
    </div>
  )
}
