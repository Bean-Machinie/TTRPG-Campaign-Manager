import { ENTITY_KIND_LABELS } from '../../../../../campaigns/types'
import type { EntityKind } from '../../../../../campaigns/types'
import { VISIBILITY_LABELS, VISIBILITY_TIERS } from '../../../../../documents/visibility'
import type { DocumentVisibility } from '../../../../../documents/visibility'
import { emptyEntityData } from '../../../../../entities/entityData'
import { useAuth } from '../../../../../auth/useAuth'
import { Input } from '../../../../../components/ui/Input'
import { ChoiceCards } from '../../../../../components/diceui/ChoiceCards'
import { ComboboxField } from '../../../../../components/diceui/ComboboxField'
import { Eye, LockKeyhole, PawPrint, Theater, UserRound, UsersRound } from 'lucide-react'
import type { StepProps } from '../stepProps'

/**
 * Step one: what this is.
 *
 * Three questions, and the third one is a formality — there is one ruleset. It
 * is asked anyway, because the alternative is that the day a second ruleset
 * exists, the question has nowhere to go and the answer is buried in whichever
 * component happened to default it. A step with one option is a seam; a missing
 * step is a rewrite.
 *
 * Changing `kind` re-seeds the rules blob, because the two kinds start from
 * genuinely different assumptions — a player character derives its numbers and
 * a creature asserts them — and carrying a half-filled PC into a statblock
 * would leave the `derive` flag saying something nobody chose.
 */
const KINDS = Object.keys(ENTITY_KIND_LABELS) as EntityKind[]

const KIND_DETAILS: Record<EntityKind, { description: string; icon: typeof UserRound }> = {
  pc: {
    description: 'A player-led hero with guided rules and derived statistics.',
    icon: UserRound,
  },
  npc: {
    description: 'A memorable ally, rival, or face you can create in moments.',
    icon: Theater,
  },
  creature: {
    description: 'An encounter-ready monster or custom statblock.',
    icon: PawPrint,
  },
}

const VISIBILITY_DETAILS: Record<DocumentVisibility, { description: string; icon: typeof Eye }> = {
  shared: { description: 'Everyone in the campaign can find it.', icon: UsersRound },
  gm_only: { description: 'Visible only to the campaign team.', icon: Eye },
  author_only: { description: 'Visible only to you.', icon: LockKeyhole },
}

export function SetupStep({ draft, onChange, canManage, systems, members }: StepProps) {
  const { user } = useAuth()
  const tiers = VISIBILITY_TIERS.filter((tier) => tier !== 'gm_only' || canManage)

  function setKind(kind: EntityKind) {
    onChange({
      kind,
      // A player character belongs to somebody; nothing else may.
      playerUserId: kind === 'pc' ? (draft.playerUserId ?? user?.id ?? null) : null,
      data: { ...emptyEntityData(kind), ...carryOver(draft) },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Input
        label="Character name"
        required
        maxLength={120}
        placeholder="Thalia Bramblefoot"
        value={draft.name}
        onChange={(event) => onChange({ name: event.target.value })}
      />

      {canManage ? (
        <ChoiceCards
          label="What are you creating?"
          description="This changes the pace of the next steps."
          value={draft.kind}
          onValueChange={(value) => setKind(value as EntityKind)}
          options={KINDS.map((kind) => {
            const detail = KIND_DETAILS[kind]
            const Icon = detail.icon
            return {
              value: kind,
              label: ENTITY_KIND_LABELS[kind],
              description: detail.description,
              icon: <Icon aria-hidden="true" />,
            }
          })}
        />
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <ComboboxField
          label="Ruleset"
          value={draft.systemId}
          onValueChange={(systemId) => onChange({ systemId })}
          options={systems.map((system) => ({
            value: system.id,
            label: system.name,
            description: 'Rules, progression, and available character options.',
          }))}
          hint={
            systems.length === 1
              ? 'This campaign currently uses one ruleset.'
              : 'Choose the rules this character follows.'
          }
        />

        {canManage && draft.kind === 'pc' ? (
          <ComboboxField
            label="Played by"
            value={draft.playerUserId ?? user?.id ?? ''}
            onValueChange={(playerUserId) => onChange({ playerUserId: playerUserId || null })}
            options={members.map((member) => ({
              value: member.userId,
              label: member.name,
              description: member.userId === user?.id ? 'You' : 'Campaign member',
            }))}
            placeholder="Choose a player…"
          />
        ) : null}
      </div>

      <ChoiceCards
        compact
        label="Who can see it?"
        value={draft.visibility}
        onValueChange={(visibility) => onChange({ visibility: visibility as DocumentVisibility })}
        options={tiers.map((tier) => {
          const detail = VISIBILITY_DETAILS[tier]
          const Icon = detail.icon
          return {
            value: tier,
            label: VISIBILITY_LABELS[tier],
            description: detail.description,
            icon: <Icon aria-hidden="true" />,
          }
        })}
      />
    </div>
  )
}

/**
 * What survives a change of kind.
 *
 * Anything the author typed rather than anything the rules inferred. Deciding a
 * character is really an NPC should not cost you the name of its species.
 */
function carryOver(draft: StepProps['draft']) {
  const { species, background, alignment, appearance, personality, backstory } = draft.data
  return { species, background, alignment, appearance, personality, backstory }
}
