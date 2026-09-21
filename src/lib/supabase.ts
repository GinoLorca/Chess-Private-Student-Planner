import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Demo mode runs the whole app against sample data with no backend at all. */
export const isDemo = import.meta.env.VITE_DEMO === '1'

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured && !isDemo) {
  console.warn(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env.local file (see .env.example), or VITE_DEMO=1 for sample data.',
  )
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key')
