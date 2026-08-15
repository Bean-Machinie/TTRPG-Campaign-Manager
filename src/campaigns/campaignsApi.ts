import type { JSONContent } from '@tiptap/core'
import { requireSupabase } from '../lib/supabase/client'
import { todayIsoDate } from '../lib/format'
import { PROFILE_COLUMNS, personLabel } from '../profile/profileApi'
import { isAvatarPreset } from '../profile/avatarPresets'
import type { DocumentVisibility } from '../documents/visibility'
import { parseEntityData, parseEntitySecrets } from '../entities/entityData'
import type { EntitySecrets } from '../entities/entityData'
import { gameSystemDefinitionSchema } from '../entities/system'
import type {
  Campaign,
  CampaignInvitation,
  CampaignMember,
  CampaignMembership,
  CampaignDocument,
  CampaignDocumentSummary,
  CampaignEntity,
  CampaignEntitySummary,
  CampaignLocation,
  CampaignMap,
  CampaignNote,
  CampaignQuest,
  CampaignRole,
  CampaignSession,
  CampaignSummary,
  DocumentInput,
  DocumentType,
  EntityInput,
  EntityKind,
  EntityStatus,
  GameSystem,
  InvitableRole,
  LocationInput,
  MapInput,
  NoteInput,
  PendingInvitation,
  QuestInput,
  QuestStatus,
  SessionInput,
} from './types'

/**
 * The only file that knows about table and column names. Everything here maps
 * snake_case rows to the camelCase types the rest of the app uses.
 */

const CAMPAIGN_COLUMNS = 'id, name, created_at'

type CampaignRow = { id: string; name: string; created_at: string }
type MembershipRow = { id: string; user_id: string; role: CampaignRole }
type MemberProfileRow = {
  id: string
  email: string
  display_name: string | null
  avatar_path: string | null
  avatar_preset: string | null
}
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

  const avatarPaths = (profileData as MemberProfileRow[])
    .map((profile) => profile.avatar_path)
    .filter((path): path is string => Boolean(path))
  const avatarUrlByPath = new Map<string, string>()
  if (avatarPaths.length > 0) {
    const { data: signedAvatars } = await supabase.storage
      .from('profile-avatars')
      .createSignedUrls(avatarPaths, 60 * 60)
    for (const avatar of signedAvatars ?? []) {
      if (avatar.path && avatar.signedUrl) avatarUrlByPath.set(avatar.path, avatar.signedUrl)
    }
  }

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
        avatarPreset: isAvatarPreset(profile?.avatar_preset) ? profile.avatar_preset : null,
        avatarUrl: profile?.avatar_path ? (avatarUrlByPath.get(profile.avatar_path) ?? null) : null,
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

// -------------------------------------------------------------- entities --

/**
 * Never `select('*')` on this table.
 *
 * `secrets` is excluded from the grant that PostgREST reads with, so a star
 * select fails outright rather than quietly omitting the column. That is
 * deliberate — the failure is loud, and it is the reason this constant is
 * spelled out. Secrets come back from get_campaign_entity() or not at all.
 */
// One literal, unwrapped: supabase-js parses this string as a type, and a
// concatenation of two literals widens to `string` and defeats it.
// prettier-ignore
const ENTITY_SUMMARY_COLUMNS = 'id, name, kind, system_id, player_user_id, summary, visibility, status, author_id, level, challenge_rating, creature_type, updated_at'

type EntitySummaryRow = {
  id: string
  name: string
  kind: EntityKind
  system_id: string
  player_user_id: string | null
  summary: string | null
  visibility: DocumentVisibility
  status: EntityStatus
  author_id: string
  level: number | null
  challenge_rating: number | null
  creature_type: string | null
  updated_at: string
}

type EntityRow = EntitySummaryRow & {
  campaign_id: string
  data: unknown
  secrets: unknown
  created_at: string
}

type GameSystemRow = {
  id: string
  key: string
  name: string
  version: string
  definition: unknown
}

