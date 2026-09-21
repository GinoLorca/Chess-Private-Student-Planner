// Supabase Edge Function: the app's two AI helpers, behind the coach's login.
//
//   read_board        — a photo/screenshot of a chessboard -> FEN placement + side to move
//   draft_explanation — a position + answer line -> a short coaching explanation draft
//
// Deploy:  supabase functions deploy chess-ai
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// The function only runs for signed-in users (Supabase verifies the JWT before
// invoking it), so the API key never leaves the server and nobody else can spend it.

import Anthropic from 'npm:@anthropic-ai/sdk@0.90.0'
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@0.90.0/helpers/zod'
import { z } from 'npm:zod@3.24.1'

const MODEL = 'claude-opus-5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BoardReading = z.object({
  placement: z
    .string()
    .describe('FEN piece placement only, rank 8 first, e.g. r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R'),
  side_to_move: z.enum(['w', 'b', 'unknown']).describe('From any "White/Black to play" text or a highlighted last move; otherwise unknown'),
  board_orientation: z.enum(['white', 'black']).describe('Which colour is at the bottom of the image'),
  confidence: z.number().min(0).max(1).describe('How sure you are the placement is exactly right'),
  notes: z.string().describe('Anything uncertain: unreadable squares, guessed orientation, cropped edges'),
})

type BoardReading = z.infer<typeof BoardReading>

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Catch the obvious misreads before the coach sees them: 8 ranks of 8, exactly one king each. */
function validatePlacement(placement: string): string | null {
  const ranks = placement.trim().split('/')
  if (ranks.length !== 8) return 'The reading did not have 8 ranks.'
  let wk = 0
  let bk = 0
  for (const rank of ranks) {
    let files = 0
    for (const ch of rank) {
      if (/[1-8]/.test(ch)) files += Number(ch)
      else if (/[prnbqkPRNBQK]/.test(ch)) {
        files += 1
        if (ch === 'K') wk++
        if (ch === 'k') bk++
      } else return `Unexpected character "${ch}" in the reading.`
    }
    if (files !== 8) return 'A rank did not add up to 8 squares.'
  }
  if (wk !== 1 || bk !== 1) return `Expected one king per side, found ${wk} white and ${bk} black.`
  return null
}

async function readBoard(client: Anthropic, image: string, mediaType: string) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'high', format: zodOutputFormat(BoardReading) },
    system:
      'You read chess positions out of photos and screenshots for a chess coach. ' +
      'Work square by square. First decide the board orientation from any visible coordinates (file letters a-h, rank numbers 1-8); ' +
      'if none are visible, assume White is at the bottom and say so in notes. Then transcribe every piece into a FEN placement ' +
      '(rank 8 first, files a to h, digits for empty runs). Uppercase is White, lowercase is Black. ' +
      'Count carefully: each rank must total exactly 8 squares. Use side_to_move only when the image says who is to play; otherwise "unknown". ' +
      'Never invent pieces on squares you cannot see — mention them in notes instead.',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/webp', data: image } },
          { type: 'text', text: 'Read this chess position.' },
        ],
      },
    ],
  })

  if (response.stop_reason === 'refusal') throw new Error('The model declined to read this image.')
  const reading = response.parsed_output as BoardReading | null
  if (!reading) throw new Error('Could not parse a position from the image.')
  const problem = validatePlacement(reading.placement)
  return { ...reading, problem, usage: response.usage }
}

async function draftExplanation(
  client: Anthropic,
  fen: string,
  solution: string[],
  quizPrompt: string | undefined,
  style: string | undefined,
) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: 'medium' },
    system:
      'You write the short explanation a chess coach keeps next to a puzzle so he can teach it again months later without re-solving it. ' +
      'Plain, spoken language, addressed to the coach, 2–5 sentences. Say what the answer does and why the tempting alternatives fail, ' +
      'naming concrete squares and pieces. No headings, no bullet points, no preamble. ' +
      (style ? `Match this voice: ${style}` : ''),
    messages: [
      {
        role: 'user',
        content:
          `Position (FEN): ${fen}\n` +
          `Answer line: ${solution.join(' ')}\n` +
          (quizPrompt ? `Quiz prompt shown to the student: ${quizPrompt}\n` : '') +
          'Write the explanation.',
      },
    ],
  })
  if (response.stop_reason === 'refusal') throw new Error('The model declined this request.')
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
  return { text, usage: response.usage }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return json({ error: 'ANTHROPIC_API_KEY is not set on this Supabase project. See README → AI helpers.' }, 503)
  }
  const client = new Anthropic({ apiKey })

  try {
    const body = await req.json()
    switch (body.action) {
      case 'read_board': {
        if (typeof body.image !== 'string' || !body.image) return json({ error: 'image (base64) is required' }, 400)
        const mediaType = typeof body.media_type === 'string' ? body.media_type : 'image/png'
        return json(await readBoard(client, body.image, mediaType))
      }
      case 'draft_explanation': {
        if (typeof body.fen !== 'string' || !Array.isArray(body.solution)) return json({ error: 'fen and solution are required' }, 400)
        return json(await draftExplanation(client, body.fen, body.solution.map(String), body.quiz_prompt, body.style))
      }
      default:
        return json({ error: `Unknown action "${body.action}"` }, 400)
    }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'The Anthropic API key was rejected.' }, 502)
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Anthropic is rate-limiting requests; try again in a moment.' }, 429)
    if (e instanceof Anthropic.APIError) return json({ error: `Anthropic error ${e.status}: ${e.message}` }, 502)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
