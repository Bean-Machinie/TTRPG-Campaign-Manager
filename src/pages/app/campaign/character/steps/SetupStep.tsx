import { ENTITY_KIND_LABELS } from '../../../../../campaigns/types'
import type { EntityKind } from '../../../../../campaigns/types'
import { VISIBILITY_LABELS, VISIBILITY_TIERS } from '../../../../../documents/visibility'
import type { DocumentVisibility } from '../../../../../documents/visibility'
import { emptyEntityData } from '../../../../../entities/entityData'
import { Input } from '../../../../../components/ui/Input'
import { Select } from '../../../../../components/ui/Select'
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

export function SetupStep({ draft, onChange, canManage, systems, members }: StepProps) {
  const tiers = VISIBILITY_TIERS.filter((tier) => tier !== 'gm_only' || canManage)

  function setKind(kind: EntityKind) {
    onChange({
      kind,
      // A player character belongs to somebody; nothing else may.
      playerUserId: kind === 'pc' ? draft.playerUserId : null,
      data: { ...emptyEntityData(kind), ...carryOver(draft) },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Name"
        required
        maxLength={120}
        placeholder="Thalia Bramblefoot"
        value={draft.name}
        onChange={(event) => onChange({ name: event.target.value })}
      />

      {canManage ? (
        <Select
          label="Kind"
          hint="An NPC or a creature can be written down in fifteen seconds instead of seven steps."
          value={draft.kind}
          onChange={(event) => setKind(event.target.value as EntityKind)}
        >
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {ENTITY_KIND_LABELS[kind]}
            </option>
          ))}
        </Select>
      ) : null}

      <Select
        label="Ruleset"
        hint={
          systems.length === 1
            ? 'One ruleset is installed. More can be added later without rebuilding this.'
            : undefined
        }
        value={draft.systemId}
        onChange={(event) => onChange({ systemId: event.target.value })}
      >
        {systems.map((system) => (
          <option key={system.id} value={system.id}>
            {system.name}
          </option>
        ))}
      </Select>

      {canManage && draft.kind === 'pc' ? (
        <Select
          label="Played by"
          value={draft.playerUserId ?? ''}
          onChange={(event) => onChange({ playerUserId: event.target.value || null })}
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </Select>
      ) : null}

      <Select
        label="Who can see it"
        value={draft.visibility}
        onChange={(event) => onChange({ visibility: event.target.value as DocumentVisibility })}
      >
        {tiers.map((tier) => (
          <option key={tier} value={tier}>
            {VISIBILITY_LABELS[tier]}
          </option>
        ))}
      </Select>
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
