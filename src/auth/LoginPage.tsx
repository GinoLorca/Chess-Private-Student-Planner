import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { isSupabaseConfigured } from '../lib/supabase'

export function LoginPage() {
  const { signInWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signInWithPassword(email, password)
    setBusy(false)
    if (error) setError(error)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-marker text-4xl text-gold-500">Lesson Planner</h1>
          <p className="mt-2 text-sm text-ink-300">Sign in to open your student folders.</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-lg border border-gold-600/40 bg-gold-500/10 p-3 text-xs text-gold-400">
            Supabase isn't configured yet. Add <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
            <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to a <code className="font-mono">.env.local</code>{' '}
            file, then restart the dev server.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-xl">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-gold-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none focus:border-gold-500"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gold-500 py-2 text-sm font-semibold text-ink-950 transition hover:bg-gold-400 disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-ink-500">
          Accounts are created from the Supabase dashboard — this is a single-user planner.
        </p>
      </div>
    </div>
  )
}
