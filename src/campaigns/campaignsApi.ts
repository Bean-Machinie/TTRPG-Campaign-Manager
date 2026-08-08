import { requireSupabase } from '../lib/supabase/client'
import type { Campaign, CampaignMembership, CampaignRole } from './types'

/** Shape returned by Postgres, before it is mapped to our camelCase types. */
type CampaignRow = {
  id: string
  name: string
  created_at: string
}

const CAMPAIGN_COLUMNS = 'id, name, created_at'

function toCampaign(row: CampaignRow): Campaign {
  return { id: row.id, name: row.name, createdAt: row.created_at }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Campaigns the signed-in user is a member of. Row level security does the filtering. */
export async function listCampaigns(): Promise<Campaign[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaigns')
    .select(CAMPAIGN_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as CampaignRow[]).map(toCampaign)
}

/**
 * One campaign plus the user's role in it, or null when the campaign does not
 * exist or the user is not a member (row level security makes those identical).
 */
export async function getCampaignMembership(
  campaignId: string,
  userId: string,
): Promise<CampaignMembership | null> {
  if (!UUID_PATTERN.test(campaignId)) return null

  const supabase = requireSupabase()

  const [campaignResult, membershipResult] = await Promise.all([
    supabase.from('campaigns').select(CAMPAIGN_COLUMNS).eq('id', campaignId).maybeSingle(),
    supabase
      .from('campaign_memberships')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (campaignResult.error) throw campaignResult.error
  if (membershipResult.error) throw membershipResult.error

  // Row level security hides campaigns the user is not a member of, so either
  // result being empty means "not available to you".
  if (!campaignResult.data || !membershipResult.data) return null

  return {
    campaign: toCampaign(campaignResult.data as CampaignRow),
    role: (membershipResult.data as { role: CampaignRole }).role,
  }
}

/** Creates the campaign and the caller's owner membership in one transaction. */
export async function createCampaign(name: string): Promise<Campaign> {
  const supabase = requireSupabase()

  const { data, error } = await supabase.rpc('create_campaign', { p_name: name })

  if (error) throw error
  return toCampaign(data as CampaignRow)
}
