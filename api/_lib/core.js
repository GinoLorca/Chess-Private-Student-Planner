import { Chess } from 'chess.js'
import { DEFAULT_TIMEZONE, addDays, checkTimezone, departure, lessonsBetween, isoInZone, sayNext, todayIn } from './schedule.js'

/**
 * The agent connector, independent of transport and storage: MCP framing
 * (JSON-RPC over HTTP, stateless), the tools, and the position checks.
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
 *   listTeachFolders(): Promise<StudentRow[]>,
 *   createTeachFolder(name: string): Promise<StudentRow>,
 *   listLessons(studentId: string): Promise<LessonRow[]>,
 *   createLesson(studentId: string, title: string): Promise<{ id: string, number: number, sectionId: string }>,
 *   targetSection(lessonId: string): Promise<{ studentId: string, number: number, sectionId: string, nextOrder: number }>,
 *   insertPuzzles(sectionId: string, rows: PuzzleRow[]): Promise<void>,
 *   getPosition(id: string): Promise<StoredPosition | null>,
 *   listSchedule(): Promise<{ students: StudentRow[], slots: any[], changes: any[], places: any[] }>
 * }} Db
 * @typedef {{
 *   puzzle: Record<string, any>,
 *   section: { id: string, title: string } | null,
 *   lesson: { id: string, number: number, title: string, status?: string } | null,
 *   student: { id: string, name: string } | null
 * }} StoredPosition
 * @typedef {{ from: string, to: string, color?: string }} ArrowInput
 * @typedef {{ square: string, color?: string }} HighlightInput
 * @typedef {{
 *   fen: string, setup_moves?: string, source_url?: string, label?: string, question?: string, note?: string,
 *   answer?: string, move_notes?: string[], arrows?: ArrowInput[], highlights?: HighlightInput[]
 * }} PositionInput
 * @typedef {{ db: Db, appOrigin: string, now?: Date }} ToolContext
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
    setup_moves: {
      type: 'string',
      description:
        'Moves already played before the student\'s turn, as SAN separated by spaces: usually the one opponent move the puzzle answers, e.g. the mistake to punish ("Bxf4"). They\'re played from fen, and the student starts from the position after them, with the other side to move. Leave out when the student moves first in fen.',
    },
    source_url: { type: 'string', description: 'Where it came from (a Lichess study, an article...). Shown as the source link.' },
    label: { type: 'string', description: 'Short name, e.g. the key move. Defaults to the first answer move.' },
    question: {
      type: 'string',
      description:
        'What to ask the student, in plain coaching words ("White to move. What is Black threatening, and how do you stop it?"). It must name the side that is to move in the position the student sees (after setup_moves). Always fill this in; a blank falls back to a generic prompt.',
    },
    note: {
      type: 'string',
      description:
        "The coach's context for the position. When the position comes from a course (Chessable, a Lichess study, a book), start with that course's own comment or annotation on the move, quoted or closely paraphrased, then add why the answer works and what the alternatives lose, two to four sentences in the words used at the board. When the source has no text of its own (a Lichess or chess.com puzzle), skip the quote and write the explanation yourself. Always fill this in so the coach only has to review, not write.",
    },
    answer: {
      type: 'string',
      description:
        'The answer line as SAN moves separated by spaces, e.g. "Rf8 Bxh4 b4": the move the student should find, for the side to move, then the replies in turn. Never start it with a mistake: when a course shows a tempting error and its refutation ("30...Bxf4? 31.Rf1!"), the puzzle is the refutation, so put the error in setup_moves and start the answer with the refutation ("Rf1 Rxg3+ Qxg3+ Bxg3 Rxf5"). Move numbers are ignored. Validated against the position.',
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
    name: 'list_teach_folders',
    description:
      "The folders in Teach, with their ids: lessons for anyone, kept apart from the students (a set of puzzles to break down, or one being prepared for a private student). The first folder, Teach, is made if there are none. Use a folder's id as student_id in create_lesson and list_lessons to put positions there, for example puzzles pulled from the coach's Lichess.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_teach_folder',
    description: 'Add a folder to Teach, e.g. "Back-rank mates" or one prepared for a student. Returns its id, to use as student_id in create_lesson.',
    inputSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string', description: 'The folder name.' } } },
  },
  {
    name: 'list_lessons',
    description: "A student's lesson plans, newest first, with how many positions each has and how many are annotated.",
    inputSchema: { type: 'object', required: ['student_id'], properties: { student_id: { type: 'string' } } },
  },
  {
    name: 'create_lesson',
    description:
      'Create the next lesson for a student, or in a Teach folder (its id from list_teach_folders), from a list of positions (FENs). In a Teach folder the lesson is for anyone: word the question and every note about the position only (White, Black, the pieces and the moves), never a person, no names and no "you". Fill every position completely: fen, answer (the line), move_notes, question, note, label, source_url, arrows and highlights. The student plays the side to move, and the answer starts with the move they should find; for an exercise that punishes a mistake, the mistake goes in setup_moves. The coach may open Coach view or Present with no preparation, so each position must teach itself: the answer stepped through with a note per move, arrows and marked squares on the board, and the explanation. When a position was taken from a course, carry the course\'s comment on the move into the note; when the source has none, write it yourself. Returns the lesson id and the link to open it in the app.',
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
    name: 'next_lesson',
    description:
      "The coach's next private lesson that is on (cancelled and moved-away lessons are skipped), for telling them when to get going. Returns when it starts (ISO time with the coach's UTC offset, and minutes from now), the student, the address with an Apple Maps directions link, the front door and bathroom codes, anything that changed this week, and `say`, one sentence ready to speak. Work out the travel time from the coach's current location to place.address yourself and pass it as travel_minutes: the reply then carries leave_by, minutes_until_leave and should_leave_now (true once it is time to go). Call it again whenever the coach's location or the time changes.",
    inputSchema: {
      type: 'object',
      properties: {
        travel_minutes: { type: 'number', description: "Travel time from the coach's current location to the lesson address, in minutes." },
        buffer_minutes: { type: 'number', description: 'Minutes to arrive before the start, to settle in. Default 10.' },
        within_days: { type: 'number', description: 'How far ahead to look, in days. Default 7.' },
        timezone: { type: 'string', description: "IANA zone the coach is in, e.g. America/New_York. Default: the server's COACH_TIMEZONE." },
      },
    },
  },
  {
    name: 'get_schedule',
    description:
      "The coach's lessons for a day or a run of days, in time order: the regular weekly lessons with that week's changes applied. status is on, cancelled (don't go) or moved_away (this lesson moved to another day; the moved lesson is listed on its new day with status on). Each lesson has start and end (ISO with the UTC offset), minutes_until_start, what changed and why, and the place: address, Apple Maps links, door code, bathroom code and which bathroom.",
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: '"today" (default), "tomorrow", or YYYY-MM-DD.' },
        days: { type: 'number', description: 'How many days from date, 1 to 31. Default 1.' },
        timezone: { type: 'string', description: "IANA zone, e.g. America/New_York. Default: the server's COACH_TIMEZONE." },
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
  {
    name: 'get_position',
    description:
      "Read one position as the coach sees it, to review or fix it: whose move it is, the question, the answer line with each move's note, the explanation, the coach's own notes (my_notes), the arrows and marked squares, the source, and which student and lesson it's in, with links to open and edit it. Pass the position's id or any app link to it (a share link like …/#/p/<id>, a position page, or a lesson view with ?p=<id>). `checks` lists anything that looks wrong: an answer that doesn't replay, or a question that names the other side as to move.",
    inputSchema: {
      type: 'object',
      required: ['position'],
      properties: { position: { type: 'string', description: 'The position id, or a link to it from the app.' } },
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
 * The position the student sees: `fen` after any setup moves.
 * @param {string} fen
 * @param {unknown} setup
 */
