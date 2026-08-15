import { z } from 'zod'
import { statKeys, statLabel } from './system'
import type { GameSystemDefinition } from './system'

/**
 * What an entity stores, and what it deliberately does not.
 *
 * The rule is: store inputs, derive outputs, allow overrides. A player
 * character keeps its ability scores, its level and its proficiencies, and its
 * Armor Class is worked out from them every time it is displayed. Nothing
 * computed is ever written to the database, because a computed value that is
 * stored is a value that goes stale the moment somebody edits an input, and
 * nothing in the schema would say so.
 *
 * `overrides` is the escape hatch, and it is what makes one table hold both a
 * character and a monster. A statblock declares Armor Class 17 with no
 * arithmetic behind it: it is an entity with `derive: false` and 17 in the
 * overrides. A barbarian with unarmoured defence is an entity with `derive:
 * true` and 17 in the overrides. Same column, same renderer, and the sheet
 * shows the same number — see Derived<T> in derive.ts, where the display value
 * is always `override ?? computed`.
 *
 * Postgres never looks inside any of this. Three fields — level, challenge
 * rating and creature type — are lifted into generated columns so a list can be
 * filtered by them, and those are guarded against nonsense rather than being
 * trusted, precisely because validation happens here instead.
 */

const keySchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/)

/** Free text on a statblock: a trait, an action, a reaction. */
export const featureSchema = z.object({
  name: z.string().min(1).max(120),
  text: z.string().max(4000).default(''),
})

/**
 * A pool the sheet tracks between rests.
 *
 * `max` is nullable because a counter — temporary hit points, inspiration —
 * has a current value and no ceiling, and because maximum hit points are not
 * derivable without the class hit dice this pass does not model.
 */
export const resourceValueSchema = z.object({
  current: z.number().int(),
  max: z.number().int().nullable().default(null),
})

const abilityScoresSchema = z.record(keySchema, z.number().int())

/**
 * Which rank of proficiency, by ability or skill key. The values are rank keys
 * from the system definition — `proficient`, `expertise` — not booleans, so a
 * system with half-proficiency needs no new concept here.
 */
const proficiencySchema = z.record(keySchema, z.string())

/** Overrides are keyed by the stat namespace in system.ts. */
const overridesSchema = z.record(z.string(), z.number())

const resourcesSchema = z.record(keySchema, resourceValueSchema)

export const entityDataSchema = z.object({
  /**
   * Whether to work the numbers out at all.
   *
   * A dragon has ability scores and an Armor Class that has nothing to do with
   * them, so computing 10 + its Dexterity modifier and showing that beside the
   * real 17 would be noise dressed up as information. False means the sheet
   * shows what was asserted and nothing else — derivation is skipped, not
   * hidden.
   */
  derive: z.boolean().default(true),

  level: z.number().int().min(0).max(100).nullable().default(null),
  /**
   * Fractional for the low end — CR 1/8 is 0.125. Stored as a number because
   * the generated column filters on it; displayed through formatChallengeRating.
   */
  challengeRating: z.number().min(0).max(100).nullable().default(null),

  abilities: abilityScoresSchema.default({}),
  /**
   * How much of each ability score came from somewhere other than the roll.
   *
   * `abilities` still holds the *total*, so nothing that reads a score — the
   * derivation module, the sheet, every formula — needs to know this field
   * exists. What it buys is the ability to say where a 17 came from: a 15 the
   * player assigned and a +2 their background granted, shown as two lines
   * instead of one number that has quietly absorbed the other.
   *
   * Not recoverable after the fact, which is why it is stored. Totals plus a
   * standard array admit several splits, and guessing which one the player
   * chose would be a guess presented as a record.
   */
  abilityIncreases: abilityScoresSchema.default({}),
  proficiencies: z
    .object({
      saves: proficiencySchema.default({}),
      skills: proficiencySchema.default({}),
    })
    .default({ saves: {}, skills: {} }),

  overrides: overridesSchema.default({}),
  resources: resourcesSchema.default({}),

  // --- descriptive. The rules never read these; the sheet prints them. ---

  classes: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        level: z.number().int().min(0).max(100).default(1),
        subclass: z.string().max(60).nullable().default(null),
      }),
    )
    .default([]),
  species: z.string().max(60).nullable().default(null),
  background: z.string().max(60).nullable().default(null),
  alignment: z.string().max(60).nullable().default(null),
  size: z.string().max(30).nullable().default(null),
  creatureType: z.string().max(40).nullable().default(null),

  speed: z.string().max(200).nullable().default(null),
  senses: z.string().max(200).nullable().default(null),
  languages: z.string().max(200).nullable().default(null),

  damageResistances: z.array(z.string().max(40)).default([]),
  damageImmunities: z.array(z.string().max(40)).default([]),
  damageVulnerabilities: z.array(z.string().max(40)).default([]),
  conditionImmunities: z.array(z.string().max(40)).default([]),

  traits: z.array(featureSchema).default([]),
  actions: z.array(featureSchema).default([]),

  /**
   * Who they are away from the arithmetic.
   *
   * Three fields rather than one, because they are three questions and a single
   * "notes" box would collapse them back into the wall of text the detail page
   * exists to break up. All optional, all prose, and none of them ever read by
   * a rule.
   */
  appearance: z.string().max(4000).nullable().default(null),
  personality: z.string().max(4000).nullable().default(null),
  backstory: z.string().max(20000).nullable().default(null),

  /**
   * A statblock as typed, for the fifteen-second NPC.
   *
   * The structured fields above can express a monster completely, and quick
   * create is the case where nobody wants to. A GM inventing a shopkeeper
   * mid-session pastes or types whatever they have; it renders as text and
   * derives nothing. Anything worth computing can be filled in later on the
   * detail page, which is where the structured fields still are.
   */
  statblock: z.string().max(20000).nullable().default(null),
})

