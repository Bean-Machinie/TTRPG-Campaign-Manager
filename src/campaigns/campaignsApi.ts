import { requireSupabase } from '../lib/supabase/client'
import { todayIsoDate } from '../lib/format'
import { PROFILE_COLUMNS, personLabel } from '../profile/profileApi'
import type {
  Campaign,
  CampaignInvitation,
  CampaignMember,
  CampaignMembership,
  CampaignCharacter,
  CampaignRole,
  CampaignSession,
  CampaignSummary,
  CharacterInput,
  CharacterKind,
  InvitableRole,
  PendingInvitation,
  SessionInput,
} from './types'

/**
 * The only file that knows about table and column names. Everything here maps
 * snake_case rows to the camelCase types the rest of the app uses.
 */

const CAMPAIGN_COLUMNS = 'id, name, created_at'

type CampaignRow = { id: string; name: string; created_at: string }
type MembershipRow = { id: string; user_id: string; role: CampaignRole }
type MemberProfileRow = { id: string; email: string; display_name: string | null }
type InvitationRow = {
  id: string
  campaign_id: string
  email: string
  role: InvitableRole
  created_at: string
}

function toCampaign(row: CampaignRow): Campaign {
  return { id: row.id, name: row.name, createdAt: row.created_at }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ------------------------------------------------------------- campaigns --

/**
 * Campaigns the signed-in user is a member of, each with the date it was last
 * played. Row level security does the filtering.
 */
export async function listCampaigns(): Promise<CampaignSummary[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaigns')
    .select(CAMPAIGN_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error

  const campaigns = (data as CampaignRow[]).map(toCampaign)
  if (campaigns.length === 0) return []

  // Every past session across the user's campaigns, reduced to the latest per
  // campaign. Postgres could do this in one grouped view; at this size a second
  // query and a Map is less machinery to maintain.
  const { data: sessionData, error: sessionError } = await supabase
    .from('campaign_sessions')
    .select('campaign_id, scheduled_for')
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', todayIsoDate())

  if (sessionError) throw sessionError

  const lastPlayedByCampaign = new Map<string, string>()
  for (const row of sessionData as { campaign_id: string; scheduled_for: string }[]) {
    const current = lastPlayedByCampaign.get(row.campaign_id)
    if (!current || row.scheduled_for > current) {
      lastPlayedByCampaign.set(row.campaign_id, row.scheduled_for)
    }
  }

  return campaigns.map((campaign) => ({
    ...campaign,
    lastPlayedOn: lastPlayedByCampaign.get(campaign.id) ?? null,
  }))
}

/**
 * One campaign plus the user's role in it, or null when the campaign does not
 * exist, is not shared with them, or is only offered through a pending
 * invitation they have not accepted yet.
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

// --------------------------------------------------------------- members --

const ROLE_ORDER: Record<CampaignRole, number> = { owner: 0, gm: 1, player: 2 }

/** Members of a campaign, owner first. Emails come from public.profiles. */
export async function listCampaignMembers(campaignId: string): Promise<CampaignMember[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_memberships')
    .select('id, user_id, role')
    .eq('campaign_id', campaignId)

  if (error) throw error

  const memberships = data as MembershipRow[]
  if (memberships.length === 0) return []

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .in(
      'id',
      memberships.map((membership) => membership.user_id),
    )

  if (profileError) throw profileError

  const profileByUserId = new Map(
    (profileData as MemberProfileRow[]).map((profile) => [profile.id, profile]),
  )

  return memberships
    .map((membership) => {
      const profile = profileByUserId.get(membership.user_id)
      const email = profile?.email ?? 'Unknown user'
      const displayName = profile?.display_name ?? null

      return {
        membershipId: membership.id,
        userId: membership.user_id,
        email,
        displayName,
        name: personLabel(displayName, email),
        role: membership.role,
      }
    })
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name))
}

/** Removes a member, or leaves the campaign. Owners cannot be removed. */
export async function removeMember(membershipId: string): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase.from('campaign_memberships').delete().eq('id', membershipId)
  if (error) throw error
}

// ----------------------------------------------------------- invitations --

/** Outgoing invitations for a campaign. Only its owner sees any. */
export async function listCampaignInvitations(campaignId: string): Promise<CampaignInvitation[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_invitations')
    .select('id, campaign_id, email, role, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data as InvitationRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  }))
}

export async function inviteToCampaign(
  campaignId: string,
  email: string,
  role: InvitableRole,
): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase.from('campaign_invitations').insert({
    campaign_id: campaignId,
    email: email.trim().toLowerCase(),
    role,
  })

  if (error) {
    // Unique violation on (campaign_id, email).
    if (error.code === '23505') {
      throw new Error('That address has already been invited to this campaign.')
    }
    throw error
  }
}

