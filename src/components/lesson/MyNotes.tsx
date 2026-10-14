import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Puzzle } from '../../types/domain'
import { NOTES_MIGRATION } from '../../lib/data'
import { useNotesMissing, usePuzzleMutations } from '../../lib/queries'
import { SectionLabel } from '../ui/Page'
import { MigrationNotice } from '../ui/MigrationNotice'
import notesSql from '../../../supabase/migrations/0013_coach_notes.sql?raw'

/** How long typing rests before it's saved. Leaving the box saves at once. */
const SAVE_AFTER_MS = 800

/**
 * The coach's own notes on a position, typed straight in: what they found
 * solving it by hand, other tries, traps, what to ask. Saved as they type.
 * Hidden with the answer while the eye is closed, so a later re-solve isn't
 * spoiled. Never shown in Present or Learn. Key it by the position's id.
 */
export function MyNotes({ puzzle, lessonPlanId, hidden }: { puzzle: Puzzle; lessonPlanId: string; hidden: boolean }) {
  const missing = useNotesMissing()
  const { update } = usePuzzleMutations(puzzle.id, lessonPlanId)
  const saved = puzzle.coach_notes ?? ''
  const [draft, setDraft] = useState(saved)
  // Notes saved elsewhere (another device, a refetch) come in, unless the
  // coach has typed since: their typing wins.
  const [seen, setSeen] = useState(saved)
  if (saved !== seen) {
    setSeen(saved)
    if (draft === seen) setDraft(saved)
  }

  const timer = useRef(0)
  const pending = useRef<string | null>(null)
  const [waiting, setWaiting] = useState(false)
  const save = useRef<(text: string) => void>(() => {})
  useEffect(() => {
    save.current = (text) => update.mutate({ coach_notes: text })
  })
  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    setWaiting(false)
    if (pending.current === null) return
    const text = pending.current
    pending.current = null
    save.current(text)
  }, [])
  // Leaving the position with typing still waiting saves it.
  useEffect(() => flush, [flush])

  const box = useRef<HTMLTextAreaElement>(null)
  // The box grows with what's in it.
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [draft, hidden])

  const status = waiting || update.isPending ? 'Saving…' : draft.trim() && draft === saved ? 'Saved' : ''

  return (
    <>
      <div className="flex items-center justify-between">
        <SectionLabel className="mb-0">My notes</SectionLabel>
        {!hidden && status && <span className="text-[12px] text-ink-3">{status}</span>}
      </div>
      {missing.data ? (
        <div className="mt-2">
          <MigrationNotice file={NOTES_MIGRATION} sql={notesSql} adds="your own notes on each position" onCheck={() => void missing.refetch()} />
        </div>
      ) : hidden ? (
        <p className="mt-1 text-[14px] text-ink-3">
          {draft.trim() ? 'Hidden with the answer.' : 'Open the eye, or solve it, to add what you find.'}
        </p>
      ) : (
        <textarea
          ref={box}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            pending.current = e.target.value
            setWaiting(true)
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(flush, SAVE_AFTER_MS)
          }}
          onBlur={flush}
          rows={3}
          placeholder="What you found solving it: other tries, traps, what to ask the student…"
          aria-label="My notes"
          className="mt-2 block w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[16px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-accent"
        />
      )}
    </>
  )
}
