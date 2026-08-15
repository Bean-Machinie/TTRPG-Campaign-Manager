import { requireSupabase } from '../lib/supabase/client'
import { isAvatarPreset } from './avatarPresets'
import type { AvatarPreset } from './avatarPresets'
import { DEFAULT_BANNER_PRESET, isBannerPreset } from './bannerPresets'
import type { BannerPreset } from './bannerPresets'

export type Profile = {
  id: string
  email: string
  displayName: string | null
  headline: string | null
  bio: string | null
  avatarPath: string | null
  avatarPreset: AvatarPreset | null
  avatarUrl: string | null
  bannerPreset: BannerPreset
}

type ProfileRow = {
  id: string
  email: string
  display_name: string | null
  headline: string | null
  bio: string | null
  avatar_path: string | null
  avatar_preset: string | null
  banner_preset: string | null
}

export const PROFILE_COLUMNS =
  'id, email, display_name, headline, bio, avatar_path, avatar_preset, banner_preset'

export type ProfileInput = {
  displayName: string
  headline: string
  bio: string
  avatarPreset: AvatarPreset | null
  avatarPath: string | null
  bannerPreset: BannerPreset
}

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
  let avatarUrl: string | null = null
  if (row.avatar_path) {
    const { data: signed } = await supabase.storage
      .from('profile-avatars')
      .createSignedUrl(row.avatar_path, 60 * 60)
    avatarUrl = signed?.signedUrl ?? null
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    headline: row.headline,
    bio: row.bio,
    avatarPath: row.avatar_path,
    avatarPreset: isAvatarPreset(row.avatar_preset) ? row.avatar_preset : null,
    avatarUrl,
    bannerPreset: isBannerPreset(row.banner_preset) ? row.banner_preset : DEFAULT_BANNER_PRESET,
  }
}

/** Editable profile fields; email remains trigger-owned and ungranted. */
export async function updateProfile(userId: string, input: ProfileInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: input.displayName.trim() || null,
      headline: input.headline.trim() || null,
      bio: input.bio.trim() || null,
      avatar_preset: input.avatarPreset,
      avatar_path: input.avatarPath,
      banner_preset: input.bannerPreset,
    })
    .eq('id', userId)

  if (error) throw error
}

const AVATAR_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function uploadProfileAvatar(userId: string, file: File): Promise<string> {
  const supabase = requireSupabase()
  const extension = AVATAR_EXTENSIONS[file.type]
  if (!extension) throw new Error('Choose a PNG, JPEG, or WebP image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Profile images must be 5 MB or smaller.')

  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('profile-avatars').upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function deleteProfileAvatar(path: string): Promise<void> {
  const supabase = requireSupabase()
  const { error } = await supabase.storage.from('profile-avatars').remove([path])
  if (error) throw error
}
