import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Whether the app has enough configuration to talk to Supabase at all.
 * The UI uses this to explain the problem instead of failing with a
 * confusing runtime error somewhere deep inside the auth flow.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/** `null` when the environment variables are missing. Always check before use. */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null

export const SUPABASE_SETUP_MESSAGE =
  'Supabase is not configured. Copy .env.example to .env.local, fill in ' +
  'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.'

/** Use inside code paths that cannot work without Supabase. */
export function requireSupabase() {
  if (!supabase) {
    throw new Error(SUPABASE_SETUP_MESSAGE)
  }
  return supabase
}
