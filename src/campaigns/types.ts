/** Mirrors the `role` check constraint on public.campaign_memberships. */
export type CampaignRole = 'owner' | 'gm' | 'player'

/** Roles an invitation may offer. Ownership is not transferable this way. */
export type InvitableRole = 'gm' | 'player'

export type Campaign = {
  id: string
  name: string
  createdAt: string
}

/** A campaign together with the current user's role in it. */
export type CampaignMembership = {
  campaign: Campaign
  role: CampaignRole
}

/** One person in a campaign. */
export type CampaignMember = {
  membershipId: string
  userId: string
  email: string
  role: CampaignRole
}

/** An outgoing invitation, as seen by a campaign owner. */
export type CampaignInvitation = {
  id: string
  email: string
  role: InvitableRole
  createdAt: string
}

/** An incoming invitation, as seen by the person invited. */
export type PendingInvitation = {
  id: string
  campaignId: string
  campaignName: string
  role: InvitableRole
  createdAt: string
}
