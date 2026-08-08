import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, requireSupabase, supabase } from '../lib/supabase/client'
import { AuthContext } from './AuthContext'
import type { AuthContextValue } from './AuthContext'

/**
 * Holds the Supabase auth session for the whole app.
 * This is the one piece of genuinely global state in this iteration.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let active = true

    // Restore any session persisted in local storage.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    // Keep the session in sync with sign in / sign out / token refresh.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      isConfigured: isSupabaseConfigured,

      async signIn(email, password) {
        const client = requireSupabase()
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (error) throw error
      },

      async signUp(email, password) {
        const client = requireSupabase()
        const { data, error } = await client.auth.signUp({ email, password })
        if (error) throw error
        return { needsEmailConfirmation: data.session === null }
      },

      async signOut() {
        const client = requireSupabase()
        const { error } = await client.auth.signOut()
        if (error) throw error
      },
    }),
    [session, loading],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
