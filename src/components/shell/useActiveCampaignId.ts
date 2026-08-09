import { useMatch } from 'react-router'

/**
 * The campaign in the address bar, if there is one.
 *
 * Read from the location rather than passed down, because the shell sits
 * *above* the route that owns `:campaignId` and so can never be given it as a
 * prop. The trailing splat is what makes the pattern match the campaign's own
 * page as well as every section under it; `/app/campaigns/new` matches it too
 * and is not a campaign.
 */
export function useActiveCampaignId(): string | null {
  const match = useMatch('/app/campaigns/:campaignId/*')
  const id = match?.params.campaignId
  return id && id !== 'new' ? id : null
}
