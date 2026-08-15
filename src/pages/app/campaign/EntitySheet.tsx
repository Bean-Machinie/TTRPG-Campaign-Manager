import type { ReactNode } from 'react'
import {
  PROFICIENCY_BONUS_KEY,
  passiveKey,
  saveKey,
  skillKey,
  statLabel,
} from '../../../entities/system'
import type { GameSystemDefinition } from '../../../entities/system'
import { deriveEntity, displayValue, isOverridden } from '../../../entities/derive'
import type { Derived } from '../../../entities/derive'
import { formatChallengeRating, formatModifier } from '../../../entities/entityData'
import type { EntityData } from '../../../entities/entityData'

/**
 * An entity, read-only.
 *
 * One renderer for a level 3 rogue and for an adult red dragon, which is the
 * claim the data model makes and this component is where it is either true or
 * not. It is true because it never asks what kind of thing it is holding: it
 * asks the derivation module for a sheet, and prints what came back. A number
 * that was computed and a number that was asserted arrive in the same shape.
 *
 * Overridden values carry a small mark rather than being silently swapped in.
 * A GM who has house-ruled an Armor Class should be able to see that they did,
 * and a player looking at a statblock should be able to tell the difference
 * between "the rules say 15" and "the book says 15".
 *
 * Layout is deliberately plain: fields, not a character sheet. The mechanics
 * are freely usable; the published sheet's design is not, and this is not it.
 */

type EntitySheetProps = {
  definition: GameSystemDefinition
  data: EntityData
}

