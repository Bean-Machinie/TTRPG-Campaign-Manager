import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '../../../auth/useAuth'
import {
  useCampaignEntity,
  useCampaignMembers,
  useGameSystems,
} from '../../../campaigns/hooks'
import { createEntity, saveEntitySecrets, updateEntity } from '../../../campaigns/campaignsApi'
import type { CampaignEntity, EntityInput } from '../../../campaigns/types'
import { canEditEntity } from '../../../entities/access'
import type { EntitySecrets } from '../../../entities/entityData'
import { errorMessage } from '../../../lib/errors'
import { Alert } from '../../../components/ui/Alert'
import { EntityForm } from './EntityForm'
import { useCampaignOutlet } from './useCampaignOutlet'

/**
 * Creating and editing, one page.
 *
 * `/entities/new` and `/entities/:entityId/edit` are the same component with
 * and without something loaded. They were two files for about ten minutes: the
 * only difference is which call the submit handler makes, and everything before
 * that — the form, the permissions, the ruleset list — was identical twice.
 */
export function CampaignEntityEditPage() {
  const { entityId } = useParams()
  const { entity, loading, error } = useCampaignEntity(entityId)

  if (entityId && loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
  }

  if (error) return <Alert>{error}</Alert>

  if (entityId && !entity) {
    return (
      <Alert>That character does not exist, or it is not shared with you.</Alert>
    )
  }

  // Remounted per entity so the form's fields are seeded once and owned by it
  // from there, the way the document editor is.
  return <Editor key={entity?.id ?? 'new'} entity={entity ?? null} />
}

function Editor({ entity }: { entity: CampaignEntity | null }) {
  const { campaign, role } = useCampaignOutlet()
  const { user } = useAuth()
  const navigate = useNavigate()

  const { systems, loading, error } = useGameSystems()
  const { members } = useCampaignMembers(campaign.id)

  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canManage = role === 'owner' || role === 'gm'

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading rulesets…</p>
  }

  if (error) return <Alert>{error}</Alert>

  if (entity && !canEditEntity(entity, role, user?.id)) {
    return <Alert>This character is not yours to edit.</Alert>
  }

  // Absolute rather than relative. React Router resolves `..` against the route
  // hierarchy and not the URL, so from `entities/:entityId/edit` — one route
  // with a three-segment path — it lands on the campaign, not on the character
  // you were editing.
  const listHref = `/app/campaigns/${campaign.id}/entities`

  async function save(input: EntityInput, secrets: EntitySecrets | null) {
    setActionError(null)
    setBusy(true)

    try {
      if (entity) {
        await updateEntity(entity.id, input)
        // A second call rather than a second column in the first, so that a
        // player saving their own character cannot write an empty secrets
        // object back over the GM's notes. `null` means "leave them alone".
        if (secrets) await saveEntitySecrets(entity.id, secrets)
        navigate(`${listHref}/${entity.id}`, { replace: true })
        return
      }

      const id = await createEntity(campaign.id, input)
      if (secrets) await saveEntitySecrets(id, secrets)
      navigate(`${listHref}/${id}`, { replace: true })
    } catch (caught) {
      setActionError(errorMessage(caught, 'Could not save that character.'))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        {entity ? `Edit ${entity.name}` : 'New character'}
      </h1>

      {actionError ? <Alert>{actionError}</Alert> : null}

      <EntityForm
        systems={systems}
        members={members}
        canManage={canManage}
        currentUserId={user?.id ?? ''}
        initialValue={
          entity
            ? {
                name: entity.name,
                kind: entity.kind,
                systemId: entity.systemId,
                playerUserId: entity.playerUserId,
                summary: entity.summary,
                visibility: entity.visibility,
                data: entity.data,
              }
            : undefined
        }
        initialSecrets={entity?.secrets}
        submitLabel={entity ? 'Save changes' : 'Create character'}
        busy={busy}
        onSubmit={(input, secrets) => void save(input, secrets)}
        onCancel={() => navigate(entity ? `${listHref}/${entity.id}` : listHref)}
      />
    </div>
  )
}
