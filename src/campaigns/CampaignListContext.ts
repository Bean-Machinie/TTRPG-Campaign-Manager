import { createContext } from 'react'
import type { CampaignSummary } from './types'

/**
 * The signed-in user's campaigns, loaded once for the whole shell.
 *
 * The sidebar's switcher, the command palette and the dashboard all want this
 * same list. Before the shell existed only the dashboard did, so it fetched its
 * own; now that three places need it, fetching it three times would mean three
 * identical round trips on every page load and three lists that could disagree
 * for a moment after a campaign is created.
 */
export type CampaignListValue = {
  campaigns: CampaignSummary[]
  loading: boolean
  error: string | null
  /** Called after anything that adds a campaign — creating one, accepting an invitation. */
  reload: () => void
}

export const CampaignListContext = createContext<CampaignListValue | null>(null)
