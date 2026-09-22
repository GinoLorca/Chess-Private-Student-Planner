import { createClient } from '@supabase/supabase-js'

/**
 * The real store: Supabase, signed in as the coach with their email and
 * password, so every query runs under the same row security as the app.
 *
 * @typedef {import('./core.js').Db} Db
 * @typedef {import('./core.js').PuzzleRow} PuzzleRow
 */

export class AuthError extends Error {}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Db>}
 */
export async function openSupabaseDb(email, password) {
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set on the server')
  const sb = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new AuthError(error.message)
  return supabaseDb(sb)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @returns {Db}
 */
function supabaseDb(sb) {
  return {
    async listStudents() {
      const { data, error } = await sb.from('students').select('id, name').order('sort_order')
      if (error) throw describe(error, 'Listing students')
      return data
    },

    async listLessons(studentId) {
      // Three flat queries rather than a nested join: plans, their sections, their positions.
      const { data: plans, error: e1 } = await sb
        .from('lesson_plans')
        .select('id, number, title, status')
        .eq('student_id', studentId)
        .order('number', { ascending: false })
      if (e1) throw describe(e1, 'Listing lessons')
      if (!plans || plans.length === 0) return []

      const { data: sections, error: e2 } = await sb
        .from('lesson_sections')
        .select('id, lesson_plan_id')
        .in('lesson_plan_id', plans.map((p) => p.id))
      if (e2) throw describe(e2, 'Listing sections')
      const planOfSection = new Map((sections ?? []).map((s) => [s.id, s.lesson_plan_id]))

      // puzzles.done arrives with migration 0006; before it, count positions only.
      let puzzles = []
      if (planOfSection.size > 0) {
        const sectionIds = [...planOfSection.keys()]
        let { data, error } = await sb.from('puzzles').select('section_id, done').in('section_id', sectionIds)
        if (error && /done/.test(error.message)) {
          ;({ data, error } = await sb.from('puzzles').select('section_id').in('section_id', sectionIds))
        }
        if (error) throw describe(error, 'Counting positions')
        puzzles = data ?? []
      }

      const totals = new Map()
      for (const p of puzzles) {
        const planId = planOfSection.get(p.section_id)
        const t = totals.get(planId) ?? { total: 0, done: 0 }
        t.total++
        if (p.done) t.done++
        totals.set(planId, t)
      }
      return plans.map((r) => ({
        id: r.id,
        number: r.number,
        title: r.title,
        status: r.status ?? 'planned',
        total: totals.get(r.id)?.total ?? 0,
        done: totals.get(r.id)?.done ?? 0,
      }))
    },

    async createLesson(studentId, title) {
      const { data: last, error: e1 } = await sb
        .from('lesson_plans')
        .select('number')
        .eq('student_id', studentId)
        .order('number', { ascending: false })
        .limit(1)
      if (e1) throw describe(e1, 'Numbering the lesson')
      const number = last && last.length ? last[0].number + 1 : 1
      const { data: plan, error: e2 } = await sb
        .from('lesson_plans')
        .insert({ student_id: studentId, number, title, theme: '', agenda: [] })
        .select('id')
        .single()
      if (e2) throw describe(e2, 'Creating the lesson')
      const { data: section, error: e3 } = await sb
        .from('lesson_sections')
        .insert({ lesson_plan_id: plan.id, title: 'Positions', sort_order: 0 })
        .select('id')
        .single()
      if (e3) throw describe(e3, 'Creating the Positions section')
      return { id: plan.id, number, sectionId: section.id }
    },

    async targetSection(lessonId) {
      const { data: plan, error: e1 } = await sb.from('lesson_plans').select('id, number, student_id').eq('id', lessonId).maybeSingle()
      if (e1) throw describe(e1, 'Finding the lesson')
      if (!plan) throw new Error(`No lesson with id ${lessonId}`)
      const { data: sections, error: e2 } = await sb
        .from('lesson_sections')
        .select('id')
        .eq('lesson_plan_id', lessonId)
        .order('sort_order', { ascending: false })
        .limit(1)
      if (e2) throw describe(e2, 'Finding the section')
      let sectionId = sections?.[0]?.id
      if (!sectionId) {
        const { data: created, error: e3 } = await sb
          .from('lesson_sections')
          .insert({ lesson_plan_id: lessonId, title: 'Positions', sort_order: 0 })
          .select('id')
          .single()
        if (e3) throw describe(e3, 'Creating the Positions section')
        sectionId = created.id
      }
      const { data: last, error: e4 } = await sb
        .from('puzzles')
        .select('sort_order')
        .eq('section_id', sectionId)
        .order('sort_order', { ascending: false })
        .limit(1)
      if (e4) throw describe(e4, 'Ordering positions')
      return { studentId: plan.student_id, number: plan.number, sectionId, nextOrder: last && last.length ? last[0].sort_order + 1 : 0 }
    },

    async insertPuzzles(sectionId, rows) {
      if (rows.length === 0) return
      // `done` is left to the column default so the insert works before migration 0006 too.
      const { error } = await sb.from('puzzles').insert(rows.map(({ done: _done, ...r }) => ({ ...r, section_id: sectionId })))
      if (error) throw describe(error, 'Saving positions')
    },
  }
}

/**
 * A Supabase error as a real Error with everything it said.
 * @param {{ message: string, details?: string | null, hint?: string | null, code?: string }} error
 * @param {string} what
 */
function describe(error, what) {
  const extra = [error.details, error.hint].filter(Boolean).join(' · ')
  return new Error(`${what}: ${error.message}${extra ? ` (${extra})` : ''}${error.code ? ` [${error.code}]` : ''}`)
}
