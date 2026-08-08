import { useEffect, useState } from 'react'
import { errorMessage } from '../lib/errors'
import { listCampaigns } from './campaignsApi'
import type { Campaign } from './types'

/** Loads the signed-in user's campaigns once on mount. */
export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    listCampaigns()
      .then((result) => {
        if (!active) return
        setCampaigns(result)
        setError(null)
      })
      .catch((caught) => {
        if (!active) return
        setError(errorMessage(caught, 'Could not load your campaigns.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { campaigns, loading, error }
}
