import { useAsyncData } from '../lib/useAsyncData'
import { getProfile } from './profileApi'

/** The signed-in user's own profile. */
export function useMyProfile(userId: string | undefined) {
  const { data, loading, error, reload } = useAsyncData(
    async () => (userId ? getProfile(userId) : null),
    `profile:${userId}`,
    'Could not load your profile.',
  )
  return { profile: data, loading, error, reload }
}
