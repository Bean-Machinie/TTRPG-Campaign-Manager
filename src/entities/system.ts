import { z } from 'zod'

/**
 * What a game system is, as data.
 *
 * The premise of the entities feature is that no rule lives in a column. There
 * is no `strength` field in the database and none in this file either; there is
 * a row in `game_systems` whose `definition` says that Strength exists, that
 * Athletics is governed by it, and that Armor Class is ten plus the Dexterity
 * modifier. This module is the schema that row must satisfy, and nothing more.
 *
 * The division of labour is worth stating once, because it is the thing most
 * likely to be got wrong later:
 *
 *   in the definition   what varies between systems — the ability list, the
 *                       skill list and what governs each, the proficiency
 *                       table, the formula for Armor Class
 *   in derive.ts        what is structural — a modifier from a score, a save as
 *                       modifier plus proficiency, a skill as modifier plus
 *                       proficiency times rank, a passive as ten plus a skill
 *
 * Writing the eighteen skill formulas out longhand in JSON would be
 * transcription rather than configuration, and every system that has skills at
 * all computes them the same way. So the definition supplies the *lists* and
 * the derivation module applies the *rule* to them.
 *
 * `derived` is for the rest: a small tree of closed operations, evaluated by
 * that same module. It is deliberately not an expression language. Data that
 * can compute arbitrarily is a program, and a program in a database row is a
 * thing you cannot review.
 */

/** Ability, skill, stat and resource handles. Identifiers, not prose. */
const keySchema = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9]*$/, 'Keys are letters and digits, starting with a letter')

// ------------------------------------------------------------- formulas --

/**
 * One node of a derived-stat formula.
 *
 * Hand-written rather than inferred from the schema below, because the type is
 * recursive and because this list *is* the vocabulary — a reader deciding
 * whether a system can be expressed should be able to read it in one place.
 *
 * `stat` reads another derived value, and reads its *displayed* value: an
 * override on Armor Class is visible to anything computed from Armor Class.
 * That is what makes a homebrew override propagate instead of being quietly
 * ignored one step later.
 */
export type Expression =
  | { op: 'const'; value: number }
  | { op: 'level' }
  | { op: 'proficiency' }
  | { op: 'abilityMod'; ability: string }
  | { op: 'abilityScore'; ability: string }
  | { op: 'stat'; key: string }
  | { op: 'sum'; of: Expression[] }
  | { op: 'min'; of: Expression[] }
  | { op: 'max'; of: Expression[] }

export const expressionSchema: z.ZodType<Expression> = z.lazy(() =>
  z.discriminatedUnion('op', [
    z.object({ op: z.literal('const'), value: z.number() }),
    z.object({ op: z.literal('level') }),
    z.object({ op: z.literal('proficiency') }),
    z.object({ op: z.literal('abilityMod'), ability: keySchema }),
    z.object({ op: z.literal('abilityScore'), ability: keySchema }),
    z.object({ op: z.literal('stat'), key: keySchema }),
    z.object({ op: z.literal('sum'), of: z.array(expressionSchema).min(1) }),
    z.object({ op: z.literal('min'), of: z.array(expressionSchema).min(1) }),
    z.object({ op: z.literal('max'), of: z.array(expressionSchema).min(1) }),
  ]),
)

/** Every ability and stat a formula names. Used to validate a definition. */
export function expressionReferences(expression: Expression): {
  abilities: string[]
  stats: string[]
} {
  const abilities: string[] = []
  const stats: string[] = []

  function walk(node: Expression) {
    switch (node.op) {
      case 'abilityMod':
      case 'abilityScore':
        abilities.push(node.ability)
        return
      case 'stat':
        stats.push(node.key)
        return
      case 'sum':
      case 'min':
      case 'max':
        node.of.forEach(walk)
        return
      default:
        return
    }
  }

  walk(expression)
  return { abilities, stats }
}

// ----------------------------------------------------------- definition --

export const abilitySchema = z.object({
  key: keySchema,
  name: z.string().min(1).max(60),
  /** Three letters, for the column heading a sheet has room for. */
  abbr: z.string().min(1).max(6),
})

export const skillSchema = z.object({
  key: keySchema,
  name: z.string().min(1).max(60),
  /** The ability whose modifier this skill is built on. */
  ability: keySchema,
})

