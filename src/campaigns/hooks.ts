import { useAsyncData } from '../lib/useAsyncData'
import {
  getCampaignDocument,
  getCampaignMembership,
  listCampaignCharacters,
  listCampaignDocuments,
  listCampaignInvitations,
  listCampaignLocations,
  listCampaignMaps,
  listCampaignMembers,
  listCampaignNotes,
  listCampaignQuests,
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

export function useCampaignCharacters(campaignId: string) {
  const { data, loading, error, reload } = useAsyncData(
    () => listCampaignCharacters(campaignId),
    `characters:${campaignId}`,
    'Could not load the characters of this campaign.',
  )
  return { characters: data ?? [], loading, error, reload }
}

export function useCampaignLocations(campaignId: string) {
  const { data, loading, error, reload } = useAsyncData(
    () => listCampaignLocations(campaignId),
    `locations:${campaignId}`,
    'Could not load the locations of this campaign.',
  )
  return { locations: data ?? [], loading, error, reload }
}

export function useCampaignQuests(campaignId: string) {
  const { data, loading, error, reload } = useAsyncData(
    () => listCampaignQuests(campaignId),
    `quests:${campaignId}`,
    'Could not load the quests of this campaign.',
  )
  return { quests: data ?? [], loading, error, reload }
}

export function useCampaignNotes(campaignId: string) {
  const { data, loading, error, reload } = useAsyncData(
    () => listCampaignNotes(campaignId),
    `notes:${campaignId}`,
    'Could not load the notes of this campaign.',
  )
  return { notes: data ?? [], loading, error, reload }
}

export function useCampaignMaps(campaignId: string) {
  const { data, loading, error, reload } = useAsyncData(
    () => listCampaignMaps(campaignId),
    `maps:${campaignId}`,
    'Could not load the maps of this campaign.',
  )
  return { maps: data ?? [], loading, error, reload }
}

export function useCampaignDocuments(campaignId: string) {
  const { data, loading, error, reload } = useAsyncData(
    () => listCampaignDocuments(campaignId),
    `documents:${campaignId}`,
    'Could not load the documents of this campaign.',
  )
  return { documents: data ?? [], loading, error, reload }
}

/** One document with its body. Null means "not yours to read", as elsewhere. */
export function useCampaignDocument(documentId: string | undefined) {
  const { data, loading, error, reload } = useAsyncData(
    async () => (documentId ? getCampaignDocument(documentId) : null),
    `document:${documentId}`,
    'Could not load this document.',
  )
  return { document: data, loading, error, reload }
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
