import {
  PROFICIENCY_BONUS_KEY,
  passiveKey,
  saveKey,
  skillKey,
} from './system'
import type { Expression, GameSystemDefinition } from './system'
import type { EntityData } from './entityData'

/**
 * Working the numbers out.
 *
 * Pure, and pure for a reason: this is the part of the feature that is actually
 * hard to get right, and the only way to know it is right is to run it a few
 * hundred times without a database, a session or a browser in the way. Nothing
 * in this module reads a clock, a network or a global. Give it a definition and
 * a blob and it gives back the same sheet every time.
 *
 * Every value it produces is a Derived<T>:
 *
 *   { computed: T | null, override: T | null }      display = override ?? computed
 *
 * Both halves are kept because both are true and the sheet wants to say so — a
 * character whose Armor Class is 17 by fiat and 12 by the rules is a character
 * whose player has house-ruled something, and hiding the 12 makes that
 * invisible. `computed: null` means "the rules have nothing to say here",
 * either because an input is missing or because derivation was switched off.
 *
 * That is what lets one function serve two things that look nothing alike. A
 * player character is inputs, and its Armor Class is computed. A monster
 * statblock is assertions, and its Armor Class is an override with `derive:
 * false` beside it, so the computed half is null and the display value is the
 * assertion. Same table, same code path, same renderer — the difference is one
 * boolean, not a second branch of the product.
 */

export type Derived<T> = {
  computed: T | null
  override: T | null
}

/** What the sheet shows. The only correct way to read a Derived<T>. */
export function displayValue<T>(derived: Derived<T>): T | null {
  return derived.override ?? derived.computed
}

/** Whether the displayed value disagrees with the rules. Worth a mark on the sheet. */
export function isOverridden(derived: Derived<number>): boolean {
  return derived.override !== null && derived.override !== derived.computed
}

export type AbilityReading = {
  score: number | null
  modifier: number | null
}

export type DerivedSheet = {
  /**
   * Scores and their modifiers, always present.
   *
   * Deliberately not Derived<T>, and deliberately still worked out when
   * `derive` is false. A modifier is not a derivation, it is a way of writing
   * the score down — every statblock ever printed says `STR 18 (+4)` — so
   * switching derivation off should not turn a dragon's Strength into a bare
   * number the reader has to convert in their head.
   */
  abilities: Record<string, AbilityReading>
  /**
   * Everything else, keyed by the namespace in system.ts: `proficiencyBonus`,
   * `save.<ability>`, `skill.<skill>`, `passive.<skill>`, and each of the
   * system's own derived stats.
   */
  stats: Record<string, Derived<number>>
}

export function deriveEntity(
  definition: GameSystemDefinition,
  data: EntityData,
): DerivedSheet {
  const abilities = readAbilities(definition, data)
  const stats = buildStats(definition, data, abilities)
  return { abilities, stats }
}

// ------------------------------------------------------------ abilities --

function readAbilities(
  definition: GameSystemDefinition,
  data: EntityData,
): Record<string, AbilityReading> {
  const { offset, divisor } = definition.abilityModifier
  const readings: Record<string, AbilityReading> = {}

  for (const ability of definition.abilities) {
    const raw = data.abilities[ability.key]
    const score = typeof raw === 'number' && Number.isFinite(raw) ? raw : null

    readings[ability.key] = {
      score,
      modifier: score === null ? null : Math.floor((score - offset) / divisor),
    }
  }

  return readings
}

// ---------------------------------------------------------------- stats --

