import { useEffect } from 'react'
import { useAsyncData } from '../lib/useAsyncData'
import { getProfile } from './profileApi'

const PROFILE_CHANGED_EVENT = 'campaign-manager:profile-changed'

/** Refresh every mounted copy (profile page, sidebar account menu) together. */
export function notifyProfileChanged(userId: string) {
  window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT, { detail: userId }))
}

/** The signed-in user's own profile. */
export function useMyProfile(userId: string | undefined) {
  const { data, loading, error, reload } = useAsyncData(
    async () => (userId ? getProfile(userId) : null),
    `profile:${userId}`,
    'Could not load your profile.',
  )

  useEffect(() => {
    function handleChange(event: Event) {
      if ((event as CustomEvent<string>).detail === userId) reload()
    }
    window.addEventListener(PROFILE_CHANGED_EVENT, handleChange)
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, handleChange)
  }, [reload, userId])

  return { profile: data, loading, error, reload }
}
