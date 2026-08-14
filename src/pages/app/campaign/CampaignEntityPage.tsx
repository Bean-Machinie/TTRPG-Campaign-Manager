import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../../auth/useAuth'
import {
  useCampaignEntity,
  useCampaignMembers,
  useGameSystems,
} from '../../../campaigns/hooks'
import { deleteEntity } from '../../../campaigns/campaignsApi'
import { ENTITY_KIND_LABELS } from '../../../campaigns/types'
import { VISIBILITY_BADGES, VISIBILITY_LABELS } from '../../../documents/visibility'
import { canEditEntity } from '../../../entities/access'
import { applyOverlay, formatChallengeRating } from '../../../entities/entityData'
import { errorMessage } from '../../../lib/errors'
import { Alert } from '../../../components/ui/Alert'
import { Button, ButtonLink } from '../../../components/ui/Button'
import { EntitySheet } from './EntitySheet'
import { useCampaignOutlet } from './useCampaignOutlet'

/**
 * One entity, as a page.
 *
 * The GM's copy and the player's copy are the same component. What differs is
 * what arrived: `secrets` comes back populated for a campaign manager and as an
 * empty shell for everybody else, decided in Postgres by get_campaign_entity()
 * before the row is sent. So the "GM only" panel below is not a permission
 * check — it is a check for whether there is anything in the box.
 */
export function CampaignEntityPage() {
  const { entityId } = useParams()
  const { campaign, role } = useCampaignOutlet()
  const { user } = useAuth()
  const navigate = useNavigate()

  const { entity, loading, error } = useCampaignEntity(entityId)
  const { systems, loading: systemsLoading, error: systemsError } = useGameSystems()
  const { members } = useCampaignMembers(campaign.id)

  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading || systemsLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
  }

  if (error || systemsError) {
    return <Alert>{error ?? systemsError}</Alert>
  }

  // Missing and not-yours are the same answer on purpose. "You do not have
  // permission to view this character" confirms there is one.
  if (!entity) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Character not found
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          It does not exist, or it is not shared with you.{' '}
          <Link className="underline" to={`/app/campaigns/${campaign.id}/entities`}>
            Back to characters
          </Link>
        </p>
      </div>
    )
  }

  const system = systems.find((entry) => entry.id === entity.systemId)

  if (!system) {
    return (
      <Alert>
        This character was built in a ruleset that is no longer available, so its statistics
        cannot be read.
      </Alert>
    )
  }

  // For a GM this lays the hidden statistics over the published ones. For
  // everyone else `secrets.data` is null and this is a no-op, which is the
  // point: the same call, and the server decided what it had to work with.
  const data = applyOverlay(entity.data, entity.secrets.data)

  const editable = canEditEntity(entity, role, user?.id)
  const badge = VISIBILITY_BADGES[entity.visibility]
  const playedBy = entity.playerUserId
    ? (members.find((member) => member.userId === entity.playerUserId)?.name ?? 'a member')
    : null

  const hasSecrets =
    entity.secrets.trueName !== null ||
    entity.secrets.gmNotes !== null ||
    entity.secrets.data !== null

  function handleDelete() {
    if (!entity) return
    if (!window.confirm(`Delete "${entity.name}"?`)) return

    setActionError(null)
    setBusy(true)

    deleteEntity(entity.id)
      // Absolute: React Router resolves `..` against the route hierarchy rather
      // than the URL, and would land on the campaign instead of the list.
      .then(() => navigate(`/app/campaigns/${campaign.id}/entities`))
      .catch((caught: unknown) => {
        setActionError(errorMessage(caught, 'Could not delete that character.'))
      })
      .finally(() => setBusy(false))
  }

  return (
    <div className="flex flex-col gap-8">
      {actionError ? <Alert>{actionError}</Alert> : null}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {entity.name}
            {badge ? (
              <span className="ml-2 rounded border border-gray-200 px-1.5 py-0.5 text-xs font-normal text-gray-500 dark:border-gray-700 dark:text-gray-400">
                {badge}
              </span>
            ) : null}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {[
              ENTITY_KIND_LABELS[entity.kind],
              system.name,
              playedBy ? `Played by ${playedBy}` : null,
              entity.challengeRating !== null
                ? `CR ${formatChallengeRating(entity.challengeRating)}`
                : null,
              VISIBILITY_LABELS[entity.visibility],
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        {editable ? (
          <div className="flex gap-2">
            <ButtonLink variant="secondary" to="edit">
              Edit
            </ButtonLink>
            <Button variant="secondary" disabled={busy} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        ) : null}
      </header>

      {entity.summary ? (
        <p className="text-gray-700 dark:text-gray-300">{entity.summary}</p>
      ) : null}

      <EntitySheet definition={system.definition} data={data} />

      {hasSecrets ? (
        <section className="rounded-md border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="text-xs font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
            GM only
          </h2>

          {entity.secrets.trueName ? (
            <p className="mt-2 text-sm text-gray-900 dark:text-gray-100">
              <span className="text-gray-500 dark:text-gray-400">Actually: </span>
              {entity.secrets.trueName}
            </p>
          ) : null}

          {entity.secrets.data ? (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              The statistics above include hidden values the party has not been shown.
            </p>
          ) : null}

          {entity.secrets.gmNotes ? (
            <p className="mt-2 text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {entity.secrets.gmNotes}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Attribution where the material is, with the full notice in Settings. */}
      {system.definition.license ? (
        <p className="border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          Rules from {system.name}, used under {system.definition.license.name}.{' '}
          <Link className="underline" to="/app/settings">
            Licences
          </Link>
        </p>
      ) : null}
    </div>
  )
}
