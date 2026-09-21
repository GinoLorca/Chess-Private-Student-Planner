import type { Puzzle } from '../types/domain'

const sideName = (side: 'w' | 'b') => (side === 'w' ? 'White' : 'Black')
const otherName = (side: 'w' | 'b') => (side === 'w' ? 'Black' : 'White')

/**
 * The question the coach asks at the board, worked out from the section's
 * theme and who is to move, so a blank quiz prompt still reads right. Matching
 * is loose (a section called "Defend & Protect II" still counts).
 */
export function defaultQuizPrompt(sectionTitle: string | undefined, side: 'w' | 'b'): string {
  const t = (sectionTitle ?? '').toLowerCase()
  const s = sideName(side)
  const o = otherName(side)
  if (/defen|protect/.test(t)) return `${s} to move. What's under attack, and how do you defend it?`
  if (/weakness|target/.test(t)) return `${s} to move. Where is ${o} weak, and how do you go after it?`
  if (/take it|capture|free/.test(t)) return `${s} to move. Can you take it? Count the attackers and defenders.`
  if (/mate|back rank/.test(t)) return `${s} to move. Find the checkmate.`
  if (/endgame|technique/.test(t)) return `${s} to move. What's the plan to convert?`
  if (/opening/.test(t)) return `${s} to move. What does the opening call for here?`
  if (/game review/.test(t)) return `${s} to move. What happened here, and what was better?`
  return `${s} to move. What's the best move?`
}

/** Tap-to-set alternatives, most general first. Side-aware. */
export function quizPromptChips(side: 'w' | 'b'): string[] {
  const s = sideName(side)
  const o = otherName(side)
  return [
    `${s} to move. What's the best move?`,
    `${s} to move. What is ${o} threatening?`,
    `${s} to move. Find the checkmate.`,
    `${s} to move. Can you take it?`,
    `${s} to move. Which piece is undefended?`,
    `${s} to move. Is castling safe here?`,
    `Is ${s}'s last move a mistake? Punish it.`,
    `Compare two candidate moves. Which is better, and why?`,
  ]
}

/** What the student is actually asked: the saved prompt, or the smart default. */
export function effectiveQuizPrompt(puzzle: Pick<Puzzle, 'quiz_prompt' | 'side_to_move'>, sectionTitle?: string): string {
  return puzzle.quiz_prompt.trim() || defaultQuizPrompt(sectionTitle, puzzle.side_to_move)
}

/**
 * Sentence starters for the explanation, in the coach's own register. `{move}`
 * becomes the first answer move when one is recorded.
 */
export function explanationStarters(sectionTitle: string | undefined, firstMove: string | undefined): string[] {
  const t = (sectionTitle ?? '').toLowerCase()
  const m = firstMove ?? '…'
  const themed: string[] = []
  if (/defen|protect/.test(t)) {
    themed.push(`${m} protects the piece and keeps everything defended.`, 'Any other move loses material.')
  }
  if (/weakness|target/.test(t)) {
    themed.push(`${m} attacks the weak square.`, 'The weakness is the undefended piece; the plan is to attack it twice.')
  }
  if (/take it|capture/.test(t)) {
    themed.push('Count the attackers and defenders before taking.', `Taking is safe: ${m} wins material cleanly.`, 'Taking loses: the piece is defended one more time than it is attacked.')
  }
  if (/mate|back rank/.test(t)) {
    themed.push(`${m} is checkmate: the king has no squares.`, 'The back rank is weak because the pawns block the king.')
  }
  const general = [
    `${m} is the only move.`,
    `${m} wins material.`,
    'The natural move fails because …',
    `After ${m} the threat is …`,
    'Ask the student what the opponent wants first.',
  ]
  return [...themed, ...general]
}