function startingFen(fen, setup) {
  if (setup === undefined || setup === null || !String(setup).trim()) return fen
  const moves = replayAnswer(fen, String(setup).replace(/[?!]+/g, ''))
  return moves.length ? moves[moves.length - 1].fen : fen
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
  const fen = startingFen(normalizeFen(p.fen), p.setup_moves)
  const solution = p.answer && String(p.answer).trim() ? replayAnswer(fen, p.answer, p.move_notes) : []
  // The student plays the first answer move, so it must be the one to find,
  // not a course's "Bxf4?" with the punishment after it.
  const first = String(p.answer ?? '').trim().split(/\s+/).map((t) => t.replace(/^\d+\.+/, '')).find(Boolean) ?? ''
  if (/\?$/.test(first) && !/!\?$/.test(first)) {
    throw new ToolError(
      `Position ${order + 1}: the answer starts with "${first}", marked as a mistake. The answer is what the student should play. ` +
        `If the puzzle is punishing that move, pass it as setup_moves and start the answer with the reply.`,
    )
  }
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
    case 'list_teach_folders': {
      let folders = await db.listTeachFolders()
      if (folders.length === 0) folders = [await db.createTeachFolder('Teach')]
      return { folders: folders.map((f) => ({ ...f, url: `${appOrigin}/#/students/${f.id}/lessons` })) }
    }
    case 'create_teach_folder': {
      const name = str(args.name, 'name').trim()
      if (!name) throw new ToolError('name must not be empty')
      const folder = await db.createTeachFolder(name)
      return { ...folder, url: `${appOrigin}/#/students/${folder.id}/lessons` }
    }
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
    case 'get_position': {
      const id = positionId(str(args.position, 'position'))
      const found = await db.getPosition(id)
      if (!found) throw new ToolError(`No position with id ${id} in this account`)
      return describePosition(found, appOrigin)
    }
    case 'get_schedule':
    case 'next_lesson': {
      const tz = zone(args.timezone)
      const now = ctx.now ?? new Date()
      const today = todayIn(now, tz)
      const data = await db.listSchedule()
      const scheduleUrl = `${appOrigin}/#/schedule`
      if (name === 'get_schedule') {
        const from = args.date === undefined || args.date === 'today' ? today : args.date === 'tomorrow' ? addDays(today, 1) : dateArg(args.date)
        const days = Math.min(31, Math.max(1, Math.round(num(args.days, 'days') ?? 1)))
        const to = addDays(from, days - 1)
        const lessons = lessonsBetween({ from, to, tz, now, ...data })
        return { timezone: tz, now: isoInZone(now, tz), today, from, to, lessons, schedule_url: scheduleUrl }
      }
      const within = Math.min(31, Math.max(1, Math.round(num(args.within_days, 'within_days') ?? 7)))
      const lessons = lessonsBetween({ from: today, to: addDays(today, within), tz, now, ...data })
      // The one to head for hasn't started yet; one under way is reported beside it.
      const current = lessons.find((l) => l.in_progress) ?? null
      const next = lessons.find((l) => l.status === 'on' && new Date(l.start).getTime() > now.getTime()) ?? null
      const offToday = lessons.filter((l) => l.date === today && l.status !== 'on')
      const base = { timezone: tz, now: isoInZone(now, tz), today, schedule_url: scheduleUrl, current_lesson: current, off_today: offToday }
      if (!next) {
        const say = `${current ? `Teaching ${current.student} until ${current.time.split(' – ')[1]}. ` : ''}No more lessons in the next ${within} days.`
        return { ...base, lesson: null, say }
      }
      const dep = departure(next, { now, tz, travelMinutes: num(args.travel_minutes, 'travel_minutes'), bufferMinutes: num(args.buffer_minutes, 'buffer_minutes') ?? 10 })
      const laterToday = lessons.filter((l) => l !== next && l.date === today && l.status === 'on' && l.start > next.start)
      return { ...base, lesson: next, departure: dep, say: sayNext(next, dep, today, current), later_today: laterToday }
    }
    default:
      throw new ToolError(`Unknown tool "${name}"`)
  }
}

const ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/**
 * The position id in whatever was given: the id itself, a share link
 * (#/p/<id>), a position page (…/puzzles/<id>) or a lesson view (?p=<id>).
 * Any other id-like text is taken as it is.
 * @param {string} v
 */
export function positionId(v) {
  const named = /[#/]p\/([^/?#&\s]+)|\/puzzles\/([^/?#&\s]+)|[?&]p=([^&#\s]+)/.exec(v)
  const id = named ? decodeURIComponent(named[1] ?? named[2] ?? named[3]) : v
  if (ID.test(id)) return /** @type {RegExpExecArray} */ (ID.exec(id))[0].toLowerCase()
  if (/^[\w-]+$/.test(id)) return id
  throw new ToolError(`"${v}" isn't a position id or a link to one`)
}

const PEN_OF_HEX = Object.fromEntries(Object.entries(PENS).map(([name, hex]) => [hex.toLowerCase(), name]))
/** A stored colour back as the pen name it was drawn with, else as stored. @param {unknown} c */
function penName(c) {
  const hex = String(c ?? '').toLowerCase()
  return PEN_OF_HEX[hex] ?? PEN_OF_HEX[hex.slice(0, 7)] ?? (hex || 'green')
}

const STATUS_WORDS = { planned: 'not given yet (red)', in_progress: 'in progress (yellow)', taught: 'taught (green)' }

/**
 * A stored position as an agent reads it: the fields in the words used to
 * write one (question, note, answer), with move numbers from the FEN and a
 * list of anything that looks wrong.
 * @param {StoredPosition} found
 * @param {string} appOrigin
 */
export function describePosition(found, appOrigin) {
  const { puzzle: p, section, lesson, student } = found
  const fen = String(p.starting_fen ?? '')
  const side = p.side_to_move === 'b' ? 'b' : 'w'
  const sideName = side === 'w' ? 'White' : 'Black'
  const otherName = side === 'w' ? 'Black' : 'White'
  const fields = fen.trim().split(/\s+/)
  const firstNumber = Math.max(1, Number(fields[5]) || 1)
  /** @param {number} i */
  const label = (i) => {
    const half = i + (side === 'b' ? 1 : 0)
    const n = firstNumber + Math.floor(half / 2)
    return half % 2 === 0 ? `${n}.` : `${n}...`
  }
  /** @type {Array<Record<string, any>>} */
  const solution = Array.isArray(p.solution) ? p.solution : []
  const answer = solution.map((m, i) => ({
    move: `${label(i)}${m.san}`,
    san: m.san,
    by: (i % 2 === 0) === (side === 'w') ? 'White' : 'Black',
    note: m.comment ?? '',
    ...(m.arrow ? { arrow: { from: m.arrow.startSquare, to: m.arrow.endSquare, color: penName(m.arrow.color) } } : {}),
    fen_after: m.fen,
  }))

  const checks = []
  if (answer.length === 0) checks.push('No answer recorded.')
  try {
    const chess = new Chess(fen.split(' ').length >= 2 ? fen : `${fen} ${side} - - 0 1`)
    for (const [i, m] of solution.entries()) {
      try {
        chess.move(m.san)
      } catch {
        checks.push(`The answer stops replaying at move ${i + 1} (${label(i)}${m.san}): not legal there.`)
        break
      }
    }
  } catch {
    checks.push('The starting position is not a legal FEN.')
  }
  const question = String(p.quiz_prompt ?? '').trim()
  if (new RegExp(`^\\s*${otherName}\\b[^.?!]*\\bto (move|play)`, 'i').test(question)) {
    checks.push(`The question says ${otherName} is to move, but it's ${sideName} to move in this position.`)
  }
  if (!question) checks.push('No question: the app asks its generic one for this section.')
  if (!String(p.summary ?? '').trim()) checks.push('No explanation (note).')

  const base = student && lesson ? `${appOrigin}/#/students/${student.id}/lessons/${lesson.id}` : null
  return {
    id: p.id,
    label: p.label ?? '',
    side_to_move: sideName,
    fen,
    question,
    note: p.summary ?? '',
    // The coach's own notes from solving it by hand (migration 0013); not shown to students.
    my_notes: p.coach_notes ?? '',
    answer_line: answer.map((m) => m.move).join(' '),
    answer,
    arrows: (Array.isArray(p.arrows) ? p.arrows : []).map((a) => ({ from: a.startSquare, to: a.endSquare, color: penName(a.color) })),
    highlights: (Array.isArray(p.highlights) ? p.highlights : []).map((h) => ({ square: h.square, color: penName(h.color) })),
    status: /** @type {Record<string, string>} */ (STATUS_WORDS)[p.status ?? 'planned'] ?? String(p.status),
    source_url: p.reference_url ?? null,
    student: student ? { id: student.id, name: student.name } : null,
    lesson: lesson ? { id: lesson.id, number: lesson.number, title: lesson.title ?? '' } : null,
    section: section?.title ?? null,
    share_url: `${appOrigin}/#/p/${p.id}`,
    url: base ? `${base}/puzzles/${p.id}` : null,
    edit_url: base ? `${base}/puzzles/${p.id}/edit` : null,
    checks,
  }
}

/** The zone asked for, else COACH_TIMEZONE, else New York. @param {unknown} v */
function zone(v) {
  const tz = typeof v === 'string' && v.trim() ? v.trim() : process.env.COACH_TIMEZONE || DEFAULT_TIMEZONE
  if (!checkTimezone(tz)) throw new ToolError(`Unknown time zone "${tz}"; use an IANA name such as America/New_York`)
  return tz
}

/** @param {unknown} v @param {string} field @returns {number | null} */
function num(v, field) {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 0) throw new ToolError(`${field} must be a number of minutes or days, 0 or more`)
  return n
}

/** @param {unknown} v */
function dateArg(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ToolError('date must be "today", "tomorrow" or YYYY-MM-DD')
  return v
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
export const SERVER_INFO = { name: 'chess-lesson-planner', version: '1.4.0' }

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
