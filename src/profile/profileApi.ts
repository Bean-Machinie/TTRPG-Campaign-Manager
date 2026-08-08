import { requireSupabase } from '../lib/supabase/client'

export type Profile = {
  id: string
  email: string
  displayName: string | null
}

type ProfileRow = {
  id: string
  email: string
  display_name: string | null
}

export const PROFILE_COLUMNS = 'id, email, display_name'

/** What to call someone in a list: their chosen name, or their email. */
export function personLabel(displayName: string | null, email: string): string {
  return displayName ?? email
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as ProfileRow
  return { id: row.id, email: row.email, displayName: row.display_name }
}

/**
 * Only display_name is writable — the database grants update on that column
 * alone, so this cannot touch the email even by mistake.
 */
export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName.trim() || null })
    .eq('id', userId)

  if (error) throw error
}
