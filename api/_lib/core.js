import { Chess } from 'chess.js'

/**
 * The agent connector, independent of transport and storage: MCP framing
 * (JSON-RPC over HTTP, stateless), the four tools, and the position checks.
 * `db` is whatever stores lessons; see supabaseDb.js for the real one.
 *
 * Plain JavaScript on purpose: Vercel runs it as-is, with nothing to compile.
 *
 * @typedef {{ id: string, name: string }} StudentRow
 * @typedef {{ id: string, number: number, title: string, status: string, total: number, done: number }} LessonRow
 * @typedef {{ san: string, fen: string, comment?: string }} Move
 * @typedef {{ startSquare: string, endSquare: string, color: string }} Arrow
 * @typedef {{ square: string, color: string }} Highlight
 * @typedef {{
 *   sort_order: number, label: string, starting_fen: string, side_to_move: 'w' | 'b',
 *   arrows: Arrow[], highlights: Highlight[], quiz_prompt: string, summary: string, solution: Move[],
 *   reference_url: string | null, reference_label: string | null,
 *   source: { kind: 'fen', url?: string }, themes: string[], done: boolean
 * }} PuzzleRow
 * @typedef {{
 *   listStudents(): Promise<StudentRow[]>,
 *   listLessons(studentId: string): Promise<LessonRow[]>,
 *   createLesson(studentId: string, title: string): Promise<{ id: string, number: number, sectionId: string }>,
 *   targetSection(lessonId: string): Promise<{ studentId: string, number: number, sectionId: string, nextOrder: number }>,
 *   insertPuzzles(sectionId: string, rows: PuzzleRow[]): Promise<void>
 * }} Db
 * @typedef {{ from: string, to: string, color?: string }} ArrowInput
 * @typedef {{ square: string, color?: string }} HighlightInput
 * @typedef {{
 *   fen: string, source_url?: string, label?: string, question?: string, note?: string, answer?: string,
 *   move_notes?: string[], arrows?: ArrowInput[], highlights?: HighlightInput[]
 * }} PositionInput
 * @typedef {{ db: Db, appOrigin: string }} ToolContext
 */

/** The app's four pens (src/lib/pens.ts), by name, so the agent never sends a hex. */
const PENS = { green: '#2ecc71', red: '#e5534b', blue: '#3b9cff', yellow: '#e8b339' }
/** Square highlights are the pen at 40%, as when drawn by hand. */
const HIGHLIGHT_ALPHA = '66'
const PEN_NAMES = Object.keys(PENS)

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
    question: {
      type: 'string',
      description:
        'What to ask the student, in plain coaching words ("White to move. What is Black threatening, and how do you stop it?"). Always fill this in; a blank falls back to a generic prompt.',
    },
    note: {
      type: 'string',
      description:
        "The coach's context for the position. When the position comes from a course (Chessable, a Lichess study, a book), start with that course's own comment or annotation on the move, quoted or closely paraphrased, then add why the answer works and what the alternatives lose, two to four sentences in the words used at the board. When the source has no text of its own (a Lichess or chess.com puzzle), skip the quote and write the explanation yourself. Always fill this in so the coach only has to review, not write.",
    },
    answer: {
      type: 'string',
      description: 'The answer line as SAN moves separated by spaces, e.g. "Rf8 Bxh4 b4". Move numbers are ignored. Validated against the position.',
    },
    move_notes: {
      type: 'array',
      items: { type: 'string' },
      description:
        'One short explanation per move of the answer, in the same order ("Threatens mate on h7", "Forced: the only square"). Shown under each move as the coach steps through the line. Use "" for a move with nothing to say.',
    },
    arrows: {
      type: 'array',
      items: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string', description: 'Square, e.g. "e4".' },
          to: { type: 'string', description: 'Square, e.g. "h7".' },
          color: { type: 'string', enum: PEN_NAMES, description: 'green (default) for the idea, red for the threat, blue for a plan or route, yellow for a key square or piece.' },
        },
      },
      description:
        'Arrows drawn on the starting position, shown when the answer is revealed: the key move, the threat it meets or creates, the plan. One to four arrows; the answer move itself is a good first arrow.',
    },
    highlights: {
      type: 'array',
      items: {
        type: 'object',
        required: ['square'],
        properties: {
          square: { type: 'string', description: 'Square, e.g. "f7".' },
          color: { type: 'string', enum: PEN_NAMES, description: 'Same meaning as arrow colours.' },
        },
      },
      description: 'Squares to mark on the starting position (the weak square, the hanging piece, the target). One to three.',
    },
  },
}

const SQUARE = /^[a-h][1-8]$/

/**
 * @param {unknown} v
 * @param {string} what
 */
function square(v, what) {
  const s = String(v ?? '')
    .trim()
    .toLowerCase()
  if (!SQUARE.test(s)) throw new ToolError(`${what}: "${v}" is not a square (a1–h8)`)
  return s
}