function toEntitySummary(row: EntitySummaryRow): CampaignEntitySummary {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    systemId: row.system_id,
    playerUserId: row.player_user_id,
    summary: row.summary,
    visibility: row.visibility,
    status: row.status,
    authorId: row.author_id,
    level: row.level,
    challengeRating: row.challenge_rating,
    creatureType: row.creature_type,
    updatedAt: row.updated_at,
  }
}

function toEntityRow(input: EntityInput) {
  return {
    name: input.name.trim(),
    kind: input.kind,
    system_id: input.systemId,
    // Only a PC belongs to a player; the check constraint rejects anything else.
    player_user_id: input.kind === 'pc' ? input.playerUserId : null,
    summary: input.summary?.trim() || null,
    visibility: input.visibility,
    data: input.data,
  }
}

/**
 * The rulesets available to build an entity in.
 *
 * Validated here rather than trusted, because a definition is content someone
 * pasted into a SQL editor: a typo in it should say so once, with the system's
 * name attached, instead of surfacing later as a blank Armor Class that nobody
 * can account for.
 */
export async function listGameSystems(): Promise<GameSystem[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('game_systems')
    .select('id, key, name, version, definition')
    .order('name', { ascending: true })

  if (error) throw error

  return (data as GameSystemRow[]).map((row) => {
    const parsed = gameSystemDefinitionSchema.safeParse(row.definition)

    if (!parsed.success) {
      const first = parsed.error.issues[0]
      throw new Error(
        `The "${row.name}" ruleset is not valid: ${first.path.join('.')} — ${first.message}`,
      )
    }

    return {
      id: row.id,
      key: row.key,
      name: row.name,
      version: row.version,
      definition: parsed.data,
    }
  })
}

/**
 * Entities of a campaign, player characters first and alphabetical within a
 * kind.
 *
 * Which rows come back is decided by public.can_read_visibility() in the select
 * policy, so nothing is filtered here — a player asking this question is never
 * sent a GM-only NPC to discard. Grouping by kind on the page is presentation,
 * not access control.
 */
export async function listCampaignEntities(
  campaignId: string,
): Promise<CampaignEntitySummary[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_entities')
    .select(ENTITY_SUMMARY_COLUMNS)
    .eq('campaign_id', campaignId)
    // A half-built character is not a character yet. Filtered here rather than
    // on the page, so that everything downstream of this one function — the
    // list, the command palette, anything counting entities — is spared having
    // to remember. There is exactly one query that wants the other status, and
    // it is the next function down.
    .eq('status', 'complete')
    .order('kind', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return (data as EntitySummaryRow[]).map(toEntitySummary)
}

/**
 * Characters somebody started and did not finish.
 *
 * Not filtered by author: the read policy has already decided what may be seen,
 * and a GM who can see your finished character can see your unfinished one. The
 * list page groups them by whose they are; that is presentation, as with kinds.
 *
 * Newest first, because the one you want is nearly always the one you were just
 * working on.
 */
export async function listEntityDrafts(
  campaignId: string,
): Promise<CampaignEntitySummary[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_entities')
    .select(ENTITY_SUMMARY_COLUMNS)
    .eq('campaign_id', campaignId)
    .eq('status', 'draft')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as EntitySummaryRow[]).map(toEntitySummary)
}

/**
 * One entity with its stats, or null when it is not readable by this user.
 *
 * Through the RPC rather than the table, for the same reason documents are:
 * row level security can decide whether you may see the row, but not whether
 * you may see one column of it. `secrets` comes back populated for a campaign
 * manager and as an empty object for everyone else, and that decision is made
 * in Postgres.
 */
export async function getCampaignEntity(entityId: string): Promise<CampaignEntity | null> {
  if (!UUID_PATTERN.test(entityId)) return null

  const supabase = requireSupabase()

  const { data, error } = await supabase
    .rpc('get_campaign_entity', { p_entity_id: entityId })
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as EntityRow

  return {
    ...toEntitySummary(row),
    campaignId: row.campaign_id,
    data: parseEntityData(row.data),
    secrets: parseEntitySecrets(row.secrets),
    createdAt: row.created_at,
  }
}