export function EntitySheet({ definition, data }: EntitySheetProps) {
  const sheet = deriveEntity(definition, data)

  const details = describe(data)
  const resources = definition.resources.filter((resource) => data.resources[resource.key])

  return (
    <div className="flex flex-col gap-8">
      {details.length > 0 ? (
        <section>
          <SectionTitle>Details</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {details.map(([term, value]) => (
              <div key={term}>
                <dt className="text-gray-500 dark:text-gray-400">{term}</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section>
        <SectionTitle>Abilities</SectionTitle>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {definition.abilities.map((ability) => {
            const reading = sheet.abilities[ability.key]

            return (
              <li
                key={ability.key}
                className="rounded-md border border-gray-200 p-2 text-center dark:border-gray-800"
              >
                <span className="block text-xs tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  {ability.abbr}
                </span>
                <span className="block text-lg font-semibold text-gray-900 tabular-nums dark:text-gray-100">
                  {reading.score ?? '—'}
                </span>
                <span className="block text-sm text-gray-500 tabular-nums dark:text-gray-400">
                  {formatModifier(reading.modifier)}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <SectionTitle>Statistics</SectionTitle>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            label="Proficiency bonus"
            derived={sheet.stats[PROFICIENCY_BONUS_KEY]}
            display="modifier"
          />
          {definition.derived.map((stat) => (
            <StatTile
              key={stat.key}
              label={stat.label}
              derived={sheet.stats[stat.key]}
              display={stat.display}
            />
          ))}
          {definition.passiveSkills.map((skill) => (
            <StatTile
              key={skill}
              label={statLabel(definition, passiveKey(skill))}
              derived={sheet.stats[passiveKey(skill)]}
              display="value"
            />
          ))}
        </ul>
      </section>

      {resources.length > 0 ? (
        <section>
          <SectionTitle>Resources</SectionTitle>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {resources.map((resource) => {
              const value = data.resources[resource.key]

              return (
                <li
                  key={resource.key}
                  className="rounded-md border border-gray-200 p-2 dark:border-gray-800"
                >
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {resource.label}
                  </span>
                  <span className="text-lg font-semibold text-gray-900 tabular-nums dark:text-gray-100">
                    {value.current}
                    {value.max !== null ? (
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                        {' / '}
                        {value.max}
                      </span>
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-8 sm:grid-cols-2">
        <section>
          <SectionTitle>Saving throws</SectionTitle>
          <ul className="text-sm">
            {definition.abilities.map((ability) => (
              <StatRow
                key={ability.key}
                label={ability.name}
                derived={sheet.stats[saveKey(ability.key)]}
                proficiency={data.proficiencies.saves[ability.key]}
                definition={definition}
              />
            ))}
          </ul>
        </section>

        <section>
          <SectionTitle>Skills</SectionTitle>
          <ul className="text-sm">
            {definition.skills.map((skill) => (
              <StatRow
                key={skill.key}
                label={skill.name}
                derived={sheet.stats[skillKey(skill.key)]}
                proficiency={data.proficiencies.skills[skill.key]}
                definition={definition}
              />
            ))}
          </ul>
        </section>
      </div>

      <FeatureList title="Traits" features={data.traits} />
      <FeatureList title="Actions" features={data.actions} />
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
      {children}
    </h3>
  )
}

function StatTile({
  label,
  derived,
  display,
}: {
  label: string
  derived: Derived<number> | undefined
  display: 'value' | 'modifier'
}) {
  return (
    <li className="rounded-md border border-gray-200 p-2 dark:border-gray-800">
      <span className="block text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-lg font-semibold text-gray-900 tabular-nums dark:text-gray-100">
        {formatStat(derived, display)}
      </span>
      {derived && isOverridden(derived) ? <OverrideMark derived={derived} /> : null}
    </li>
  )
}

function StatRow({
  label,
  derived,
  proficiency,
  definition,
}: {
  label: string
  derived: Derived<number> | undefined
  proficiency: string | undefined
  definition: GameSystemDefinition
}) {
  const rank = definition.proficiencyRanks.find((entry) => entry.key === proficiency)
  const trained = rank !== undefined && rank.multiplier > 0

  return (
    <li className="flex items-baseline justify-between gap-2 border-b border-gray-100 py-1 last:border-b-0 dark:border-gray-800">
      <span className="flex items-baseline gap-1.5 text-gray-700 dark:text-gray-300">
        <span
          aria-hidden="true"
          className={
            trained
              ? 'size-1.5 rounded-full bg-brand-600 dark:bg-brand-400'
              : 'size-1.5 rounded-full border border-gray-300 dark:border-gray-600'
          }
        />
        {label}
        {trained && rank.multiplier !== 1 ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">({rank.name})</span>
        ) : null}
      </span>
      <span className="font-medium text-gray-900 tabular-nums dark:text-gray-100">
        {formatStat(derived, 'modifier')}
        {derived && isOverridden(derived) ? <OverrideMark derived={derived} /> : null}
      </span>
    </li>
  )
}

/**
 * The mark on a value the rules disagree with.
 *
 * The computed number is in the title rather than on the page: the sheet's job
 * is to say what this character's Armor Class *is*, and what it would have been
 * is a footnote for whoever wants to know why.
 */
function OverrideMark({ derived }: { derived: Derived<number> }) {
  return (
    <span
      className="ml-1 text-xs text-brand-700 dark:text-brand-300"
      title={`Set by hand. The rules give ${derived.computed ?? 'no value'}.`}
    >
      ◆
    </span>
  )
}

function formatStat(derived: Derived<number> | undefined, display: 'value' | 'modifier') {
  if (!derived) return '—'

  const value = displayValue(derived)
  if (value === null) return '—'

  return display === 'modifier' ? formatModifier(value) : String(value)
}

function FeatureList({
  title,
  features,
}: {
  title: string
  features: EntityData['traits']
}) {
  if (features.length === 0) return null

  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <dl className="flex flex-col gap-3 text-sm">
        {features.map((feature, index) => (
          <div key={`${feature.name}-${index}`}>
            <dt className="font-semibold text-gray-900 dark:text-gray-100">{feature.name}</dt>
            <dd className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {feature.text}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** The descriptive half: what the rules never read but a reader wants first. */
function describe(data: EntityData): Array<[string, string]> {
  const details: Array<[string, string]> = []

  const push = (term: string, value: string | number | null) => {
    if (value !== null && value !== '') details.push([term, String(value)])
  }

  if (data.classes.length > 0) {
    push(
      'Class',
      data.classes
        .map((entry) => `${entry.name}${entry.subclass ? ` (${entry.subclass})` : ''} ${entry.level}`)
        .join(', '),
    )
  }

  push('Level', data.level)
  push('Species', data.species)
  push('Background', data.background)
  push('Alignment', data.alignment)
  push('Size', data.size)
  push('Type', data.creatureType)

  if (data.challengeRating !== null) {
    push('Challenge', formatChallengeRating(data.challengeRating))
  }

  push('Speed', data.speed)
  push('Senses', data.senses)
  push('Languages', data.languages)
  push('Resistances', data.damageResistances.join(', '))
  push('Immunities', data.damageImmunities.join(', '))
  push('Vulnerabilities', data.damageVulnerabilities.join(', '))
  push('Condition immunities', data.conditionImmunities.join(', '))

  // Worth saying out loud, because it changes what every other number on the
  // page means: whether the rules produced them or somebody wrote them down.
  details.push(['Rules', data.derive ? 'Derived from these inputs' : 'Statblock, as written'])

  return details
}