/**
 * @param {unknown} v
 * @param {string} what
 */
function pen(v, what) {
  if (v === undefined || v === null || v === '') return PENS.green
  const name = String(v).trim().toLowerCase()
  const hex = /** @type {Record<string, string>} */ (PENS)[name]
  if (!hex) throw new ToolError(`${what}: colour "${v}" is not one of ${PEN_NAMES.join(', ')}`)
  return hex
}

/**
 * @param {unknown} list
 * @param {string} what
 * @returns {Arrow[]}
 */
export function parseArrows(list, what) {
  if (list === undefined || list === null) return []
  if (!Array.isArray(list)) throw new ToolError(`${what}: arrows must be a list`)
  return list.map((a, i) => {
    const o = /** @type {Record<string, unknown>} */ (a && typeof a === 'object' ? a : {})
    const label = `${what}, arrow ${i + 1}`
    const startSquare = square(o.from, label)
    const endSquare = square(o.to, label)
    if (startSquare === endSquare) throw new ToolError(`${label}: from and to are the same square`)
    return { startSquare, endSquare, color: pen(o.color, label) }
  })
}

/**
 * @param {unknown} list
 * @param {string} what
 * @returns {Highlight[]}
 */
export function parseHighlights(list, what) {
  if (list === undefined || list === null) return []
  if (!Array.isArray(list)) throw new ToolError(`${what}: highlights must be a list`)
  return list.map((h, i) => {
    const o = /** @type {Record<string, unknown>} */ (h && typeof h === 'object' ? h : {})
    const label = `${what}, highlight ${i + 1}`
    return { square: square(o.square, label), color: pen(o.color, label) + HIGHLIGHT_ALPHA }
  })
}

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
      'Create the next lesson for a student from a list of positions (FENs). Fill every position completely: fen, answer (the line), move_notes, question, note, label, source_url, arrows and highlights. The coach may open Coach view or Present with no preparation, so each position must teach itself: the answer stepped through with a note per move, arrows and marked squares on the board, and the explanation. When a position was taken from a course, carry the course\'s comment on the move into the note; when the source has none, write it yourself. Returns the lesson id and the link to open it in the app.',
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
    description: 'Append positions to an existing lesson. Fill each position completely, as for create_lesson.',
    inputSchema: {
      type: 'object',
      required: ['lesson_id', 'positions'],
      properties: { lesson_id: { type: 'string' }, positions: { type: 'array', minItems: 1, items: POSITION_SCHEMA } },
    },
  },
]

export class ToolError extends Error {}

/**
 * A readable message for anything thrown. Supabase throws plain objects
 * ({ message, details, hint, code }), which String() turns into
 * "[object Object]"; this keeps what they say.
 * @param {unknown} e
 */
export function errorMessage(e) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const o = /** @type {Record<string, unknown>} */ (e)
    if (typeof o.message === 'string') {
      const extra = [o.details, o.hint].filter((x) => typeof x === 'string' && x).join(' · ')
      const code = typeof o.code === 'string' ? ` [${o.code}]` : ''
      return `${o.message}${extra ? ` (${extra})` : ''}${code}`
    }
    try {
      return JSON.stringify(e)
    } catch {
      return String(e)
    }
  }
  return String(e)
}

/**
 * Fill in the missing FEN fields and make sure chess.js accepts the result.
 * @param {string} raw
 */
export function normalizeFen(raw) {
  const parts = String(raw).trim().split(/\s+/)
  if (parts.length < 1 || !parts[0].includes('/')) throw new ToolError(`Not a FEN: "${raw}"`)
  const [placement, turn = 'w', castling = '-', ep = '-', half = '0', full = '1'] = parts
  if (turn !== 'w' && turn !== 'b') throw new ToolError(`Side to move must be w or b in "${raw}"`)
  const fen = [placement, turn, castling, ep, half, full].join(' ')
  try {
    new Chess(fen)
  } catch (e) {
    throw new ToolError(`Invalid FEN "${raw}": ${errorMessage(e)}`)
  }
  return fen
}

/**
 * Replay SAN moves from a position; move numbers and result markers are ignored.
 * `notes`, when given, is one comment per move in the same order.
 * @param {string} fen
 * @param {string} answer
 * @param {unknown} [notes]
 * @returns {Move[]}
 */
