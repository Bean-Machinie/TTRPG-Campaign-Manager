import { useEffect, useState } from 'react'
import { errorMessage } from '../lib/errors'
import { getCampaignMembership } from './campaignsApi'
import type { CampaignMembership } from './types'

/**
 * Loads one campaign and the user's role in it.
 * `membership` stays null when the campaign is missing or not shared with them.
 */
export function useCampaignMembership(campaignId: string | undefined, userId: string | undefined) {
  const [membership, setMembership] = useState<CampaignMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!campaignId || !userId) {
      setMembership(null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)

    getCampaignMembership(campaignId, userId)
      .then((result) => {
        if (!active) return
        setMembership(result)
        setError(null)
      })
      .catch((caught) => {
        if (!active) return
        setError(errorMessage(caught, 'Could not load this campaign.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [campaignId, userId])

  return { membership, loading, error }
}
