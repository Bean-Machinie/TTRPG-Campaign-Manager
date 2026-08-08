import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type SignUpResult = {
  /** True when Supabase requires the user to confirm their email before signing in. */
  needsEmailConfirmation: boolean
}

export type AuthContextValue = {
  session: Session | null
  user: User | null
  /** True until the persisted session has been restored. */
  loading: boolean
  /** False when the Supabase environment variables are missing. */
  isConfigured: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
