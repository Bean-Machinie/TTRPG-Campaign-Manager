import type { CampaignEntitySummary, CampaignRole } from '../campaigns/types'

/**
 * Whether to show someone the writing affordances.
 *
 * This is not the access rule. `can_write_visibility()` and the kind/ownership
 * clause beside it in the entities migration are, and they run on every write
 * whatever this function returns. What it decides is whether to offer an Edit
 * button that would only produce a failed request.
 *
 * It lives here rather than in a page because two pages ask it — the list and
 * the sheet — and a second copy would be the kind that drifts one clause at a
 * time until the button appears for someone the database will refuse.
 */
export function canEditEntity(
  entity: Pick<CampaignEntitySummary, 'authorId' | 'kind' | 'playerUserId' | 'visibility'>,
  role: CampaignRole,
  userId: string | undefined,
): boolean {
  if (userId === undefined) return false

  // Yours because you wrote it, or yours because you play it.
  if (entity.authorId === userId) return true
  if (entity.kind === 'pc' && entity.playerUserId === userId) return true

  // A manager may edit anything except somebody's private entity — the tier
  // whose whole point is that a GM does not get to read it, and a thing you
  // cannot read is not a thing you may rewrite.
  return role !== 'player' && entity.visibility !== 'author_only'
}
