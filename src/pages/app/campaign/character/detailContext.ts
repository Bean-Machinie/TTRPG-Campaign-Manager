import { useOutletContext } from 'react-router'
import type { CampaignEntity, EntityInput, GameSystem } from '../../../../campaigns/types'
import type { EntityData, EntitySecrets } from '../../../../entities/entityData'

/**
 * What each section of the detail page is handed.
 *
 * Two copies of the character's data, and the difference between them is a
 * security property rather than a convenience:
 *
 *   display   the public data with the GM's overlay laid over it. What the
 *             reader should see, and for a player it is the same object.
 *   entity.data   the public half alone. What an edit must be based on.
 *
 * Editing the displayed copy would write the GM's hidden statistics back into
 * the column every member of the campaign can read — a leak with no error
 * message and no way to notice. So sections read `display` and write from
 * `entity.data`, and this comment is here because that is the kind of rule that
 * is obvious once and then quietly broken by the next person to add a field.
 */
export type CharacterDetailContext = {
  entity: CampaignEntity
  system: GameSystem
  /** Public data plus the GM overlay. For rendering only. */
  display: EntityData
  /** Whether to offer editing affordances at all. */
  editable: boolean
  /** Owners and GMs. Decides whether the GM notes tab exists. */
  canManage: boolean
  /** Save a partial change to the entity. Reloads the row on success. */
  save: (changes: Partial<EntityInput>) => Promise<void>
  saveSecrets: (secrets: EntitySecrets) => Promise<void>
}

export function useCharacterDetail() {
  return useOutletContext<CharacterDetailContext>()
}