export type EntityData = z.infer<typeof entityDataSchema>
export type Feature = z.infer<typeof featureSchema>
export type ResourceValue = z.infer<typeof resourceValueSchema>

/**
 * The GM's half of the same entity.
 *
 * `data` here is an overlay, not a whole second sheet: the fields a GM might
 * want to differ from what the party has been told. A doppelganger's public
 * `data` says what it appears to be; the overlay says what it is.
 *
 * Written out explicitly rather than as `entityDataSchema.partial()`, and the
 * reason is not style. Every field in that schema has a default, so a partial
 * of it would still fill those defaults on parse — an overlay that set nothing
 * would arrive as a complete object of empty values and blank the public data
 * it was merged over. An explicit subset cannot do that, and it also makes the
 * question "what can be hidden?" one you answer by reading rather than by
 * reasoning about Zod.
 */
export const entityOverlaySchema = z.object({
  level: z.number().int().min(0).max(100).nullable().optional(),
  challengeRating: z.number().min(0).max(100).nullable().optional(),
  abilities: abilityScoresSchema.optional(),
  overrides: overridesSchema.optional(),
  resources: resourcesSchema.optional(),
  traits: z.array(featureSchema).optional(),
  actions: z.array(featureSchema).optional(),
})

export const entitySecretsSchema = z.object({
  /** Secret motivation, plot hooks, what it wants. Prose. */
  gmNotes: z.string().max(20000).nullable().default(null),
  /** True identity, when the name on the public half is a lie. */
  trueName: z.string().max(120).nullable().default(null),
  data: entityOverlaySchema.nullable().default(null),
})

export type EntityOverlay = z.infer<typeof entityOverlaySchema>
export type EntitySecrets = z.infer<typeof entitySecretsSchema>

// ------------------------------------------------------------- reading --

/**
 * Parse a blob out of the database.
 *
 * Lenient on purpose. A row was written under one version of a system
 * definition and is being read under another, and a skill that has since been
 * renamed should cost you that skill rather than the whole sheet. Anything
 * unrecognised is dropped by Zod's own object stripping; anything malformed
 * falls back to an empty entity rather than throwing, because a character page
 * that renders blank is a problem you can see and fix, and one that throws is a
 * white screen.
 *
 * Writes go the other way — see checkAgainstSystem, which is strict.
 */
export function parseEntityData(value: unknown): EntityData {
  const result = entityDataSchema.safeParse(value ?? {})
  return result.success ? result.data : entityDataSchema.parse({})
}

export function parseEntitySecrets(value: unknown): EntitySecrets {
  const result = entitySecretsSchema.safeParse(value ?? {})
  return result.success ? result.data : entitySecretsSchema.parse({})
}

/**
 * The public data with the GM's overlay laid over it.
 *
 * Field-wise, except for the three maps, which merge key by key: an overlay
 * that hides one ability score should not blank the other five. Only ever
 * called with an overlay the server was willing to send, which is to say only
 * for someone who manages the campaign — `secrets` arrives as `{}` for
 * everybody else, so this is a no-op on a player's copy rather than a rule they
 * could talk their way past.
 */
export function applyOverlay(data: EntityData, overlay: EntityOverlay | null): EntityData {
  if (!overlay) return data

  return {
    ...data,
    ...(overlay.level !== undefined ? { level: overlay.level } : {}),
    ...(overlay.challengeRating !== undefined
      ? { challengeRating: overlay.challengeRating }
      : {}),
    ...(overlay.traits ? { traits: overlay.traits } : {}),
    ...(overlay.actions ? { actions: overlay.actions } : {}),
    abilities: { ...data.abilities, ...overlay.abilities },
    overrides: { ...data.overrides, ...overlay.overrides },
    resources: { ...data.resources, ...overlay.resources },
  }
}