function buildStats(
  definition: GameSystemDefinition,
  data: EntityData,
  abilities: Record<string, AbilityReading>,
): Record<string, Derived<number>> {
  const resolved = new Map<string, Derived<number>>()
  // Formulas may name other stats, and nothing stops a system definition from
  // naming its way round in a circle. A cycle resolves to "no computed value"
  // rather than to a stack overflow: a bad definition should cost you a blank
  // cell on one sheet, not the page.
  const visiting = new Set<string>()

  const rankMultipliers = new Map(
    definition.proficiencyRanks.map((rank) => [rank.key, rank.multiplier]),
  )
  const derivedByKey = new Map(definition.derived.map((stat) => [stat.key, stat]))
  const skillByKey = new Map(definition.skills.map((skill) => [skill.key, skill]))

  function overrideOf(key: string): number | null {
    const value = data.overrides[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  function resolve(key: string): Derived<number> {
    const cached = resolved.get(key)
    if (cached) return cached

    // Mid-cycle: the override still stands, because it is an assertion rather
    // than something worked out from the definition that is eating itself.
    if (visiting.has(key)) return { computed: null, override: overrideOf(key) }

    visiting.add(key)
    const computed = data.derive ? compute(key) : null
    visiting.delete(key)

    const derived: Derived<number> = { computed, override: overrideOf(key) }
    resolved.set(key, derived)
    return derived
  }

  /** What the sheet would show for another stat. Overrides propagate. */
  function display(key: string): number | null {
    return displayValue(resolve(key))
  }

  function modifierOf(ability: string): number | null {
    return abilities[ability]?.modifier ?? null
  }

  function proficiencyFor(rank: string | undefined): number | null {
    const multiplier = rank === undefined ? 0 : rankMultipliers.get(rank)
    if (multiplier === undefined) return null

    if (multiplier === 0) return 0

    const bonus = display(PROFICIENCY_BONUS_KEY)
    return bonus === null ? null : bonus * multiplier
  }

  function compute(key: string): number | null {
    if (key === PROFICIENCY_BONUS_KEY) {
      return proficiencyBonus(definition, data.level)
    }

    const [prefix, rest] = splitKey(key)

    if (prefix === 'save') {
      const modifier = modifierOf(rest)
      const proficiency = proficiencyFor(data.proficiencies.saves[rest])
      if (modifier === null || proficiency === null) return null
      return Math.floor(modifier + proficiency)
    }

    if (prefix === 'skill') {
      const skill = skillByKey.get(rest)
      if (!skill) return null

      const modifier = modifierOf(skill.ability)
      const proficiency = proficiencyFor(data.proficiencies.skills[rest])
      if (modifier === null || proficiency === null) return null
      return Math.floor(modifier + proficiency)
    }

    if (prefix === 'passive') {
      const skill = display(skillKey(rest))
      return skill === null ? null : definition.passiveBase + skill
    }

    const stat = derivedByKey.get(key)
    return stat ? evaluate(stat.formula) : null
  }

  /**
   * Null propagates rather than counting as zero.
   *
   * Armor Class on a character with no Dexterity score recorded is unknown, not
   * 10. Showing 10 would be the product inventing a number and then printing it
   * in the same weight as one it worked out, which is exactly the failure a
   * blank cell makes obvious.
   */
  function evaluate(expression: Expression): number | null {
    switch (expression.op) {
      case 'const':
        return expression.value
      case 'level':
        return data.level
      case 'proficiency':
        return display(PROFICIENCY_BONUS_KEY)
      case 'abilityMod':
        return modifierOf(expression.ability)
      case 'abilityScore':
        return abilities[expression.ability]?.score ?? null
      case 'stat':
        return display(expression.key)
      case 'sum':
      case 'min':
      case 'max': {
        const values: number[] = []
        for (const operand of expression.of) {
          const value = evaluate(operand)
          if (value === null) return null
          values.push(value)
        }
        if (expression.op === 'sum') return values.reduce((total, value) => total + value, 0)
        return expression.op === 'min' ? Math.min(...values) : Math.max(...values)
      }
    }
  }

  const stats: Record<string, Derived<number>> = {}

  stats[PROFICIENCY_BONUS_KEY] = resolve(PROFICIENCY_BONUS_KEY)
  for (const ability of definition.abilities) {
    stats[saveKey(ability.key)] = resolve(saveKey(ability.key))
  }
  for (const skill of definition.skills) {
    stats[skillKey(skill.key)] = resolve(skillKey(skill.key))
  }
  for (const skill of definition.passiveSkills) {
    stats[passiveKey(skill)] = resolve(passiveKey(skill))
  }
  for (const stat of definition.derived) {
    stats[stat.key] = resolve(stat.key)
  }

  return stats
}

/**
 * The bonus a level grants, from the table in the definition.
 *
 * A level outside the table has no answer rather than the nearest one: a
 * twenty-fifth-level character in a game whose table stops at twenty is a data
 * problem, and quietly handing back the level-20 row would hide it.
 */
export function proficiencyBonus(
  definition: GameSystemDefinition,
  level: number | null,
): number | null {
  if (level === null) return null

  const bonus = definition.proficiencyBonusByLevel[level - 1]
  return typeof bonus === 'number' ? bonus : null
}

function splitKey(key: string): [string, string] {
  const index = key.indexOf('.')
  return index === -1 ? ['', key] : [key.slice(0, index), key.slice(index + 1)]
}
