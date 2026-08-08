import { useAsyncData } from '../lib/useAsyncData'
import {
  getCampaignMembership,
  listCampaignInvitations,
  listCampaignMembers,
  listCampaignSessions,
  listCampaigns,
  listPendingInvitations,
} from './campaignsApi'

/** Campaigns the signed-in user belongs to. */
export function useCampaigns() {
  const { data, loading, error, reload } = useAsyncData(
    () => listCampaigns(),
    'campaigns',
    'Could not load your campaigns.',
  )
  return { campaigns: data ?? [], loading, error, reload }
}

/** One campaign and the user's role in it. Null means "not available to you". */
export function useCampaignMembership(campaignId: string | undefined, userId: string | undefined) {
  const { data, loading, error } = useAsyncData(
    async () => (campaignId && userId ? getCampaignMembership(campaignId, userId) : null),
    `membership:${campaignId}:${userId}`,
    'Could not load this campaign.',
  )
  return { membership: data, loading, error }
}

export function useCampaignMembers(campaignId: string) {
  const { data, loading, error, reload } = useAsyncData(
    () => listCampaignMembers(campaignId),
    `members:${campaignId}`,
    'Could not load the members of this campaign.',
  )
  return { members: data ?? [], loading, error, reload }
}

/** Invitations sent from a campaign. Only its owner sees any. */
export function useCampaignInvitations(campaignId: string) {
  const { data, loading, error, reload } = useAsyncData(
    () => listCampaignInvitations(campaignId),
    `invitations:${campaignId}`,
    'Could not load the pending invitations.',
  )
  return { invitations: data ?? [], loading, error, reload }
}

export function useCampaignSessions(campaignId: string) {
  const { data, loading, error, reload } = useAsyncData(
    () => listCampaignSessions(campaignId),
    `sessions:${campaignId}`,
    'Could not load the sessions of this campaign.',
  )
  return { sessions: data ?? [], loading, error, reload }
}

/** Invitations addressed to the signed-in user. */
export function usePendingInvitations(email: string | undefined) {
  const { data, loading, error, reload } = useAsyncData(
    async () => (email ? listPendingInvitations(email) : []),
    `pending:${email}`,
    'Could not load your invitations.',
  )
  return { invitations: data ?? [], loading, error, reload }
}
