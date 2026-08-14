import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ENTITY_KIND_LABELS,
  type CampaignMember,
  type EntityInput,
  type EntityKind,
  type GameSystem,
} from '../../../campaigns/types'
import { VISIBILITY_LABELS, VISIBILITY_TIERS } from '../../../documents/visibility'
import type { DocumentVisibility } from '../../../documents/visibility'
import {
  PROFICIENCY_BONUS_KEY,
  passiveKey,
  saveKey,
  skillKey,
  statKeys,
  statLabel,
} from '../../../entities/system'
import type { GameSystemDefinition } from '../../../entities/system'
import { deriveEntity } from '../../../entities/derive'
import {
  checkAgainstSystem,
  emptyEntityData,
  formatChallengeRating,
  formatModifier,
  parseChallengeRating,
} from '../../../entities/entityData'
import type { EntityData, EntitySecrets, Feature } from '../../../entities/entityData'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Textarea } from '../../../components/ui/Textarea'

/**
 * One form for every kind of entity.
 *
 * Not a wizard, and not three forms behind a switch. The fields that differ
 * between a player character and a dragon are the *contents* of two groups —
 * abilities and overrides — and both groups are drawn from the system
 * definition rather than written out here. So the form has no idea what 5e is,
 * which is the same claim the table and the derivation module make, held one
 * layer further up.
 *
 * The override inputs are the part worth looking at. Each one sits beside the
 * value the rules produce and takes it as its placeholder, so leaving the box
 * empty means "whatever the rules say" and typing in it means "no, this". That
 * is `override ?? computed` as a control rather than as a comment, and it is
 * why a statblock needs no separate editor: switch derivation off and every
 * placeholder empties, leaving a form that only accepts assertions.
 */

type EntityFormProps = {
  systems: GameSystem[]
  members: CampaignMember[]
  /** Owners and GMs may create NPCs, assign a PC to anyone, and keep secrets. */
  canManage: boolean
  currentUserId: string
  initialValue?: EntityInput
  initialSecrets?: EntitySecrets
  submitLabel: string
  busy: boolean
  onSubmit: (input: EntityInput, secrets: EntitySecrets | null) => void
  onCancel?: () => void
}

const KINDS = Object.keys(ENTITY_KIND_LABELS) as EntityKind[]

