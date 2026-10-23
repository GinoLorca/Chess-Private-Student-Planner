import { isDemo, supabase } from './supabase'
import type { SolutionMove } from '../types/domain'
import { positionOnlyLocal } from './teach'

export interface BoardReading {
  placement: string
  side_to_move: 'w' | 'b' | 'unknown'
  board_orientation: 'white' | 'black'
  confidence: number
  notes: string
  /** Set when the reading failed a sanity check (rank lengths, king count). */
  problem: string | null
}

const FUNCTION = 'chess-ai'

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FUNCTION, { body })
  if (error) {
    // The function returns a readable message in its JSON body on every failure.
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const parsed = (await ctx.json()) as { error?: string }
        if (parsed.error) throw new Error(parsed.error)
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e
      }
    }
    throw new Error(error.message || 'The AI helper is not reachable. Is the chess-ai function deployed?')
  }
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error)
  }
  return data as T
}

/**
 * Shrink a photo before upload: a board is perfectly legible at 1200px and a
 * 12-megapixel iPad photo would cost real money in tokens for nothing.
 */
export async function imageToBase64(file: File, maxSide = 1200): Promise<{ data: string; mediaType: string }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error(`Couldn't read ${file.name}`))
      el.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    return { data: dataUrl.split(',')[1], mediaType: 'image/jpeg' }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function readBoardImage(file: File): Promise<BoardReading> {
  if (isDemo) {
    await new Promise((r) => setTimeout(r, 900))
    return {
      placement: 'r4rk1/pp1n1ppp/2pbpn2/q2p4/2PP4/1PN1PN2/PBQ2PPP/R3KB1R',
      side_to_move: 'w',
      board_orientation: 'white',
      confidence: 0.94,
      notes: 'Demo mode: this is a sample reading, not your image.',
      problem: null,
    }
  }
  const { data, mediaType } = await imageToBase64(file)
  return invoke<BoardReading>({ action: 'read_board', image: data, media_type: mediaType })
}

/**
 * A position's wording rewritten to talk about the position and no person,
 * for copying a student's position into Teach. Demo mode, or an AI helper
 * that can't be reached, falls back to the rougher rewrite worked out on this
 * device; `by` says which, so the review can say how much to check.
 */
export async function rewritePositionOnly(
  fen: string,
  solution: SolutionMove[],
  texts: { key: string; text: string }[],
  names: string[],
): Promise<{ texts: Record<string, string>; by: 'ai' | 'device'; problem?: string }> {
  const sideToMove = fen.split(' ')[1] === 'b' ? 'b' : 'w'
  const local = () => Object.fromEntries(texts.map((t) => [t.key, positionOnlyLocal(t.text, sideToMove, names)]))
  if (texts.length === 0) return { texts: {}, by: 'device' }
  if (isDemo) {
    await new Promise((r) => setTimeout(r, 600))
    return { texts: local(), by: 'device', problem: 'Demo mode: rewritten on this device, not by the AI helper.' }
  }
  try {
    const result = await invoke<{ texts: { key: string; text: string }[] }>({
      action: 'position_only',
      fen,
      solution: solution.map((m) => m.san),
      texts,
      names,
    })
    const byKey = Object.fromEntries(result.texts.map((t) => [t.key, t.text]))
    // Anything the helper left out keeps the device's rewrite.
    const fallback = local()
    return { texts: Object.fromEntries(texts.map((t) => [t.key, byKey[t.key] ?? fallback[t.key]])), by: 'ai' }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const problem = /Unknown action/.test(message)
      ? 'The AI helper predates Teach: redeploy it once (supabase functions deploy chess-ai, see DEPLOY.md) for a cleaner rewrite.'
      : message
    return { texts: local(), by: 'device', problem }
  }
}

export async function draftExplanation(fen: string, solution: SolutionMove[], quizPrompt?: string): Promise<string> {
  if (isDemo) {
    await new Promise((r) => setTimeout(r, 900))
    return `Demo draft: ${solution[0]?.san ?? 'the answer'} is the only move that holds everything together — check what happens to the loose piece after the natural-looking alternative, and you'll see why the quiet move comes first.`
  }
  const result = await invoke<{ text: string }>({
    action: 'draft_explanation',
    fen,
    solution: solution.map((m) => m.san),
    quiz_prompt: quizPrompt || undefined,
  })
  return result.text
}