export function replayAnswer(fen, answer, notes) {
  const chess = new Chess(fen)
  const tokens = String(answer)
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.+/, ''))
    .filter((t) => t && !/^\d+\.*$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t))
  if (notes !== undefined && notes !== null && !Array.isArray(notes)) throw new ToolError('move_notes must be a list of strings, one per move')
  const comments = Array.isArray(notes) ? notes.map((n) => (n == null ? '' : String(n).trim())) : []
  if (comments.length > tokens.length) {
    throw new ToolError(`move_notes has ${comments.length} entries but the answer "${answer}" has ${tokens.length} moves`)
  }
  return tokens.map((san, i) => {
    try {
      const move = chess.move(san)
      /** @type {Move} */
      const row = { san: move.san, fen: chess.fen() }
      if (comments[i]) row.comment = comments[i]
      return row
    } catch {
      throw new ToolError(`Illegal move "${san}" in answer "${answer}" from ${fen}`)
    }
  })
}

/**
 * @param {PositionInput} p
 * @param {number} order
 * @returns {PuzzleRow}
 */
export function toRow(p, order) {
  if (!p || typeof p.fen !== 'string') throw new ToolError(`Position ${order + 1} needs a fen`)
  const fen = normalizeFen(p.fen)
  const solution = p.answer && String(p.answer).trim() ? replayAnswer(fen, p.answer, p.move_notes) : []
  const url = p.source_url ? String(p.source_url).trim() : ''
  const what = `Position ${order + 1}`
  return {
    sort_order: order,
    label: (p.label && String(p.label).trim()) || solution[0]?.san || `#${order + 1}`,
    starting_fen: fen,
    side_to_move: /** @type {'w' | 'b'} */ (fen.split(' ')[1]),
    arrows: parseArrows(p.arrows, what),
    highlights: parseHighlights(p.highlights, what),
    quiz_prompt: p.question ? String(p.question).trim() : '',
    summary: p.note ? String(p.note).trim() : '',
    solution,
    reference_url: url || null,
    reference_label: url ? hostOf(url) : null,
    source: url ? { kind: 'fen', url } : { kind: 'fen' },
    themes: [],
    done: false,
  }
}

/** @param {string} url */
function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * @param {string} name
 * @param {Record<string, unknown>} args
 * @param {ToolContext} ctx
 */
export async function callTool(name, args, ctx) {
  const { db, appOrigin } = ctx
  const lessonUrl = (/** @type {string} */ studentId, /** @type {string} */ lessonId) =>
    `${appOrigin}/#/students/${studentId}/lessons/${lessonId}`
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

/** @param {unknown} v @param {string} field */
function str(v, field) {
  if (typeof v !== 'string' || !v.trim()) throw new ToolError(`${field} is required`)
  return v.trim()
}

/** @param {unknown} v @returns {PositionInput[]} */
function positions(v) {
  if (!Array.isArray(v) || v.length === 0) throw new ToolError('positions must be a non-empty array')
  return v
}

// ---------------------------------------------------------------------------
// MCP over HTTP: JSON-RPC 2.0, stateless (no sessions, no SSE).
// ---------------------------------------------------------------------------

export const PROTOCOL_VERSION = '2025-03-26'
export const SERVER_INFO = { name: 'chess-lesson-planner', version: '1.1.0' }

/**
 * One JSON-RPC message in, one response out; notifications (no id) return null.
 * @param {{ jsonrpc?: string, id?: string | number | null, method: string, params?: Record<string, any> }} msg
 * @param {ToolContext} ctx
 */
export async function handleRpc(msg, ctx) {
  const id = msg.id ?? null
  const ok = (/** @type {unknown} */ result) => ({ jsonrpc: '2.0', id, result })
  const fail = (/** @type {number} */ code, /** @type {string} */ message) => ({ jsonrpc: '2.0', id, error: { code, message } })
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
      const args = msg.params?.arguments ?? {}
      try {
        const result = await callTool(name, args, ctx)
        return ok({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result })
      } catch (e) {
        // Tool failures are results the model can read, not protocol errors.
        return ok({ content: [{ type: 'text', text: errorMessage(e) }], isError: true })
      }
    }
    default:
      return fail(-32601, `Method not found: ${msg.method}`)
  }
}

/**
 * The whole HTTP body: a single message, a batch, or the plain {tool, args} shortcut for non-MCP callers.
 * @param {any} body
 * @param {ToolContext} ctx
 * @returns {Promise<{ status: number, json: unknown }>}
 */
export async function handleBody(body, ctx) {
  if (body && typeof body === 'object' && 'tool' in body && !('jsonrpc' in body)) {
    try {
      return { status: 200, json: { ok: true, result: await callTool(body.tool, body.args ?? {}, ctx) } }
    } catch (e) {
      return {
        status: e instanceof ToolError ? 400 : 500,
        json: { ok: false, error: errorMessage(e) },
      }
    }
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(m, ctx)))).filter(Boolean)
    return out.length ? { status: 200, json: out } : { status: 202, json: null }
  }
  if (!body || typeof body !== 'object' || body.jsonrpc !== '2.0') {
    return { status: 400, json: { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } } }
  }
  const res = await handleRpc(body, ctx)
  return res ? { status: 200, json: res } : { status: 202, json: null }
}
