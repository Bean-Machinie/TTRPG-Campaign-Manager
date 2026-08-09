import { use } from 'react'
import { CampaignListContext } from './CampaignListContext'

export function useCampaignList() {
  const value = use(CampaignListContext)
  if (!value) {
    throw new Error('useCampaignList must be used inside the application shell')
  }
  return value
}
