import { Chess } from 'chess.js'

/**
 * The agent connector, independent of transport and storage: MCP framing
 * (JSON-RPC over HTTP, stateless), the four tools, and the position checks.
 * `Db` is whatever stores lessons; see supabaseDb.ts for the real one.
 */

export interface StudentRow {
  id: string
  name: string
}

export interface LessonRow {
  id: string
  number: number
  title: string
  status: string
  total: number
  done: number
}

export interface PuzzleRow {
  sort_order: number
  label: string
  starting_fen: string
  side_to_move: 'w' | 'b'
  arrows: never[]
  highlights: never[]
  quiz_prompt: string
  summary: string
  solution: { san: string; fen: string }[]
  reference_url: string | null
  reference_label: string | null
  source: { kind: 'fen'; url?: string }
  themes: string[]
  done: boolean
}

export interface Db {
  listStudents(): Promise<StudentRow[]>
  listLessons(studentId: string): Promise<LessonRow[]>
  /** A new lesson, numbered next, with one "Positions" section; returns the section to fill. */
  createLesson(studentId: string, title: string): Promise<{ id: string; number: number; sectionId: string }>
  /** The section new positions go into (the last one, or a new "Positions"), and the next sort order. */
  targetSection(lessonId: string): Promise<{ studentId: string; number: number; sectionId: string; nextOrder: number }>
  insertPuzzles(sectionId: string, rows: PuzzleRow[]): Promise<void>
}

export interface PositionInput {
  fen: string
  source_url?: string
  label?: string
  question?: string
  note?: string
  /** The answer as moves in SAN, e.g. "Rf8 Bxh4 b4" (move numbers are ignored). */
  answer?: string
}

const POSITION_SCHEMA = {
  type: 'object',
  required: ['fen'],
  properties: {
    fen: {
      type: 'string',
      description: 'The position. The placement alone is fine; White to move is assumed unless the FEN says otherwise.',
    },
    source_url: { type: 'string', description: 'Where it came from (a Lichess study, an article...). Shown as the source link.' },
    label: { type: 'string', description: 'Short name, e.g. the key move. Defaults to the first answer move.' },
    question: { type: 'string', description: 'What to ask the student. Blank uses the default prompt.' },
    note: { type: 'string', description: "The coach's explanation, in the words used at the board." },
    answer: {
      type: 'string',
      description: 'The answer line as SAN moves separated by spaces, e.g. "Rf8 Bxh4 b4". Validated against the position.',
    },
  },
} as const

export const TOOLS = [
  {
    name: 'list_students',
    description: 'The students in the planner, with their ids.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_lessons',
    description: "A student's lesson plans, newest first, with how many positions each has and how many are annotated.",
    inputSchema: { type: 'object', required: ['student_id'], properties: { student_id: { type: 'string' } } },
  },
  {
    name: 'create_lesson',
    description:
      'Create the next lesson for a student from a list of positions (FENs). Returns the lesson id and the link to open it in the app; anything left blank is finished by the coach in the annotation workbench.',
    inputSchema: {
      type: 'object',
      required: ['student_id', 'positions'],
      properties: {
        student_id: { type: 'string' },
        title: { type: 'string', description: 'Optional lesson title.' },
        positions: { type: 'array', minItems: 1, items: POSITION_SCHEMA },
      },
    },
  },
  {
    name: 'add_positions',
    description: 'Append positions to an existing lesson.',
    inputSchema: {
      type: 'object',
      required: ['lesson_id', 'positions'],
      properties: { lesson_id: { type: 'string' }, positions: { type: 'array', minItems: 1, items: POSITION_SCHEMA } },
    },
  },
] as const

export class ToolError extends Error {}

/** Fill in the missing FEN fields and make sure chess.js accepts the result. */
export function normalizeFen(raw: string): string {
  const parts = raw.trim().split(/\s+/)
  if (parts.length < 1 || !parts[0].includes('/')) throw new ToolError(`Not a FEN: "${raw}"`)
  const [placement, turn = 'w', castling = '-', ep = '-', half = '0', full = '1'] = parts
  if (turn !== 'w' && turn !== 'b') throw new ToolError(`Side to move must be w or b in "${raw}"`)
  const fen = [placement, turn, castling, ep, half, full].join(' ')
  try {
    new Chess(fen)
  } catch (e) {
    throw new ToolError(`Invalid FEN "${raw}": ${e instanceof Error ? e.message : String(e)}`)
  }
  return fen
}

/** Replay SAN moves from a position; move numbers and result markers are ignored. */
export function replayAnswer(fen: string, answer: string): { san: string; fen: string }[] {
  const chess = new Chess(fen)
  const tokens = answer
    .trim()
    .split(/\s+/)
    .filter((t) => t && !/^\d+\.+$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t))
    .map((t) => t.replace(/^\d+\.+/, ''))
  return tokens.map((san) => {
    try {
      const move = chess.move(san)
      return { san: move.san, fen: chess.fen() }
    } catch {
      throw new ToolError(`Illegal move "${san}" in answer "${answer}" from ${fen}`)
    }
  })
}

