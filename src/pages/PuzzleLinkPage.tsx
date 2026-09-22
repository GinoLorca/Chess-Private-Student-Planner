import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { locatePuzzle } from '../lib/data'
import { LoadingPage, Page } from '../components/ui/Page'

/**
 * The short link: /p/<positionId>. Looks the position up and opens it in
 * Present mode, so a link pasted into another planner keeps working even
 * if the position is later moved to a different lesson.
 */
export function PuzzleLinkPage() {
  const { puzzleId = '' } = useParams()
  const navigate = useNavigate()
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    locatePuzzle(puzzleId)
      .then((where) => {
        if (cancelled) return
        if (!where) setMissing(true)
        else navigate(`/students/${where.studentId}/lessons/${where.lessonPlanId}/present?p=${puzzleId}`, { replace: true })
      })
      .catch(() => !cancelled && setMissing(true))
    return () => {
      cancelled = true
    }
  }, [puzzleId, navigate])

  if (!missing) return <LoadingPage />
  return (
    <Page back="/" title="Position not found">
      <p className="text-[15px] text-on-bg-2">This link points at a position that no longer exists, or belongs to another account.</p>
      <Link to="/library" className="mt-4 inline-block text-[15px] font-semibold text-accent-on-bg">
        Browse the library ›
      </Link>
    </Page>
  )
}
