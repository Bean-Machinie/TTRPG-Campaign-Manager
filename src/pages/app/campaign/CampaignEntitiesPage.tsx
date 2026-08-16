import { Link } from 'react-router'
import { useAuth } from '../../../auth/useAuth'
import {
  useCampaignEntities,
  useCampaignMembers,
  useEntityDrafts,
} from '../../../campaigns/hooks'
import { ENTITY_KIND_LABELS, ENTITY_KIND_PLURALS } from '../../../campaigns/types'
import type { CampaignEntitySummary, EntityKind } from '../../../campaigns/types'
import { VISIBILITY_BADGES } from '../../../documents/visibility'
import { formatChallengeRating } from '../../../entities/entityData'
import { Alert } from '../../../components/ui/Alert'
import { ButtonLink } from '../../../components/ui/Button'
import { useCampaignOutlet } from './useCampaignOutlet'
import { readDraftPortrait } from './character/draftPortrait'
import './characterGallery.css'
import './character/characterExperience.css'

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
  const { drafts } = useEntityDrafts(campaign.id)
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

  function entityBadge(entity: CampaignEntitySummary): string {
    if (entity.kind === 'pc' && entity.level !== null) return `LV ${entity.level}`
    if (entity.kind !== 'pc' && entity.challengeRating !== null) {
      return `CR ${formatChallengeRating(entity.challengeRating)}`
    }
    return ENTITY_KIND_LABELS[entity.kind]
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="character-catalog__header">
        <div>
          <p className="character-builder__eyebrow">{campaign.name}</p>
          <h1>Cast & creatures</h1>
          <span>Every hero, ally, rival, and threat in one place.</span>
        </div>
        <ButtonLink to="new">New character</ButtonLink>
      </header>

      {error ? <Alert>{error}</Alert> : null}
      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading characters…</p>
      ) : null}

      {!loading && !error && entities.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Nobody here yet. Start with a player character or an NPC.
        </p>
      ) : null}

      {/*
        Unfinished characters, above the finished ones because they are the only
        thing on this page that is waiting on somebody. They are excluded from
        every other query — the list below, the command palette, anything that
        counts characters — by listCampaignEntities, so this is the one place
        they exist.
      */}
      {drafts.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Unfinished
          </h2>

          <ul className="character-draft-list">
            {drafts.map((entity) => (
              <li key={entity.id} className="character-draft-list__item">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    {entity.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {ENTITY_KIND_LABELS[entity.kind]} · started{' '}
                    {entity.authorId === user?.id
                      ? 'by you'
                      : `by ${nameByUserId.get(entity.authorId) ?? 'a member'}`}
                  </p>
                </div>

                {/*
                  `resume` is not a step. The wizard reads it as "wherever this
                  draft got to" and redirects to the earliest unfinished step,
                  which is the same question its guard already answers.

                  An NPC or a creature goes back to quick create instead,
                  because that is where it was almost certainly started; the
                  full wizard is one link away from there.
                */}
                <Link
                  className="text-sm underline underline-offset-2"
                  to={`new/${entity.id}/${entity.kind === 'pc' ? 'resume' : 'quick'}`}
                >
                  Resume
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {GROUPS.map((kind) => {
        const group = entities.filter((entity) => entity.kind === kind)
        if (group.length === 0) return null

        return (
          <section key={kind}>
            <div className="character-catalog__group-heading">
              <h2>{ENTITY_KIND_PLURALS[kind]}</h2>
              <span>{group.length}</span>
            </div>

            <ul className="character-gallery">
              {group.map((entity) => {
                const visibilityBadge = VISIBILITY_BADGES[entity.visibility]
                const portrait = readDraftPortrait(entity.id)

                return (
                  <li key={entity.id}>
                    <Link
                      to={entity.id}
                      className={`character-card character-card--${cardPalette(entity)}`}
                    >
                      <span className="character-card__art" aria-hidden="true">
                        <span className="character-card__monogram">
                          {initials(entity.name)}
                        </span>
                      </span>
                      {portrait ? (
                        <img className="character-card__portrait" src={portrait} alt="" />
                      ) : null}
                      <span className="character-card__scrim" aria-hidden="true" />

                      <span className="character-card__level">{entityBadge(entity)}</span>

                      <span className="character-card__content">
                        <span className="character-card__name">{entity.name}</span>
                        <span className="character-card__subtitle">
                          {entity.summary ?? meta(entity) ?? ENTITY_KIND_LABELS[entity.kind]}
                        </span>
                        <span className="character-card__rule" aria-hidden="true" />
                        <span className="character-card__meta">
                          <span>{ENTITY_KIND_LABELS[entity.kind]}</span>
                          {meta(entity) ? <span>{meta(entity)}</span> : null}
                          {/* Visibility is only labelled after access has already been granted. */}
                          {visibilityBadge ? <span>{visibilityBadge}</span> : null}
                        </span>
                      </span>
                    </Link>
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

const CARD_PALETTES = ['indigo', 'slate', 'violet', 'emerald', 'ember', 'ocean'] as const

function cardPalette(entity: CampaignEntitySummary) {
  let value = 0
  for (const character of `${entity.kind}:${entity.id}`) {
    value = (value * 31 + character.charCodeAt(0)) >>> 0
  }
  return CARD_PALETTES[value % CARD_PALETTES.length]
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