/**
 * Returns the new id, because creating an entity means opening it — or, for a
 * draft, because every step after the first is addressed by it.
 *
 * `status` is an argument here and nowhere else. Creation is the one moment
 * where "this is not finished yet" is genuinely being decided; every later
 * write is a save, and a save that could change this would eventually change it
 * by accident.
 */
export async function createEntity(
  campaignId: string,
  input: EntityInput,
  status: EntityStatus = 'complete',
): Promise<string> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_entities')
    .insert({ campaign_id: campaignId, status, ...toEntityRow(input) })
    .select('id')
    .single()

  if (error) throw error
  return (data as { id: string }).id
}

/**
 * The end of the wizard: a draft becomes a character.
 *
 * One column, on its own, rather than a flag on the final save. The last step
 * saves like every other step, and then this runs — so a completion that fails
 * leaves a draft that is merely still a draft, rather than a character saved
 * under a status nobody can account for.
 */
export async function completeEntity(entityId: string): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_entities')
    .update({ status: 'complete' })
    .eq('id', entityId)

  if (error) throw error
}

export async function updateEntity(entityId: string, input: EntityInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_entities')
    .update(toEntityRow(input))
    .eq('id', entityId)

  if (error) throw error
}

/**
 * The GM's half, written on its own.
 *
 * Separate from updateEntity() so that a player saving their own character
 * cannot write back the empty secrets object they were sent. The policies would
 * happily allow that write — it is their character — and the notes would be
 * gone with nothing raised. Splitting the call is what makes it impossible
 * rather than merely discouraged.
 */
export async function saveEntitySecrets(
  entityId: string,
  secrets: EntitySecrets,
): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_entities')
    .update({ secrets })
    .eq('id', entityId)

  if (error) throw error
}

export async function deleteEntity(entityId: string): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase.from('campaign_entities').delete().eq('id', entityId)
  if (error) throw error
}

// ------------------------------------------------------------- locations --

type LocationRow = {
  id: string
  name: string
  description: string | null
  created_at: string
}

function toLocationRow(input: LocationInput) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
  }
}

export async function listCampaignLocations(campaignId: string): Promise<CampaignLocation[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_locations')
    .select('id, name, description, created_at')
    .eq('campaign_id', campaignId)
    .order('name', { ascending: true })

  if (error) throw error

  return (data as LocationRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
  }))
}

export async function createLocation(campaignId: string, input: LocationInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_locations')
    .insert({ campaign_id: campaignId, ...toLocationRow(input) })

  if (error) throw error
}

export async function updateLocation(locationId: string, input: LocationInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_locations')
    .update(toLocationRow(input))
    .eq('id', locationId)

  if (error) throw error
}

export async function deleteLocation(locationId: string): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase.from('campaign_locations').delete().eq('id', locationId)
  if (error) throw error
}

// ---------------------------------------------------------------- quests --

type QuestRow = {
  id: string
  title: string
  status: QuestStatus
  description: string | null
  created_at: string
}

function toQuestRow(input: QuestInput) {
  return {
    title: input.title.trim(),
    status: input.status,
    description: input.description?.trim() || null,
  }
}

export async function listCampaignQuests(campaignId: string): Promise<CampaignQuest[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_quests')
    .select('id, title, status, description, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data as QuestRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    description: row.description,
    createdAt: row.created_at,
  }))
}

export async function createQuest(campaignId: string, input: QuestInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_quests')
    .insert({ campaign_id: campaignId, ...toQuestRow(input) })

  if (error) throw error
}

export async function updateQuest(questId: string, input: QuestInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_quests')
    .update(toQuestRow(input))
    .eq('id', questId)

  if (error) throw error
}

export async function deleteQuest(questId: string): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase.from('campaign_quests').delete().eq('id', questId)
  if (error) throw error
}

// ----------------------------------------------------------------- notes --

type NoteRow = {
  id: string
  title: string
  body: string | null
  author_id: string
  is_private: boolean
  created_at: string
}

function toNoteRow(input: NoteInput) {
  return {
    title: input.title.trim(),
    body: input.body?.trim() || null,
    is_private: input.isPrivate,
  }
}

