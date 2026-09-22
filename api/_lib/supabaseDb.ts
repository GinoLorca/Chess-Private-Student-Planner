import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Db, LessonRow, PuzzleRow, StudentRow } from './core.ts'

/**
 * The real store: Supabase, signed in as the coach with their email and
 * password, so every query runs under the same row security as the app.
 */
export async function openSupabaseDb(email: string, password: string): Promise<Db> {
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set on the server')
  const sb = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new AuthError(error.message)
  return new SupabaseDb(sb)
}

export class AuthError extends Error {}

class SupabaseDb implements Db {
  private sb: SupabaseClient
  constructor(sb: SupabaseClient) {
    this.sb = sb
  }

  async listStudents(): Promise<StudentRow[]> {
    const { data, error } = await this.sb.from('students').select('id, name').order('sort_order')
    if (error) throw error
    return data as StudentRow[]
  }

  async listLessons(studentId: string): Promise<LessonRow[]> {
    const { data, error } = await this.sb
      .from('lesson_plans')
      .select('id, number, title, status, lesson_sections(puzzles(done))')
      .eq('student_id', studentId)
      .order('number', { ascending: false })
    if (error) throw error
    type Row = {
      id: string
      number: number
      title: string
      status: string | null
      lesson_sections: { puzzles: { done: boolean | null }[] }[]
    }
    return (data as Row[]).map((r) => {
      const puzzles = r.lesson_sections.flatMap((s) => s.puzzles)
      return {
        id: r.id,
        number: r.number,
        title: r.title,
        status: r.status ?? 'planned',
        total: puzzles.length,
        done: puzzles.filter((p) => p.done).length,
      }
    })
  }

  async createLesson(studentId: string, title: string) {
    const { data: last, error: e1 } = await this.sb
      .from('lesson_plans')
      .select('number')
      .eq('student_id', studentId)
      .order('number', { ascending: false })
      .limit(1)
    if (e1) throw e1
    const number = last && last.length ? last[0].number + 1 : 1
    const { data: plan, error: e2 } = await this.sb
      .from('lesson_plans')
      .insert({ student_id: studentId, number, title, theme: '', agenda: [] })
      .select('id')
      .single()
    if (e2) throw e2
    const { data: section, error: e3 } = await this.sb
      .from('lesson_sections')
      .insert({ lesson_plan_id: plan.id, title: 'Positions', sort_order: 0 })
      .select('id')
      .single()
    if (e3) throw e3
    return { id: plan.id as string, number, sectionId: section.id as string }
  }

  async targetSection(lessonId: string) {
    const { data: plan, error: e1 } = await this.sb
      .from('lesson_plans')
      .select('id, number, student_id')
      .eq('id', lessonId)
      .maybeSingle()
    if (e1) throw e1
    if (!plan) throw new Error(`No lesson with id ${lessonId}`)
    const { data: sections, error: e2 } = await this.sb
      .from('lesson_sections')
      .select('id')
      .eq('lesson_plan_id', lessonId)
      .order('sort_order', { ascending: false })
      .limit(1)
    if (e2) throw e2
    let sectionId = sections?.[0]?.id as string | undefined
    if (!sectionId) {
      const { data: created, error: e3 } = await this.sb
        .from('lesson_sections')
        .insert({ lesson_plan_id: lessonId, title: 'Positions', sort_order: 0 })
        .select('id')
        .single()
      if (e3) throw e3
      sectionId = created.id as string
    }
    const { data: last, error: e4 } = await this.sb
      .from('puzzles')
      .select('sort_order')
      .eq('section_id', sectionId)
      .order('sort_order', { ascending: false })
      .limit(1)
    if (e4) throw e4
    return {
      studentId: plan.student_id as string,
      number: plan.number as number,
      sectionId,
      nextOrder: last && last.length ? last[0].sort_order + 1 : 0,
    }
  }

  async insertPuzzles(sectionId: string, rows: PuzzleRow[]) {
    if (rows.length === 0) return
    const { error } = await this.sb.from('puzzles').insert(rows.map((r) => ({ ...r, section_id: sectionId })))
    if (error) throw error
  }
}
