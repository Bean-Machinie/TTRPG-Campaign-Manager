import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  BookOpenText,
  EyeOff,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
import { deriveEntity, displayValue } from '../../../../entities/derive'
import { applyOverlay, formatChallengeRating, formatModifier } from '../../../../entities/entityData'
import type { EntitySecrets } from '../../../../entities/entityData'
import { PROFICIENCY_BONUS_KEY } from '../../../../entities/system'
import { invalidateCampaignContents } from '../../../../components/shell/commands'
import { errorMessage } from '../../../../lib/errors'
import { Alert } from '../../../../components/ui/Alert'
import { Button } from '../../../../components/ui/Button'
import { useCampaignOutlet } from '../useCampaignOutlet'
import type { CharacterDetailContext } from './detailContext'
import { readDraftPortrait } from './draftPortrait'
import './characterExperience.css'

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

const SECTIONS: Array<{ path: string; label: string; icon: LucideIcon; managersOnly?: boolean }> = [
  { path: 'sheet', label: 'Sheet', icon: Shield },
  { path: 'features', label: 'Features', icon: Sparkles },
  { path: 'description', label: 'Story', icon: BookOpenText },
  // Hidden rather than gated: for anyone who is not a manager the server sends
  // an empty secrets object, so there would be nothing behind this tab anyway.
  { path: 'notes', label: 'GM notes', icon: EyeOff, managersOnly: true },
]

export function CharacterDetailPage() {
  const { entityId } = useParams()
  const { campaign, role } = useCampaignOutlet()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

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

  const display = applyOverlay(entity.data, entity.secrets.data)
  const context: CharacterDetailContext = {
    entity,
    system,
    display,
    editable,
    canManage,
    save,
    saveSecrets,
  }

  const sections = SECTIONS.filter((section) => !section.managersOnly || canManage)
  const sheet = deriveEntity(system.definition, display)
  const portrait = readDraftPortrait(entity.id)
  const characterClass = display.classes[0]
  const heroStats = [
    {
      label: 'Hit points',
      value: display.resources.hitPoints?.max ?? '—',
    },
    {
      label: 'Proficiency',
      value: sheetValue(sheet, PROFICIENCY_BONUS_KEY, true),
    },
    ...system.definition.derived.slice(0, 2).map((stat) => ({
      label: stat.label,
      value: sheetValue(sheet, stat.key, stat.display === 'modifier'),
    })),
  ]

  return (
    <div className="character-overview flex flex-col gap-5">
      {actionError ? <Alert>{actionError}</Alert> : null}

      <Link className="character-overview__back" to={listHref}>
        <ArrowLeft aria-hidden="true" />
        Back to the cast
      </Link>

      <header className="character-overview__hero">
        <div className="character-overview__portrait">
          {portrait ? (
            <img src={portrait} alt={`${entity.name} portrait`} />
          ) : (
            <span className="character-overview__monogram" aria-hidden="true">
              {initials(entity.name)}
            </span>
          )}
        </div>

        <div className="character-overview__identity">
          <p className="character-overview__eyebrow">
            {characterClass?.name ?? ENTITY_KIND_LABELS[entity.kind]}
            {display.level !== null ? ` · Level ${display.level}` : ''}
          </p>
          <div className="character-overview__title-row">
            <div>
              <h1 className="character-overview__title">{entity.name}</h1>
              <div className="character-overview__badges">
                {display.species ? <span className="character-overview__badge">{display.species}</span> : null}
                {display.background ? <span className="character-overview__badge">{display.background}</span> : null}
                {playedBy ? <span className="character-overview__badge">Played by {playedBy}</span> : null}
                {entity.challengeRating !== null ? (
                  <span className="character-overview__badge">
                    CR {formatChallengeRating(entity.challengeRating)}
                  </span>
                ) : null}
                {badge ? <span className="character-overview__badge">{badge}</span> : null}
                <span className="character-overview__badge">{VISIBILITY_LABELS[entity.visibility]}</span>
              </div>
            </div>

            {editable ? (
              <Button
                className="character-overview__delete"
                variant="secondary"
                disabled={busy}
                onClick={handleDelete}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            ) : null}
          </div>

          <p className="character-overview__summary">
            {entity.summary ?? identityFallback(display.species, characterClass?.name)}
          </p>

          <div className="character-overview__stats" aria-label="At a glance">
            {heroStats.map((stat) => (
              <div key={stat.label} className="character-overview__stat">
                <span className="character-overview__stat-label">{stat.label}</span>
                <span className="character-overview__stat-value">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <nav aria-label="Character sections" className="character-overview__nav-shell">
        <ul className="character-overview__nav">
          {sections.map((section) => (
            <li key={section.path}>
              <NavLink
                to={section.path}
                className={({ isActive }) =>
                  isActive
                    ? 'character-overview__tab character-overview__tab--active'
                    : 'character-overview__tab'
                }
              >
                <section.icon aria-hidden="true" />
                {section.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="character-overview__content">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Outlet context={context} />
          </motion.div>
        </AnimatePresence>
      </main>

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

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function sheetValue(
  sheet: ReturnType<typeof deriveEntity>,
  key: string,
  asModifier: boolean,
): string {
  const derived = sheet.stats[key]
  const value = derived ? displayValue(derived) : null
  if (value === null) return '—'
  return asModifier ? formatModifier(value) : String(value)
}

function identityFallback(species: string | null, characterClass: string | undefined) {
  const identity = [species, characterClass].filter(Boolean).join(' ')
  return identity ? `A ${identity} whose story is still unfolding.` : 'Their story is still unfolding.'
}
