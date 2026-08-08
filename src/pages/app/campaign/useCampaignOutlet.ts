import { useOutletContext } from 'react-router'
import type { Campaign, CampaignRole } from '../../../campaigns/types'

export type CampaignOutletContext = {
  campaign: Campaign
  role: CampaignRole
}

/**
 * The campaign every page under /app/campaigns/:campaignId is scoped to.
 * The layout loads it once and hands it down, so child pages never re-fetch it.
 */
export function useCampaignOutlet() {
  return useOutletContext<CampaignOutletContext>()
}
