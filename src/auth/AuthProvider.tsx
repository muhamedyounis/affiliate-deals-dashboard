import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'

type SignInResult = {
  error: Error | null
}

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  isConfigured: boolean
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(hasSupabaseConfig)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return
      if (!error) {
        setSession(data.session)
        setUser(data.session?.user ?? null)
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      isConfigured: hasSupabaseConfig,
      async signIn(email, password) {
        if (!supabase) {
          return { error: new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY') }
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error }
      },
      async signOut() {
        if (supabase) {
          await supabase.auth.signOut()
        }
      },
    }),
    [loading, session, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