// ------------------------------------------------------------- writing --

/**
 * What is wrong with this data, in the terms of this system.
 *
 * The shape is Zod's business; this is the half Zod cannot know, because the
 * vocabulary lives in a database row rather than in a type. An ability score
 * keyed `strength` in a system whose ability is `str` parses perfectly and
 * derives nothing, and the only place that can be caught is here, against a
 * definition.
 *
 * Returns messages rather than throwing: the form shows them beside the fields
 * and lets the author fix them, which is not a thing an exception can do.
 */
export function checkAgainstSystem(
  definition: GameSystemDefinition,
  data: EntityData,
): string[] {
  const problems: string[] = []

  const abilityKeys = new Set(definition.abilities.map((ability) => ability.key))
  const skillKeys = new Set(definition.skills.map((skill) => skill.key))
  const rankKeys = new Set(definition.proficiencyRanks.map((rank) => rank.key))
  const resourceKeys = new Set(definition.resources.map((resource) => resource.key))
  const knownStatKeys = new Set(statKeys(definition))

  for (const key of Object.keys(data.abilities)) {
    if (!abilityKeys.has(key)) problems.push(`"${key}" is not an ability in this system.`)
  }

  for (const key of Object.keys(data.abilityIncreases)) {
    if (!abilityKeys.has(key)) problems.push(`"${key}" is not an ability in this system.`)
  }

  const { min, max } = definition.abilityScoreRange
  for (const [key, score] of Object.entries(data.abilities)) {
    if (score < min || score > max) {
      problems.push(`${key.toUpperCase()} must be between ${min} and ${max}.`)
    }
  }

  for (const [key, rank] of Object.entries(data.proficiencies.saves)) {
    if (!abilityKeys.has(key)) problems.push(`"${key}" is not an ability in this system.`)
    if (!rankKeys.has(rank)) problems.push(`"${rank}" is not a proficiency rank.`)
  }

  for (const [key, rank] of Object.entries(data.proficiencies.skills)) {
    if (!skillKeys.has(key)) problems.push(`"${key}" is not a skill in this system.`)
    if (!rankKeys.has(rank)) problems.push(`"${rank}" is not a proficiency rank.`)
  }

  for (const key of Object.keys(data.overrides)) {
    if (!knownStatKeys.has(key)) {
      problems.push(`"${key}" is not a stat that can be overridden.`)
    }
  }

  for (const key of Object.keys(data.resources)) {
    if (!resourceKeys.has(key)) problems.push(`"${key}" is not a resource in this system.`)
  }

  if (data.level !== null) {
    const range = definition.levelRange
    if (data.level < range.min || data.level > range.max) {
      problems.push(`Level must be between ${range.min} and ${range.max}.`)
    }
  }

  return problems
}

/**
 * A blank entity of a given kind.
 *
 * The only thing that differs is `derive`: a player character is a set of
 * inputs the rules act on, and a creature is a set of assertions. Both are
 * changeable on the form — this is where the cursor starts, not a decision the
 * author is held to.
 */
export function emptyEntityData(kind: 'pc' | 'npc' | 'creature'): EntityData {
  return entityDataSchema.parse({
    derive: kind === 'pc',
    level: kind === 'pc' ? 1 : null,
  })
}

// ---------------------------------------------------------- formatting --

/**
 * Challenge rating, the way the books write it.
 *
 * Stored as a number because the generated column has to sort and filter on it,
 * and 1/8 does not sort. The three fractions are the only ones 5e uses, so they
 * are spelled out rather than run through a continued-fraction algorithm that
 * would also cheerfully render CR 0.3 as 3/10.
 */
const CHALLENGE_RATING_FRACTIONS: Array<[number, string]> = [
  [0.125, '1/8'],
  [0.25, '1/4'],
  [0.5, '1/2'],
]

export function formatChallengeRating(value: number | null): string {
  if (value === null) return '—'

  const fraction = CHALLENGE_RATING_FRACTIONS.find(([number]) => number === value)
  return fraction ? fraction[1] : String(value)
}

/** The inverse, for a form that lets someone type `1/4`. */
export function parseChallengeRating(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const fraction = CHALLENGE_RATING_FRACTIONS.find(([, label]) => label === trimmed)
  if (fraction) return fraction[0]

  const number = Number(trimmed)
  return Number.isFinite(number) && number >= 0 ? number : null
}

/** A signed modifier: `+3`, `-1`, `+0`. What a sheet prints beside a skill. */
export function formatModifier(value: number | null): string {
  if (value === null) return '—'
  return value >= 0 ? `+${value}` : String(value)
}

/** Re-exported so callers naming a stat do not need two imports. */
export { statLabel }