export function toRow(p: PositionInput, order: number): PuzzleRow {
  if (!p || typeof p.fen !== 'string') throw new ToolError(`Position ${order + 1} needs a fen`)
  const fen = normalizeFen(p.fen)
  const solution = p.answer?.trim() ? replayAnswer(fen, p.answer) : []
  const url = p.source_url?.trim() || null
  return {
    sort_order: order,
    label: p.label?.trim() || solution[0]?.san || `#${order + 1}`,
    starting_fen: fen,
    side_to_move: fen.split(' ')[1] as 'w' | 'b',
    arrows: [],
    highlights: [],
    quiz_prompt: p.question?.trim() ?? '',
    summary: p.note?.trim() ?? '',
    solution,
    reference_url: url,
    reference_label: url ? hostOf(url) : null,
    source: url ? { kind: 'fen', url } : { kind: 'fen' },
    themes: [],
    done: false,
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Where the app lives, for the links the tools hand back. */
export interface ToolContext {
  db: Db
  appOrigin: string
}

export async function callTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const { db, appOrigin } = ctx
  const lessonUrl = (studentId: string, lessonId: string) => `${appOrigin}/#/students/${studentId}/lessons/${lessonId}`
  switch (name) {
    case 'list_students':
      return { students: await db.listStudents() }
    case 'list_lessons': {
      const studentId = str(args.student_id, 'student_id')
      const lessons = await db.listLessons(studentId)
      return { lessons: lessons.map((l) => ({ ...l, url: lessonUrl(studentId, l.id) })) }
    }
    case 'create_lesson': {
      const studentId = str(args.student_id, 'student_id')
      const rows = positions(args.positions).map((p, i) => toRow(p, i))
      const lesson = await db.createLesson(studentId, typeof args.title === 'string' ? args.title : '')
      await db.insertPuzzles(lesson.sectionId, rows)
      return {
        lesson_id: lesson.id,
        number: lesson.number,
        positions_added: rows.length,
        url: lessonUrl(studentId, lesson.id),
        annotate_url: `${lessonUrl(studentId, lesson.id)}/annotate`,
      }
    }
    case 'add_positions': {
      const lessonId = str(args.lesson_id, 'lesson_id')
      const input = positions(args.positions)
      const target = await db.targetSection(lessonId)
      const rows = input.map((p, i) => toRow(p, target.nextOrder + i))
      await db.insertPuzzles(target.sectionId, rows)
      return {
        lesson_id: lessonId,
        number: target.number,
        positions_added: rows.length,
        url: lessonUrl(target.studentId, lessonId),
        annotate_url: `${lessonUrl(target.studentId, lessonId)}/annotate`,
      }
    }
    default:
      throw new ToolError(`Unknown tool "${name}"`)
  }
}

function str(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new ToolError(`${field} is required`)
  return v.trim()
}

function positions(v: unknown): PositionInput[] {
  if (!Array.isArray(v) || v.length === 0) throw new ToolError('positions must be a non-empty array')
  return v as PositionInput[]
}

// ---------------------------------------------------------------------------
// MCP over HTTP: JSON-RPC 2.0, stateless (no sessions, no SSE).
// ---------------------------------------------------------------------------

export const PROTOCOL_VERSION = '2025-03-26'
export const SERVER_INFO = { name: 'chess-lesson-planner', version: '1.0.0' }

interface RpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

type RpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string } }

/** One JSON-RPC message in, one response out; notifications (no id) return null. */
export async function handleRpc(msg: RpcRequest, ctx: ToolContext): Promise<RpcResponse | null> {
  const id = msg.id ?? null
  const ok = (result: unknown): RpcResponse => ({ jsonrpc: '2.0', id, result })
  const fail = (code: number, message: string): RpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } })
  if (msg.id === undefined) return null // a notification, e.g. notifications/initialized
  switch (msg.method) {
    case 'initialize':
      return ok({ protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO })
    case 'ping':
      return ok({})
    case 'tools/list':
      return ok({ tools: TOOLS })
    case 'tools/call': {
      const name = String(msg.params?.name ?? '')
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>
      try {
        const result = await callTool(name, args, ctx)
        return ok({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result })
      } catch (e) {
        // Tool failures are results the model can read, not protocol errors.
        return ok({ content: [{ type: 'text', text: e instanceof Error ? e.message : String(e) }], isError: true })
      }
    }
    default:
      return fail(-32601, `Method not found: ${msg.method}`)
  }
}

/** The whole HTTP body: a single message, a batch, or the plain {tool, args} shortcut for non-MCP callers. */
export async function handleBody(body: unknown, ctx: ToolContext): Promise<{ status: number; json: unknown }> {
  if (body && typeof body === 'object' && 'tool' in body && !('jsonrpc' in body)) {
    const { tool, args } = body as { tool: string; args?: Record<string, unknown> }
    try {
      return { status: 200, json: { ok: true, result: await callTool(tool, args ?? {}, ctx) } }
    } catch (e) {
      return {
        status: e instanceof ToolError ? 400 : 500,
        json: { ok: false, error: e instanceof Error ? e.message : String(e) },
      }
    }
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(m as RpcRequest, ctx)))).filter(Boolean)
    return out.length ? { status: 200, json: out } : { status: 202, json: null }
  }
  if (!body || typeof body !== 'object' || (body as RpcRequest).jsonrpc !== '2.0') {
    return { status: 400, json: { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } } }
  }
  const res = await handleRpc(body as RpcRequest, ctx)
  return res ? { status: 200, json: res } : { status: 202, json: null }
}
