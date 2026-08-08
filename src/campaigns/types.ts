/** Mirrors the `role` check constraint on public.campaign_memberships. */
export type CampaignRole = 'owner' | 'gm' | 'player'

/** Roles an invitation may offer. Ownership is not transferable this way. */
export type InvitableRole = 'gm' | 'player'

export type Campaign = {
  id: string
  name: string
  createdAt: string
}

/** A campaign in the dashboard list, with the date it was last played. */
export type CampaignSummary = Campaign & {
  lastPlayedOn: string | null
}

/** A campaign together with the current user's role in it. */
export type CampaignMembership = {
  campaign: Campaign
  role: CampaignRole
}

/** One person in a campaign. */
export type CampaignMember = {
  membershipId: string
  userId: string
  email: string
  displayName: string | null
  /** The display name when set, the email otherwise. What lists should show. */
  name: string
  role: CampaignRole
}

/** An outgoing invitation, as seen by a campaign owner. */
export type CampaignInvitation = {
  id: string
  email: string
  role: InvitableRole
  createdAt: string
}

/** An incoming invitation, as seen by the person invited. */
export type PendingInvitation = {
  id: string
  campaignId: string
  campaignName: string
  role: InvitableRole
  createdAt: string
}

export type CampaignSession = {
  id: string
  title: string
  /** A plain yyyy-mm-dd date, or null when the session is not scheduled yet. */
  scheduledFor: string | null
  notes: string | null
  createdAt: string
}

/** The editable fields of a session, shared by create and update. */
export type SessionInput = {
  title: string
  scheduledFor: string | null
  notes: string | null
}

/** Player character or non-player character. */
export type CharacterKind = 'pc' | 'npc'

export type CampaignCharacter = {
  id: string
  name: string
  kind: CharacterKind
  /** The member who plays this one. Null for NPCs and unassigned PCs. */
  playerUserId: string | null
  description: string | null
  createdAt: string
}

/** The editable fields of a character, shared by create and update. */
export type CharacterInput = {
  name: string
  kind: CharacterKind
  playerUserId: string | null
  description: string | null
}

export type CampaignLocation = {
  id: string
  name: string
  description: string | null
  createdAt: string
}

export type LocationInput = {
  name: string
  description: string | null
}

/** Mirrors the `status` check constraint on public.campaign_quests. */
export type QuestStatus = 'active' | 'completed' | 'abandoned'

export type CampaignQuest = {
  id: string
  title: string
  status: QuestStatus
  description: string | null
  createdAt: string
}

export type QuestInput = {
  title: string
  status: QuestStatus
  description: string | null
}

export type CampaignNote = {
  id: string
  title: string
  body: string | null
  authorId: string
  /** Private notes are readable only by their author. */
  isPrivate: boolean
  createdAt: string
}

export type NoteInput = {
  title: string
  body: string | null
  isPrivate: boolean
}