export function EntityForm({
  systems,
  members,
  canManage,
  currentUserId,
  initialValue,
  initialSecrets,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: EntityFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '')
  const [kind, setKind] = useState<EntityKind>(initialValue?.kind ?? (canManage ? 'npc' : 'pc'))
  const [systemId, setSystemId] = useState(initialValue?.systemId ?? systems[0]?.id ?? '')
  const [playerUserId, setPlayerUserId] = useState(initialValue?.playerUserId ?? '')
  const [summary, setSummary] = useState(initialValue?.summary ?? '')
  const [visibility, setVisibility] = useState<DocumentVisibility>(
    initialValue?.visibility ?? 'shared',
  )
  const [data, setData] = useState<EntityData>(
    initialValue?.data ?? emptyEntityData(canManage ? 'npc' : 'pc'),
  )

  const [trueName, setTrueName] = useState(initialSecrets?.trueName ?? '')
  const [gmNotes, setGmNotes] = useState(initialSecrets?.gmNotes ?? '')
  const [hiddenOverrides, setHiddenOverrides] = useState<Record<string, number>>(
    initialSecrets?.data?.overrides ?? {},
  )

  const system = systems.find((entry) => entry.id === systemId)
  const definition = system?.definition

  // What the rules currently say, recomputed on every keystroke. It is what the
  // override boxes show as their placeholder, so a character sheet reacts to a
  // changed ability score before it is saved.
  const sheet = definition ? deriveEntity(definition, data) : null

  const tiers = VISIBILITY_TIERS.filter((tier) => tier !== 'gm_only' || canManage)
  const problems = definition ? checkAgainstSystem(definition, data) : []

  function patch(changes: Partial<EntityData>) {
    setData((current) => ({ ...current, ...changes }))
  }

  function setOverride(key: string, value: number | null) {
    setData((current) => {
      const overrides = { ...current.overrides }
      if (value === null) delete overrides[key]
      else overrides[key] = value
      return { ...current, overrides }
    })
  }

  function setHiddenOverride(key: string, value: number | null) {
    setHiddenOverrides((current) => {
      const next = { ...current }
      if (value === null) delete next[key]
      else next[key] = value
      return next
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (problems.length > 0) return

    // A player can only ever write their own PC, so the fields they cannot see
    // are filled in for them. The database policies enforce the same rule.
    const input: EntityInput = {
      name,
      kind: canManage ? kind : 'pc',
      systemId,
      playerUserId: canManage ? playerUserId || null : currentUserId,
      summary: summary || null,
      visibility,
      data,
    }

    // Null rather than an empty object: "do not touch the secrets" and "clear
    // the secrets" are different instructions, and a player is only ever
    // allowed to give the first.
    const secrets: EntitySecrets | null = canManage
      ? {
          trueName: trueName.trim() || null,
          gmNotes: gmNotes.trim() || null,
          data: Object.keys(hiddenOverrides).length > 0 ? { overrides: hiddenOverrides } : null,
        }
      : null

    onSubmit(input, secrets)
  }

  if (systems.length === 0) {
    return (
      <Alert>
        No rulesets are available. The `game_systems` table needs its seed row before a
        character can be created.
      </Alert>
    )
  }

  return (
    <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
      <Group title="Identity">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Name"
            required
            maxLength={120}
            placeholder="Thalia Bramblefoot"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          {canManage ? (
            <Select
              label="Kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as EntityKind)}
            >
              {KINDS.map((option) => (
                <option key={option} value={option}>
                  {ENTITY_KIND_LABELS[option]}
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Ruleset"
            value={systemId}
            onChange={(event) => setSystemId(event.target.value)}
          >
            {systems.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </Select>

          <Select
            label="Who can see it"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as DocumentVisibility)}
          >
            {tiers.map((tier) => (
              <option key={tier} value={tier}>
                {VISIBILITY_LABELS[tier]}
              </option>
            ))}
          </Select>
        </div>

        {canManage && kind === 'pc' ? (
          <Select
            label="Played by"
            value={playerUserId}
            onChange={(event) => setPlayerUserId(event.target.value)}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </Select>
        ) : null}

        <Textarea
          label="Summary"
          placeholder="One line, for the list. Who they are at a glance."
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
      </Group>

      {definition ? (
        <>
          <Group
            title="Rules"
            hint="Whether the numbers below are worked out from the inputs, or simply asserted."
          >
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="mt-1"
                checked={data.derive}
                onChange={(event) => patch({ derive: event.target.checked })}
              />
              <span>
                Derive statistics from ability scores, level and proficiencies.
                <span className="block text-gray-500 dark:text-gray-400">
                  Leave this off for a statblock: nothing is computed, and every value is
                  whatever you type below.
                </span>
              </span>
            </label>
          </Group>

          <Group title="Description">
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Level"
                type="number"
                min={definition.levelRange.min}
                max={definition.levelRange.max}
                value={data.level ?? ''}
                onChange={(event) => patch({ level: numberOrNull(event.target.value) })}
              />
              <Input
                label="Challenge rating"
                placeholder="1/4"
                value={formatOptional(data.challengeRating)}
                onChange={(event) =>
                  patch({ challengeRating: parseChallengeRating(event.target.value) })
                }
              />
              <Datalist
                label="Creature type"
                options={definition.creatureTypes}
                value={data.creatureType ?? ''}
                onChange={(value) => patch({ creatureType: value || null })}
              />
              <Datalist
                label="Size"
                options={definition.sizes}
                value={data.size ?? ''}
                onChange={(value) => patch({ size: value || null })}
              />
              <Input
                label="Species"
                value={data.species ?? ''}
                onChange={(event) => patch({ species: event.target.value || null })}
              />
              <Input
                label="Background"
                value={data.background ?? ''}
                onChange={(event) => patch({ background: event.target.value || null })}
              />
              <Input
                label="Alignment"
                value={data.alignment ?? ''}
                onChange={(event) => patch({ alignment: event.target.value || null })}
              />
              <Input
                label="Speed"
                placeholder="30 ft."
                value={data.speed ?? ''}
                onChange={(event) => patch({ speed: event.target.value || null })}
              />
              <Input
                label="Senses"
                placeholder="darkvision 60 ft."
                value={data.senses ?? ''}
                onChange={(event) => patch({ senses: event.target.value || null })}
              />
              <Input
                label="Languages"
                value={data.languages ?? ''}
                onChange={(event) => patch({ languages: event.target.value || null })}
              />
              <Input
                label="Damage resistances"
                placeholder="fire, cold"
                value={data.damageResistances.join(', ')}
                onChange={(event) => patch({ damageResistances: toList(event.target.value) })}
              />
              <Input
                label="Damage immunities"
                value={data.damageImmunities.join(', ')}
                onChange={(event) => patch({ damageImmunities: toList(event.target.value) })}
              />
            </div>
          </Group>

          <Group title="Ability scores">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              {definition.abilities.map((ability) => (
                <Input
                  key={ability.key}
                  label={ability.abbr}
                  type="number"
                  min={definition.abilityScoreRange.min}
                  max={definition.abilityScoreRange.max}
                  value={data.abilities[ability.key] ?? ''}
                  onChange={(event) => {
                    const abilities = { ...data.abilities }
                    const value = numberOrNull(event.target.value)
                    if (value === null) delete abilities[ability.key]
                    else abilities[ability.key] = value
                    patch({ abilities })
                  }}
                />
              ))}
            </div>
          </Group>

          <Group
            title="Statistics"
            hint="Leave a box empty to take what the rules give. Type in it to say otherwise."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <OverrideField
                label={statLabel(definition, PROFICIENCY_BONUS_KEY)}
                computed={computedOf(sheet, PROFICIENCY_BONUS_KEY)}
                value={data.overrides[PROFICIENCY_BONUS_KEY]}
                onChange={(value) => setOverride(PROFICIENCY_BONUS_KEY, value)}
              />
              {definition.derived.map((stat) => (
                <OverrideField
                  key={stat.key}
                  label={stat.label}
                  computed={computedOf(sheet, stat.key)}
                  value={data.overrides[stat.key]}
                  onChange={(value) => setOverride(stat.key, value)}
                />
              ))}
              {definition.passiveSkills.map((skill) => (
                <OverrideField
                  key={skill}
                  label={statLabel(definition, passiveKey(skill))}
                  computed={computedOf(sheet, passiveKey(skill))}
                  value={data.overrides[passiveKey(skill)]}
                  onChange={(value) => setOverride(passiveKey(skill), value)}
                />
              ))}
            </div>
          </Group>

          <Group title="Saving throws">
            <ProficiencyTable
              definition={definition}
              rows={definition.abilities.map((ability) => ({
                key: ability.key,
                label: ability.name,
                statKey: saveKey(ability.key),
              }))}
              ranks={data.proficiencies.saves}
              onRank={(key, rank) =>
                patch({
                  proficiencies: {
                    ...data.proficiencies,
                    saves: withRank(data.proficiencies.saves, key, rank),
                  },
                })
              }
              overrides={data.overrides}
              onOverride={setOverride}
              sheet={sheet}
            />
          </Group>

          <Group title="Skills">
            <ProficiencyTable
              definition={definition}
              rows={definition.skills.map((skill) => ({
                key: skill.key,
                label: skill.name,
                statKey: skillKey(skill.key),
              }))}
              ranks={data.proficiencies.skills}
              onRank={(key, rank) =>
                patch({
                  proficiencies: {
                    ...data.proficiencies,
                    skills: withRank(data.proficiencies.skills, key, rank),
                  },
                })
              }
              overrides={data.overrides}
              onOverride={setOverride}
              sheet={sheet}
            />
          </Group>

          {definition.resources.length > 0 ? (
            <Group title="Resources">
              <div className="grid gap-3 sm:grid-cols-2">
                {definition.resources.map((resource) => {
                  const value = data.resources[resource.key]

                  return (
                    <div key={resource.key} className="grid grid-cols-2 gap-2">
                      <Input
                        label={`${resource.label} — now`}
                        type="number"
                        value={value?.current ?? ''}
                        onChange={(event) =>
                          patch({
                            resources: withResource(data.resources, resource.key, {
                              current: numberOrNull(event.target.value),
                              max: value?.max ?? null,
                            }),
                          })
                        }
                      />
                      {resource.track === 'pool' ? (
                        <Input
                          label="Max"
                          type="number"
                          value={value?.max ?? ''}
                          onChange={(event) =>
                            patch({
                              resources: withResource(data.resources, resource.key, {
                                current: value?.current ?? 0,
                                max: numberOrNull(event.target.value),
                              }),
                            })
                          }
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </Group>
          ) : null}

          <Group title="Traits">
            <FeatureEditor
              features={data.traits}
              addLabel="Add a trait"
              onChange={(traits) => patch({ traits })}
            />
          </Group>

          <Group title="Actions">
            <FeatureEditor
              features={data.actions}
              addLabel="Add an action"
              onChange={(actions) => patch({ actions })}
            />
          </Group>

          {canManage ? (
            <Group
              title="GM only"
              hint="Never sent to a player. The server decides that, not this form."
            >
              <Input
                label="True name"
                maxLength={120}
                placeholder="What it actually is"
                value={trueName}
                onChange={(event) => setTrueName(event.target.value)}
              />
              <Textarea
                label="GM notes"
                placeholder="Motivation, secrets, what it wants."
                value={gmNotes}
                onChange={(event) => setGmNotes(event.target.value)}
              />

              <fieldset>
                <legend className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  Hidden statistics — what the party has been told is above; what is true
                  goes here.
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {statKeys(definition).map((key) => (
                    <OverrideField
                      key={key}
                      label={statLabel(definition, key)}
                      computed={null}
                      value={hiddenOverrides[key]}
                      onChange={(value) => setHiddenOverride(key, value)}
                    />
                  ))}
                </div>
              </fieldset>
            </Group>
          ) : null}
        </>
      ) : null}

      {problems.length > 0 ? (
        <Alert>
          <ul className="list-disc pl-4">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy || name.trim().length === 0 || problems.length > 0}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}

// ------------------------------------------------------------- fragments --

function Group({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {hint ? <p className="text-sm text-gray-500 dark:text-gray-400">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

/**
 * A number box whose placeholder is what the rules would have said.
 *
 * The whole override model in one control: empty means "take the computed
 * value", filled means "no, this". Nothing has to explain that, because the
 * greyed-out number is sitting in the box the moment you look at it.
 */
function OverrideField({
  label,
  computed,
  value,
  onChange,
}: {
  label: string
  computed: number | null
  value: number | undefined
  onChange: (value: number | null) => void
}) {
  return (
    <Input
      label={label}
      type="number"
      placeholder={computed === null ? '—' : String(computed)}
      value={value ?? ''}
      onChange={(event) => onChange(numberOrNull(event.target.value))}
    />
  )
}

function ProficiencyTable({
  definition,
  rows,
  ranks,
  onRank,
  overrides,
  onOverride,
  sheet,
}: {
  definition: GameSystemDefinition
  rows: Array<{ key: string; label: string; statKey: string }>
  ranks: Record<string, string>
  onRank: (key: string, rank: string) => void
  overrides: Record<string, number>
  onOverride: (key: string, value: number | null) => void
  sheet: ReturnType<typeof deriveEntity> | null
}) {
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[1fr_9rem_6rem] items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">{row.label}</span>

          <select
            aria-label={`${row.label} proficiency`}
            className="field__input field__select"
            value={ranks[row.key] ?? ''}
            onChange={(event) => onRank(row.key, event.target.value)}
          >
            <option value="">Not proficient</option>
            {definition.proficiencyRanks
              .filter((rank) => rank.multiplier !== 0)
              .map((rank) => (
                <option key={rank.key} value={rank.key}>
                  {rank.name}
                </option>
              ))}
          </select>

          <input
            aria-label={`${row.label} value`}
            type="number"
            className="field__input"
            placeholder={formatModifier(computedOf(sheet, row.statKey))}
            value={overrides[row.statKey] ?? ''}
            onChange={(event) => onOverride(row.statKey, numberOrNull(event.target.value))}
          />
        </li>
      ))}
    </ul>
  )
}

function FeatureEditor({
  features,
  addLabel,
  onChange,
}: {
  features: Feature[]
  addLabel: string
  onChange: (features: Feature[]) => void
}) {
  function update(index: number, changes: Partial<Feature>) {
    onChange(features.map((feature, at) => (at === index ? { ...feature, ...changes } : feature)))
  }

  return (
    <div className="flex flex-col gap-3">
      {features.map((feature, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-800"
        >
          <Input
            label="Name"
            value={feature.name}
            onChange={(event) => update(index, { name: event.target.value })}
          />
          <Textarea
            label="Text"
            value={feature.text}
            onChange={(event) => update(index, { text: event.target.value })}
          />
          <div>
            <Button
              variant="secondary"
              onClick={() => onChange(features.filter((_, at) => at !== index))}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}

      <div>
        <Button variant="secondary" onClick={() => onChange([...features, { name: '', text: '' }])}>
          {addLabel}
        </Button>
      </div>
    </div>
  )
}

/**
 * A text box with suggestions behind it.
 *
 * The system's creature types and sizes are a vocabulary, not a constraint —
 * homebrew is the entire reason this feature has overrides — so they are
 * offered rather than enforced.
 */
function Datalist({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  const listId = `datalist-${label.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div>
      <Input
        label={label}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  )
}

// --------------------------------------------------------------- helpers --

/**
 * What the rules would say, ignoring what was typed.
 *
 * Deliberately the computed half rather than the displayed value: this is what
 * a placeholder shows, and a placeholder that echoed the override already in
 * the box would tell you nothing.
 */
function computedOf(sheet: ReturnType<typeof deriveEntity> | null, key: string): number | null {
  return sheet?.stats[key]?.computed ?? null
}

function numberOrNull(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const value = Number(trimmed)
  return Number.isFinite(value) ? Math.trunc(value) : null
}

function formatOptional(value: number | null): string {
  return value === null ? '' : formatChallengeRating(value)
}

function toList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function withRank(
  ranks: Record<string, string>,
  key: string,
  rank: string,
): Record<string, string> {
  const next = { ...ranks }
  if (rank) next[key] = rank
  else delete next[key]
  return next
}

function withResource(
  resources: EntityData['resources'],
  key: string,
  value: { current: number | null; max: number | null },
) {
  const next = { ...resources }

  if (value.current === null && value.max === null) delete next[key]
  else next[key] = { current: value.current ?? 0, max: value.max }

  return next
}
