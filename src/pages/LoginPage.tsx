import { LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

type LocationState = {
  from?: {
    pathname?: string
  }
}

export function LoginPage() {
  const { isConfigured, loading, signIn, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null
  const redirectTo = state?.from?.pathname || '/overview'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError(null)
    setIsSubmitting(true)

    const { error } = await signIn(email, password)
    setIsSubmitting(false)

    if (error) {
      setAuthError(error.message)
      return
    }

    navigate(redirectTo, { replace: true })
  }

  return (
    <main className="premium-grid grid min-h-screen place-items-center bg-[#05090c] px-5 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-lg border border-white/[0.12] bg-[#0b1317]/92 p-6 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-lg bg-cyan-300/12 text-cyan-100 ring-1 ring-cyan-300/25">
            <LockKeyhole size={21} aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Private Admin
            </p>
            <h1 className="mt-1 text-xl font-semibold text-white">Sign in to Affiliate Ops</h1>
          </div>
        </div>

        {!isConfigured ? (
          <div className="mt-6 rounded-lg border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
            Missing <code>VITE_SUPABASE_URL</code> or{' '}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.
          </div>
        ) : null}

        {authError ? (
          <div className="mt-6 rounded-lg border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            {authError}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-300">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-lg border border-white/[0.1] bg-black/25 px-3 text-sm text-white outline-none ring-cyan-300/20 transition focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-300">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-lg border border-white/[0.1] bg-black/25 px-3 text-sm text-white outline-none ring-cyan-300/20 transition focus:ring-2"
            />
          </label>

          <button
            type="submit"
            disabled={!isConfigured || isSubmitting || loading}
            className="min-h-11 w-full rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/20 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {isSubmitting ? 'Signing in' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  )
}