/** Shared notes plus the user's own private ones. The policy does the filtering. */
export async function listCampaignNotes(campaignId: string): Promise<CampaignNote[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_notes')
    .select('id, title, body, author_id, is_private, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data as NoteRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    authorId: row.author_id,
    isPrivate: row.is_private,
    createdAt: row.created_at,
  }))
}

/** `author_id` is left to its `auth.uid()` default, which the policy also requires. */
export async function createNote(campaignId: string, input: NoteInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_notes')
    .insert({ campaign_id: campaignId, ...toNoteRow(input) })

  if (error) throw error
}

export async function updateNote(noteId: string, input: NoteInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase.from('campaign_notes').update(toNoteRow(input)).eq('id', noteId)
  if (error) throw error
}

export async function deleteNote(noteId: string): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase.from('campaign_notes').delete().eq('id', noteId)
  if (error) throw error
}

// ------------------------------------------------------------------ maps --

/** Must match the bucket created in the maps migration. */
export const MAPS_BUCKET = 'campaign-maps'

/** Kept in step with the bucket's own file_size_limit, to fail early and nicely. */
export const MAP_MAX_BYTES = 10 * 1024 * 1024

export const MAP_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

/** How long a map image URL stays valid, in seconds. */
const SIGNED_URL_TTL = 60 * 60

type MapRow = {
  id: string
  name: string
  storage_path: string
  location_id: string | null
  created_at: string
}

/**
 * Maps of a campaign, each with a freshly signed image URL. The bucket is
 * private, so there is no permanent URL to store — the links expire an hour
 * after this call.
 */
export async function listCampaignMaps(campaignId: string): Promise<CampaignMap[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_maps')
    .select('id, name, storage_path, location_id, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = data as MapRow[]
  if (rows.length === 0) return []

  const { data: signed, error: signError } = await supabase.storage
    .from(MAPS_BUCKET)
    .createSignedUrls(
      rows.map((row) => row.storage_path),
      SIGNED_URL_TTL,
    )

  // A failure to sign should not hide the maps themselves; the card renders
  // without its image instead.
  const urlByPath = new Map<string, string>()
  if (!signError && signed) {
    for (const item of signed) {
      if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl)
    }
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    storagePath: row.storage_path,
    locationId: row.location_id,
    signedUrl: urlByPath.get(row.storage_path) ?? null,
    createdAt: row.created_at,
  }))
}

function fileExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName
  return file.type === 'image/png' ? 'png' : 'jpg'
}

/**
 * Uploads the image, then records it. The path must start with the campaign id:
 * that is what the storage policies read to check membership.
 */
export async function createMap(
  campaignId: string,
  input: MapInput,
  file: File,
): Promise<void> {
  const supabase = requireSupabase()

  if (file.size > MAP_MAX_BYTES) {
    throw new Error('That image is larger than 10 MB.')
  }
  if (!MAP_ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Maps must be a PNG, JPEG, WebP or GIF image.')
  }

  const storagePath = `${campaignId}/${crypto.randomUUID()}.${fileExtension(file)}`

  const { error: uploadError } = await supabase.storage
    .from(MAPS_BUCKET)
    .upload(storagePath, file, { contentType: file.type })

  if (uploadError) throw uploadError

  const { error } = await supabase.from('campaign_maps').insert({
    campaign_id: campaignId,
    name: input.name.trim(),
    location_id: input.locationId,
    storage_path: storagePath,
  })

  if (error) {
    // Do not leave a file behind that nothing points at.
    await supabase.storage.from(MAPS_BUCKET).remove([storagePath])
    throw error
  }
}

/** Renames a map or re-points it at a location. The image itself is not replaced. */
export async function updateMap(mapId: string, input: MapInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_maps')
    .update({ name: input.name.trim(), location_id: input.locationId })
    .eq('id', mapId)

  if (error) throw error
}

/**
 * Removes the row first, then the file. If the second step fails the image is
 * orphaned in the bucket, which is invisible and harmless — the other order
 * would leave a map row pointing at nothing.
 */
