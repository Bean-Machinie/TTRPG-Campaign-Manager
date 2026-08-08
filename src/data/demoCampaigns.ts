/**
 * Temporary demonstration data.
 *
 * Nothing is persisted in this iteration. When Supabase tables arrive, campaigns
 * will be read for the signed-in user through their campaign memberships
 * (user -> campaign_membership -> campaign), and this file can be deleted.
 */

export type Campaign = {
  id: string
  name: string
  lastPlayed: string
}

export const demoCampaigns: Campaign[] = [
  {
    id: 'the-shattered-crown',
    name: 'The Shattered Crown',
    lastPlayed: 'Last played: placeholder',
  },
  {
    id: 'curse-of-strahd',
    name: 'Curse of Strahd',
    lastPlayed: 'Last played: placeholder',
  },
]

export function findDemoCampaign(id: string): Campaign | undefined {
  return demoCampaigns.find((campaign) => campaign.id === id)
}