/**
 * How proficient someone is, as a multiplier of the proficiency bonus.
 *
 * A list rather than a boolean because expertise doubles it, and a system that
 * has half-proficiency has 0.5 without needing a third concept.
 */
export const proficiencyRankSchema = z.object({
  key: keySchema,
  name: z.string().min(1).max(60),
  multiplier: z.number(),
})

export const derivedStatSchema = z.object({
  key: keySchema,
  label: z.string().min(1).max(60),
  formula: expressionSchema,
  /**
   * How to write the number down. Initiative is `+2` and Armor Class is `15`,
   * and which of those a stat is cannot be worked out from its formula — Armor
   * Class is built from a modifier and is not one. So the system says.
   */
  display: z.enum(['value', 'modifier']).default('value'),
})

export const resourceSchema = z.object({
  key: keySchema,
  label: z.string().min(1).max(60),
  /** `pool` spends down against a maximum; `counter` only ever has a value. */
  track: z.enum(['pool', 'counter']),
})

/**
 * Attribution, carried with the ruleset rather than hardcoded in a component.
 *
 * The 5e definition is SRD material under CC-BY-4.0, and the notice has to
 * appear wherever that material does. Keeping it here means the requirement is
 * satisfied by the same row that creates the obligation — a system added later
 * brings its own notice, or has none to bring.
 */
export const licenseSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().max(400).optional(),
  sourceUrl: z.string().max(400).optional(),
  /** Developer-friendly conversion used to verify the app's catalog. */
  referenceUrl: z.string().max(400).optional(),
  notice: z.string().min(1).max(4000),
})

export const gameSystemDefinitionSchema = z
  .object({
    /** `floor((score - offset) / divisor)`. The d20 family's rule, as numbers. */
    abilityModifier: z
      .object({ offset: z.number(), divisor: z.number().refine((n) => n !== 0) })
      .default({ offset: 10, divisor: 2 }),

    abilities: z.array(abilitySchema).min(1),
    abilityScoreRange: z
      .object({ min: z.number().int(), max: z.number().int() })
      .default({ min: 1, max: 99 }),

    skills: z.array(skillSchema).default([]),
    /** Skills that also get a passive score, at `passiveBase` plus the skill. */
    passiveSkills: z.array(keySchema).default([]),
    /**
     * What a passive score counts up from. Ten, in every d20 system, which is
     * why the 5e definition does not bother to say so — but it is a number the
     * rules chose rather than one arithmetic requires, so it is a field with a
     * default rather than a constant in the evaluator.
     */
    passiveBase: z.number().default(10),

    /** Indexed by level, so element 0 is level 1. */
    proficiencyBonusByLevel: z.array(z.number()).min(1),
    levelRange: z
      .object({ min: z.number().int(), max: z.number().int() })
      .default({ min: 1, max: 20 }),
    proficiencyRanks: z.array(proficiencyRankSchema).min(1),

    derived: z.array(derivedStatSchema).default([]),
    resources: z.array(resourceSchema).default([]),

    /** Vocabularies the forms offer as choices. Suggestions, not constraints. */
    sizes: z.array(z.string()).default([]),
    creatureTypes: z.array(z.string()).default([]),
    damageTypes: z.array(z.string()).default([]),
    conditions: z.array(z.string()).default([]),

    license: licenseSchema.optional(),
  })
  // Everything below catches a definition that parses but cannot be evaluated:
  // a skill governed by an ability that does not exist yields NaN at the far
  // end of the derivation, and a NaN on a character sheet is a bug report that
  // takes an afternoon to trace back to a typo in a JSON blob.
  .superRefine((definition, ctx) => {
    const abilityKeys = new Set(definition.abilities.map((ability) => ability.key))
    const skillKeys = new Set(definition.skills.map((skill) => skill.key))
    const derivedKeys = new Set(definition.derived.map((stat) => stat.key))

    duplicates(definition.abilities.map((a) => a.key)).forEach((key) => {
      ctx.addIssue({ code: 'custom', path: ['abilities'], message: `Duplicate ability "${key}"` })
    })
    duplicates(definition.skills.map((s) => s.key)).forEach((key) => {
      ctx.addIssue({ code: 'custom', path: ['skills'], message: `Duplicate skill "${key}"` })
    })
    duplicates(definition.derived.map((s) => s.key)).forEach((key) => {
      ctx.addIssue({ code: 'custom', path: ['derived'], message: `Duplicate stat "${key}"` })
    })

    definition.skills.forEach((skill, index) => {
      if (!abilityKeys.has(skill.ability)) {
        ctx.addIssue({
          code: 'custom',
          path: ['skills', index, 'ability'],
          message: `"${skill.ability}" is not one of this system's abilities`,
        })
      }
    })

    definition.passiveSkills.forEach((key, index) => {
      if (!skillKeys.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['passiveSkills', index],
          message: `"${key}" is not one of this system's skills`,
        })
      }
    })

    definition.derived.forEach((stat, index) => {
      const { abilities, stats } = expressionReferences(stat.formula)

      for (const ability of abilities) {
        if (!abilityKeys.has(ability)) {
          ctx.addIssue({
            code: 'custom',
            path: ['derived', index, 'formula'],
            message: `"${ability}" is not one of this system's abilities`,
          })
        }
      }

      for (const key of stats) {
        if (!derivedKeys.has(key)) {
          ctx.addIssue({
            code: 'custom',
            path: ['derived', index, 'formula'],
            message: `"${key}" is not one of this system's derived stats`,
          })
        }
      }
    })

    // A level with no entry in the table would silently take the last one.
    if (definition.proficiencyBonusByLevel.length < definition.levelRange.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['proficiencyBonusByLevel'],
        message: `Needs ${definition.levelRange.max} entries, one per level`,
      })
    }
  })