/** Used both by an owner revoking an invitation and an invitee declining one. */
export async function deleteInvitation(invitationId: string): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase.from('campaign_invitations').delete().eq('id', invitationId)
  if (error) throw error
}

/**
 * Invitations addressed to the signed-in user. Filtering by email matters:
 * a campaign owner can also read the invitations they sent, and those are not
 * invitations *to* them.
 */
export async function listPendingInvitations(email: string): Promise<PendingInvitation[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_invitations')
    .select('id, campaign_id, email, role, created_at')
    .eq('email', email.trim().toLowerCase())
    .order('created_at', { ascending: false })

  if (error) throw error

  const invitations = data as InvitationRow[]
  if (invitations.length === 0) return []

  // The campaigns policy lets invitees read the campaigns they were invited to.
  const { data: campaignData, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, name')
    .in(
      'id',
      invitations.map((invitation) => invitation.campaign_id),
    )

  if (campaignError) throw campaignError

  const nameByCampaignId = new Map(
    (campaignData as { id: string; name: string }[]).map((campaign) => [campaign.id, campaign.name]),
  )

  return invitations.map((invitation) => ({
    id: invitation.id,
    campaignId: invitation.campaign_id,
    campaignName: nameByCampaignId.get(invitation.campaign_id) ?? 'Unknown campaign',
    role: invitation.role,
    createdAt: invitation.created_at,
  }))
}

/** Joins the campaign and consumes the invitation in one transaction. */
export async function acceptInvitation(invitationId: string): Promise<Campaign> {
  const supabase = requireSupabase()

  const { data, error } = await supabase.rpc('accept_invitation', {
    p_invitation_id: invitationId,
  })

  if (error) throw error
  return toCampaign(data as CampaignRow)
}

// -------------------------------------------------------------- sessions --

const SESSION_COLUMNS = 'id, title, scheduled_for, notes, created_at'

type SessionRow = {
  id: string
  title: string
  scheduled_for: string | null
  notes: string | null
  created_at: string
}

function toSession(row: SessionRow): CampaignSession {
  return {
    id: row.id,
    title: row.title,
    scheduledFor: row.scheduled_for,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

/** Trims the form values and turns empty strings into nulls. */
function toSessionRow(input: SessionInput) {
  return {
    title: input.title.trim(),
    scheduled_for: input.scheduledFor?.trim() || null,
    notes: input.notes?.trim() || null,
  }
}

/** Sessions of a campaign, newest date first. Undated ones come last. */
export async function listCampaignSessions(campaignId: string): Promise<CampaignSession[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_sessions')
    .select(SESSION_COLUMNS)
    .eq('campaign_id', campaignId)
    .order('scheduled_for', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as SessionRow[]).map(toSession)
}

export async function createSession(campaignId: string, input: SessionInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_sessions')
    .insert({ campaign_id: campaignId, ...toSessionRow(input) })

  if (error) throw error
}

export async function updateSession(sessionId: string, input: SessionInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_sessions')
    .update(toSessionRow(input))
    .eq('id', sessionId)

  if (error) throw error
}

export async function deleteSession(sessionId: string): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase.from('campaign_sessions').delete().eq('id', sessionId)
  if (error) throw error
}

// ------------------------------------------------------------ characters --

const CHARACTER_COLUMNS = 'id, name, kind, player_user_id, description, created_at'

type CharacterRow = {
  id: string
  name: string
  kind: CharacterKind
  player_user_id: string | null
  description: string | null
  created_at: string
}

function toCharacter(row: CharacterRow): CampaignCharacter {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    playerUserId: row.player_user_id,
    description: row.description,
    createdAt: row.created_at,
  }
}

function toCharacterRow(input: CharacterInput) {
  return {
    name: input.name.trim(),
    kind: input.kind,
    // Only a PC belongs to a player; the policies reject anything else.
    player_user_id: input.kind === 'pc' ? input.playerUserId : null,
    description: input.description?.trim() || null,
  }
}

export async function listCampaignCharacters(campaignId: string): Promise<CampaignCharacter[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_characters')
    .select(CHARACTER_COLUMNS)
    .eq('campaign_id', campaignId)
    .order('name', { ascending: true })

  if (error) throw error
  return (data as CharacterRow[]).map(toCharacter)
}

export async function createCharacter(campaignId: string, input: CharacterInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_characters')
    .insert({ campaign_id: campaignId, ...toCharacterRow(input) })

  if (error) throw error
}

export async function updateCharacter(characterId: string, input: CharacterInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_characters')
    .update(toCharacterRow(input))
    .eq('id', characterId)

  if (error) throw error
}

export async function deleteCharacter(characterId: string): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase.from('campaign_characters').delete().eq('id', characterId)
  if (error) throw error
}
