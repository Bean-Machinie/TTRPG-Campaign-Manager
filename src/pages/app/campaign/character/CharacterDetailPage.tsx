import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../../../auth/useAuth'
import {
  useCampaignEntity,
  useCampaignMembers,
  useGameSystems,
} from '../../../../campaigns/hooks'
import {
  deleteEntity,
  saveEntitySecrets,
  updateEntity,
} from '../../../../campaigns/campaignsApi'
import { ENTITY_KIND_LABELS } from '../../../../campaigns/types'
import type { EntityInput } from '../../../../campaigns/types'
import { VISIBILITY_BADGES, VISIBILITY_LABELS } from '../../../../documents/visibility'
import { canEditEntity } from '../../../../entities/access'
import { applyOverlay, formatChallengeRating } from '../../../../entities/entityData'
import type { EntitySecrets } from '../../../../entities/entityData'
import { invalidateCampaignContents } from '../../../../components/shell/commands'
import { errorMessage } from '../../../../lib/errors'
import { Alert } from '../../../../components/ui/Alert'
import { Button } from '../../../../components/ui/Button'
import { useCampaignOutlet } from '../useCampaignOutlet'
import type { CharacterDetailContext } from './detailContext'

/**
 * One character, as four sections rather than one scroll.
 *
 * The old page printed everything a character had, in order, from ability
 * scores to GM notes, and the only way to reach the backstory was to go past
 * the skills. That is the same failure the creation form had for the opposite
 * reason: creation is a sequence and was shown as a heap, and reading is random
 * access and was shown as a queue.
 *
 * So the sections are routes. Someone who wants the backstory clicks
 * Description and gets a URL they can come back to; someone who is at the table
 * stays on Sheet. Tabs and not an accordion, because an accordion's state is
 * per-visit and a URL's is not.
 *
 * Editing happens inside the section that shows the thing being edited, which
 * is the other half of the split: there is no route from here back into the
 * wizard, and changing one ability score costs one click rather than seven
 * steps.
 */

const SECTIONS: Array<{ path: string; label: string; managersOnly?: boolean }> = [
  { path: 'sheet', label: 'Sheet' },
  { path: 'features', label: 'Features' },
  { path: 'description', label: 'Description' },
  // Hidden rather than gated: for anyone who is not a manager the server sends
  // an empty secrets object, so there would be nothing behind this tab anyway.
  { path: 'notes', label: 'GM notes', managersOnly: true },
]

export function CharacterDetailPage() {
  const { entityId } = useParams()
  const { campaign, role } = useCampaignOutlet()
  const { user } = useAuth()
  const navigate = useNavigate()

  const { entity, loading, error, reload } = useCampaignEntity(entityId)
  const { systems, loading: systemsLoading, error: systemsError } = useGameSystems()
  const { members } = useCampaignMembers(campaign.id)

  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const listHref = `/app/campaigns/${campaign.id}/entities`

  if (loading || systemsLoading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
  }

  if (error || systemsError) return <Alert>{error ?? systemsError}</Alert>

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
          <Link className="underline" to={listHref}>
            Back to characters
          </Link>
        </p>
      </div>
    )
  }

  // An unfinished character has no sheet worth reading. Sending it back to the
  // wizard is not a redirect around a missing page: the draft is literally
  // part-way through being made, and the wizard is where that continues.
  if (entity.status === 'draft') {
    return <Navigate to={`${listHref}/new/${entity.id}/setup`} replace />
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

  const editable = canEditEntity(entity, role, user?.id)
  const canManage = role !== 'player'
  const badge = VISIBILITY_BADGES[entity.visibility]
  const playedBy = entity.playerUserId
    ? (members.find((member) => member.userId === entity.playerUserId)?.name ?? 'a member')
    : null

  async function save(changes: Partial<EntityInput>) {
    if (!entity) return

    await updateEntity(entity.id, {
      name: entity.name,
      kind: entity.kind,
      systemId: entity.systemId,
      playerUserId: entity.playerUserId,
      summary: entity.summary,
      visibility: entity.visibility,
      // The public half, never the overlaid copy. See detailContext.
      data: entity.data,
      ...changes,
    })

    // Only when the row's own label could have moved. A backstory rewrite is
    // not something the sidebar is showing, and refetching a campaign's seven
    // lists to redraw a name that did not change is a request nobody asked for.
    if (changes.name !== undefined) invalidateCampaignContents(campaign.id)

    reload()
  }

  async function saveSecrets(secrets: EntitySecrets) {
    if (!entity) return

    await saveEntitySecrets(entity.id, secrets)
    reload()
  }

  function handleDelete() {
    if (!entity) return
    if (!window.confirm(`Delete "${entity.name}"?`)) return

    setActionError(null)
    setBusy(true)

    deleteEntity(entity.id)
      .then(() => {
        invalidateCampaignContents(campaign.id)
        navigate(listHref)
      })
      .catch((caught: unknown) => {
        setActionError(errorMessage(caught, 'Could not delete that character.'))
      })
      .finally(() => setBusy(false))
  }

  const context: CharacterDetailContext = {
    entity,
    system,
    display: applyOverlay(entity.data, entity.secrets.data),
    editable,
    canManage,
    save,
    saveSecrets,
  }

  const sections = SECTIONS.filter((section) => !section.managersOnly || canManage)

  return (
    <div className="flex flex-col gap-6">
      {actionError ? <Alert>{actionError}</Alert> : null}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {entity.name}
            {badge ? (
              <span className="ml-2 rounded-xs border border-gray-200 px-1.5 py-0.5 text-xs font-normal text-gray-500 dark:border-gray-700 dark:text-gray-400">
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
          <Button variant="secondary" disabled={busy} onClick={handleDelete}>
            Delete
          </Button>
        ) : null}
      </header>

      {entity.summary ? (
        <p className="text-gray-700 dark:text-gray-300">{entity.summary}</p>
      ) : null}

      <nav aria-label="Character sections" className="border-b border-gray-200 dark:border-gray-800">
        <ul className="-mb-px flex flex-wrap gap-4 text-sm">
          {sections.map((section) => (
            <li key={section.path}>
              <NavLink
                to={section.path}
                className={({ isActive }) =>
                  isActive
                    ? 'inline-block border-b-2 border-gray-900 py-2 font-semibold text-gray-900 dark:border-gray-100 dark:text-gray-100'
                    : 'inline-block border-b-2 border-transparent py-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                }
              >
                {section.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet context={context} />

      {/* Attribution where the material is, with the full notice on the profile page. */}
      {system.definition.license ? (
        <p className="border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          Rules from {system.name}, used under {system.definition.license.name}.{' '}
          <Link className="underline" to="/app/profile">
            Licences
          </Link>
        </p>
      ) : null}
    </div>
  )
}
