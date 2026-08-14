import { Link } from 'react-router'
import { useAuth } from '../../../auth/useAuth'
import { useCampaignEntities, useCampaignMembers } from '../../../campaigns/hooks'
import { ENTITY_KIND_PLURALS } from '../../../campaigns/types'
import type { CampaignEntitySummary, EntityKind } from '../../../campaigns/types'
import { VISIBILITY_BADGES } from '../../../documents/visibility'
import { formatChallengeRating } from '../../../entities/entityData'
import { Alert } from '../../../components/ui/Alert'
import { ButtonLink } from '../../../components/ui/Button'
import { useCampaignOutlet } from './useCampaignOutlet'

/**
 * Everyone and everything in a campaign, in one list.
 *
 * Grouped by kind rather than filtered by it: a GM opening this page wants to
 * see the party and the monsters at once, and three tabs would make comparing
 * them a navigation problem. The grouping is presentation — which rows arrived
 * at all was decided by public.can_read_visibility() in the select policy, so
 * there is nothing here that hides anything, and no count of what you cannot
 * see either.
 */

const GROUPS: EntityKind[] = ['pc', 'npc', 'creature']

export function CampaignEntitiesPage() {
  const { campaign } = useCampaignOutlet()
  const { user } = useAuth()

  const { entities, loading, error } = useCampaignEntities(campaign.id)
  const { members } = useCampaignMembers(campaign.id)

  const nameByUserId = new Map(members.map((member) => [member.userId, member.name]))

  function meta(entity: CampaignEntitySummary): string {
    const parts: string[] = []

    if (entity.kind === 'pc') {
      if (entity.level !== null) parts.push(`Level ${entity.level}`)
      parts.push(
        entity.playerUserId === user?.id
          ? 'Yours'
          : entity.playerUserId
            ? `Played by ${nameByUserId.get(entity.playerUserId) ?? 'a member'}`
            : 'Unassigned',
      )
    } else {
      if (entity.challengeRating !== null) {
        parts.push(`CR ${formatChallengeRating(entity.challengeRating)}`)
      }
      if (entity.creatureType) parts.push(entity.creatureType)
    }

    return parts.join(' · ')
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <ButtonLink to="new">New character</ButtonLink>
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading characters…</p>
      ) : null}

      {!loading && !error && entities.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Nobody here yet. Start with a player character or an NPC.
        </p>
      ) : null}

      {GROUPS.map((kind) => {
        const group = entities.filter((entity) => entity.kind === kind)
        if (group.length === 0) return null

        return (
          <section key={kind}>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
              {ENTITY_KIND_PLURALS[kind]}
            </h2>

            <ul className="divide-y divide-gray-100 border-y border-gray-100 dark:divide-gray-800 dark:border-gray-800">
              {group.map((entity) => {
                const badge = VISIBILITY_BADGES[entity.visibility]

                return (
                  <li key={entity.id} className="py-3">
                    <h3 className="font-medium">
                      <Link
                        to={entity.id}
                        className="text-gray-900 underline-offset-2 hover:underline dark:text-gray-100"
                      >
                        {entity.name}
                      </Link>
                      {/*
                        Only ever a badge on something the reader can already
                        see. There is no "3 hidden" line, because a count of
                        NPCs you cannot open still tells you they exist.
                      */}
                      {badge ? (
                        <span className="ml-2 rounded border border-gray-200 px-1.5 py-0.5 text-xs font-normal text-gray-500 dark:border-gray-700 dark:text-gray-400">
                          {badge}
                        </span>
                      ) : null}
                    </h3>

                    <p className="text-sm text-gray-500 dark:text-gray-400">{meta(entity)}</p>

                    {entity.summary ? (
                      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                        {entity.summary}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
