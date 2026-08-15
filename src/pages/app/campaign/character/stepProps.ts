import type { CampaignMember, GameSystem } from '../../../../campaigns/types'
import type { EntityData } from '../../../../entities/entityData'
import type { WizardContext, WizardDraft } from '../../../../entities/wizard/steps'

/**
 * What every step is given, and all it is given.
 *
 * No step navigates, saves, or knows which number it is. Each one is a form
 * over part of the draft that reports changes upward; the container owns
 * sequencing, persistence and the guard. That is what makes the steps
 * rearrangeable — a seventh one, or a different order for a different ruleset,
 * is a change to the list in the wizard module and nothing else.
 */
export type StepProps = {
  draft: WizardDraft
  context: WizardContext
  /** Change the draft's own fields: name, kind, ruleset, visibility. */
  onChange: (changes: Partial<WizardDraft>) => void
  /** Change the rules blob, which is where most of a character lives. */
  onPatchData: (changes: Partial<EntityData>) => void
  /** For assigning a player character. Empty when the user cannot manage. */
  members: CampaignMember[]
  canManage: boolean
  systems: GameSystem[]
}
