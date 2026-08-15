import { useCallback, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../../../auth/useAuth'
import { useCampaignEntity, useGameSystems } from '../../../../campaigns/hooks'
import { completeEntity, deleteEntity, updateEntity } from '../../../../campaigns/campaignsApi'
import type { CampaignEntity, EntityInput } from '../../../../campaigns/types'
import { useAutosave } from '../../../../documents/useAutosave'
import { invalidateCampaignContents } from '../../../../components/shell/commands'
import { canEditEntity } from '../../../../entities/access'
import {
  formatChallengeRating,
  parseChallengeRating,
} from '../../../../entities/entityData'
import type { EntityData } from '../../../../entities/entityData'
import { errorMessage } from '../../../../lib/errors'
import { Alert } from '../../../../components/ui/Alert'
import { Button } from '../../../../components/ui/Button'
import { Input } from '../../../../components/ui/Input'
import { Textarea } from '../../../../components/ui/Textarea'
import { useCampaignOutlet } from '../useCampaignOutlet'

/**
 * The fifteen-second NPC.
 *
 * A GM inventing a shopkeeper in the middle of a session is not building a
 * character. They are writing one down, and everything the wizard does for a
 * player character — sequencing, dependencies, derived values reacting to
 * choices — is in the way of that. So this page asks for what a shopkeeper
 * actually needs and nothing else: a description, a challenge rating if it will
 * ever be fought, and a box to type or paste a statblock into.
 *
 * Nothing here is derived. `emptyEntityData` already starts an NPC with
 * `derive: false`, which means the sheet shows what was asserted and skips the
 * arithmetic entirely — the same mechanism a printed monster uses, not a
 * lesser mode. Anything worth computing can be filled in afterwards on the
 * detail page, where every structured field still is.
 */
export function QuickCreatePage() {
  const { draftId } = useParams()
  const { entity, loading, error } = useCampaignEntity(draftId)
  const { campaign } = useCampaignOutlet()

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
  }

  if (error) return <Alert>{error}</Alert>

  if (!entity) {
    return (
      <Alert>
        That draft does not exist, or it is not yours.{' '}
        <Link className="underline" to={`/app/campaigns/${campaign.id}/entities`}>
          Back to characters
        </Link>
      </Alert>
    )
  }

  if (entity.status === 'complete') {
    return <Navigate to={`/app/campaigns/${campaign.id}/entities/${entity.id}`} replace />
  }

  return <QuickForm key={entity.id} entity={entity} />
}

function QuickForm({ entity }: { entity: CampaignEntity }) {
  const { campaign, role } = useCampaignOutlet()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { systems } = useGameSystems()

  const [draft, setDraft] = useState<EntityInput>({
    name: entity.name,
    kind: entity.kind,
    systemId: entity.systemId,
    playerUserId: entity.playerUserId,
    summary: entity.summary,
    visibility: entity.visibility,
    data: entity.data,
  })

  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Autosaved like the wizard, and for a reason that is not symmetry: the link
  // at the foot of this page leads into the full sequence, and a link that
  // silently threw away what had been typed would be worse than no link.
  const save = useCallback((value: EntityInput) => updateEntity(entity.id, value), [entity.id])
  const { schedule } = useAutosave(save)

  if (!canEditEntity(entity, role, user?.id)) {
    return <Alert>This character is not yours to edit.</Alert>
  }

  const { name, summary, data } = { ...draft, summary: draft.summary ?? '' }
  const system = systems.find((entry) => entry.id === entity.systemId)
  const creature = entity.kind === 'creature'

  function update(changes: Partial<EntityInput>) {
    const next = { ...draft, ...changes }
    setDraft(next)
    schedule(next)
  }

  function patch(changes: Partial<EntityData>) {
    update({ data: { ...draft.data, ...changes } })
  }

  async function commit() {
    setActionError(null)
    setBusy(true)

    try {
      await updateEntity(entity.id, draft)
      await completeEntity(entity.id)
      invalidateCampaignContents(campaign.id)
      navigate(`/app/campaigns/${campaign.id}/entities/${entity.id}`, { replace: true })
    } catch (caught) {
      setActionError(errorMessage(caught, 'Could not save that character.'))
      setBusy(false)
    }
  }

  async function discard() {
    setBusy(true)
    try {
      await deleteEntity(entity.id)
      navigate(`/app/campaigns/${campaign.id}/entities`, { replace: true })
    } catch (caught) {
      setActionError(errorMessage(caught, 'Could not discard that draft.'))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {creature ? 'New creature' : 'New NPC'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enough to run them tonight. Everything else can wait.
        </p>
      </header>

      {actionError ? <Alert>{actionError}</Alert> : null}

      <Input
        label="Name"
        required
        maxLength={120}
        value={name}
        onChange={(event) => update({ name: event.target.value })}
      />

      <Textarea
        label="Description"
        hint="One line, for the list."
        placeholder="Runs the general store. Knows everybody's business."
        value={summary}
        onChange={(event) => update({ summary: event.target.value || null })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Challenge rating"
          placeholder="1/4"
          hint="Only if they will ever be fought."
          value={data.challengeRating === null ? '' : formatChallengeRating(data.challengeRating)}
          onChange={(event) =>
            patch({ challengeRating: parseChallengeRating(event.target.value) })
          }
        />
        <Input
          label="Level"
          type="number"
          min={1}
          value={data.level ?? ''}
          onChange={(event) => patch({ level: Number(event.target.value) || null })}
        />
      </div>

      <Textarea
        label="Statblock"
        rows={10}
        hint="Free text. Nothing here is worked out — it is shown exactly as typed."
        placeholder={'AC 12, HP 9 (2d8)\nSpeed 30 ft.\nPerception +3'}
        value={data.statblock ?? ''}
        onChange={(event) => patch({ statblock: event.target.value || null })}
      />

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || name.trim().length === 0} onClick={() => void commit()}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void discard()}>
          Discard
        </Button>
      </div>

      {system ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Nothing on this page is derived. Save and open the Sheet tab to give{' '}
          {name.trim() || 'them'} ability scores and computed statistics, or{' '}
          <Link
            className="underline"
            to={`/app/campaigns/${campaign.id}/entities/new/${entity.id}/class`}
          >
            build with full rules
          </Link>{' '}
          instead — the draft carries over.
        </p>
      ) : null}
    </div>
  )
}