export type GameSystemDefinition = z.infer<typeof gameSystemDefinitionSchema>
export type Ability = z.infer<typeof abilitySchema>
export type Skill = z.infer<typeof skillSchema>
export type DerivedStat = z.infer<typeof derivedStatSchema>
export type Resource = z.infer<typeof resourceSchema>
export type ProficiencyRank = z.infer<typeof proficiencyRankSchema>
export type SystemLicense = z.infer<typeof licenseSchema>

function duplicates(keys: string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const key of keys) {
    if (seen.has(key)) repeated.add(key)
    else seen.add(key)
  }
  return [...repeated]
}

// ------------------------------------------------------------ stat keys --

/**
 * The names every computed value goes by.
 *
 * One namespace, shared by three things that must agree: what the derivation
 * module emits, what an override in `data.overrides` is keyed on, and what a
 * `stat` formula node can point at. A separate scheme in any of the three would
 * mean an override that silently does nothing, which is the worst possible
 * failure for a feature whose entire purpose is letting the GM say "no, 17".
 */
export const PROFICIENCY_BONUS_KEY = 'proficiencyBonus'

export const saveKey = (ability: string) => `save.${ability}`
export const skillKey = (skill: string) => `skill.${skill}`
export const passiveKey = (skill: string) => `passive.${skill}`

/** Every key that may legally appear in `data.overrides`. */
export function statKeys(definition: GameSystemDefinition): string[] {
  return [
    PROFICIENCY_BONUS_KEY,
    ...definition.abilities.map((ability) => saveKey(ability.key)),
    ...definition.skills.map((skill) => skillKey(skill.key)),
    ...definition.passiveSkills.map(passiveKey),
    ...definition.derived.map((stat) => stat.key),
  ]
}

/** The label to print beside a stat key, for a sheet or a validation message. */
export function statLabel(definition: GameSystemDefinition, key: string): string {
  if (key === PROFICIENCY_BONUS_KEY) return 'Proficiency bonus'

  const derived = definition.derived.find((stat) => stat.key === key)
  if (derived) return derived.label

  const [prefix, rest] = splitKey(key)

  if (prefix === 'save') {
    const ability = definition.abilities.find((entry) => entry.key === rest)
    return ability ? `${ability.name} save` : key
  }

  const skill = definition.skills.find((entry) => entry.key === rest)
  if (!skill) return key

  return prefix === 'passive' ? `Passive ${skill.name}` : skill.name
}

function splitKey(key: string): [string, string] {
  const index = key.indexOf('.')
  return index === -1 ? ['', key] : [key.slice(0, index), key.slice(index + 1)]
}
