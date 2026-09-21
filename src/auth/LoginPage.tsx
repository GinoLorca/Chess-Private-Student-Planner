import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { isSupabaseConfigured } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Knight } from '../components/ui/Icons'

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

  const field =
    'h-12 w-full rounded-xl border border-line-strong bg-surface-2 px-3.5 text-[16px] outline-none focus:border-accent'

  return (
    <div className="pt-safe pb-safe flex min-h-svh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-ink shadow-card">
            <Knight size={30} />
          </span>
          <h1 className="text-[28px] font-bold tracking-tight text-ink">Lesson Planner</h1>
          <p className="mt-1 text-[15px] text-ink-2">Sign in to open your student folders.</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-xl bg-warn-soft p-3 text-[13px] text-warn">
            Supabase isn't configured. Add <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
            <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to <code className="font-mono">.env.local</code>, or set{' '}
            <code className="font-mono">VITE_DEMO=1</code> to explore with sample data.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 rounded-3xl border border-line bg-surface p-5 shadow-card">
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
            placeholder="Email"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
            placeholder="Password"
          />
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <Button type="submit" variant="primary" size="lg" block disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-[12px] text-ink-3">
          Accounts are created from the Supabase dashboard — this is a single-coach planner.
        </p>
      </div>
    </div>
  )
}
