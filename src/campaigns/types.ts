/** Mirrors the `role` check constraint on public.campaign_memberships. */
export type CampaignRole = 'owner' | 'gm' | 'player'

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