export async function deleteMap(mapId: string, storagePath: string): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase.from('campaign_maps').delete().eq('id', mapId)
  if (error) throw error

  await supabase.storage.from(MAPS_BUCKET).remove([storagePath])
}

// ------------------------------------------------------------- documents --

/** What a new document starts as: one empty paragraph for the cursor to sit in. */
export const EMPTY_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

const DOCUMENT_SUMMARY_COLUMNS = 'id, title, doc_type, visibility, author_id, updated_at'

const DOCUMENT_COLUMNS = `${DOCUMENT_SUMMARY_COLUMNS}, content, created_at`

type DocumentSummaryRow = {
  id: string
  title: string
  doc_type: DocumentType
  visibility: DocumentVisibility
  author_id: string
  updated_at: string
}

type DocumentRow = DocumentSummaryRow & {
  content: JSONContent
  created_at: string
}

function toDocumentSummary(row: DocumentSummaryRow): CampaignDocumentSummary {
  return {
    id: row.id,
    title: row.title,
    docType: row.doc_type,
    visibility: row.visibility,
    authorId: row.author_id,
    updatedAt: row.updated_at,
  }
}

function toDocumentRow(input: DocumentInput) {
  return {
    title: input.title.trim(),
    doc_type: input.docType,
    visibility: input.visibility,
  }
}

/**
 * Documents of a campaign, most recently edited first.
 *
 * The bodies are left behind — see CampaignDocumentSummary. Which rows come
 * back is decided by public.can_read_visibility() in the select policy, so a
 * player asking this question is never sent a GM-only document to discard.
 * That is the whole design: nothing filters here, because nothing arrives that
 * would need filtering.
 */
export async function listCampaignDocuments(
  campaignId: string,
): Promise<CampaignDocumentSummary[]> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_documents')
    .select(DOCUMENT_SUMMARY_COLUMNS)
    .eq('campaign_id', campaignId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as DocumentSummaryRow[]).map(toDocumentSummary)
}

/** One document with its body, or null when it is not readable by this user. */
export async function getCampaignDocument(documentId: string): Promise<CampaignDocument | null> {
  if (!UUID_PATTERN.test(documentId)) return null

  const supabase = requireSupabase()

  let { data, error } = await supabase
    .rpc('get_campaign_document', { p_document_id: documentId })
    .maybeSingle()

  // Allows the frontend and migration to be deployed in either order. Once
  // the migration exists, direct reads of the content column are revoked.
  if (error?.code === 'PGRST202') {
    const legacy = await supabase
      .from('campaign_documents')
      .select(DOCUMENT_COLUMNS)
      .eq('id', documentId)
      .maybeSingle()
    data = legacy.data
    error = legacy.error
  }

  if (error) throw error
  if (!data) return null

  const row = data as DocumentRow

  return {
    ...toDocumentSummary(row),
    content: row.content,
    createdAt: row.created_at,
  }
}

/** Returns the new id, because creating a document means opening it. */
export async function createDocument(campaignId: string, input: DocumentInput): Promise<string> {
  const supabase = requireSupabase()

  const { data, error } = await supabase
    .from('campaign_documents')
    .insert({ campaign_id: campaignId, ...toDocumentRow(input), content: EMPTY_DOCUMENT })
    .select('id')
    .single()

  if (error) throw error
  return (data as { id: string }).id
}

/** Title, type and visibility. The body has its own call. */
export async function updateDocument(documentId: string, input: DocumentInput): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_documents')
    .update(toDocumentRow(input))
    .eq('id', documentId)

  if (error) throw error
}

/**
 * The autosave path. Separate from updateDocument() so that a save landing
 * mid-keystroke cannot write back a stale title, and so the block index — which
 * only ever needs rebuilding when the body changes — has one call to hang off.
 */
export async function saveDocumentContent(
  documentId: string,
  content: JSONContent,
): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase
    .from('campaign_documents')
    .update({ content })
    .eq('id', documentId)

  if (error) throw error
}

export async function deleteDocument(documentId: string): Promise<void> {
  const supabase = requireSupabase()

  const { error } = await supabase.from('campaign_documents').delete().eq('id', documentId)
  if (error) throw error
}
