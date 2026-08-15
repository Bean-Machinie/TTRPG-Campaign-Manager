import { z } from 'zod'
import type { EntityInput } from '../../campaigns/types'
import type { GameSystemDefinition } from '../system'
import { findBackground, findClass, pointBuyCost } from '../srd/catalog'
import type { Catalog } from '../srd/catalog'

/**
 * The order a character is built in, and what it means to have finished a step.
 *
 * This module is the wizard's rules and none of its pixels. It is pure, it
 * imports no React, and everything a step component needs to know — whether it
 * may be shown, what is missing, which skills came from where — is a function
 * call here. That split is not tidiness: the sequencing is the part of this
 * feature that is actually hard, and it is testable only if a browser is not
 * required to ask it a question.
 *
 * The order follows the SRD's, and it follows it because the dependencies are
 * real rather than editorial:
 *
 *   setup      a name, and which kind of thing this is
 *   class      → decides the subclass level, the skill choices, the hit die
 *   origin     → the background decides which abilities may be raised
 *   abilities  → needs the background, and produces the modifiers below
 *   skills     → needs class and background to know what is on offer
 *   details    nothing depends on this, which is why it is last but one
 *   review     the whole thing, derived, before it is a character
 *
 * A step is "complete" when its own schema passes. A step is *reachable* when
 * every step before it is complete — see `resolveStep`, which is the entire
 * guard. There is no separate notion of where the user has got to, because
 * storing one would mean storing an answer that the data already gives, and
 * two answers to one question eventually disagree.
 */

export const WIZARD_STEPS = [
  'setup',
  'class',
  'origin',
  'abilities',
  'skills',
  'details',
  'review',
] as const

export type WizardStep = (typeof WIZARD_STEPS)[number]

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  setup: 'Setup',
  class: 'Class',
  origin: 'Origin',
  abilities: 'Ability scores',
  skills: 'Skills and proficiencies',
  details: 'Details',
  review: 'Review',
}

export const WIZARD_STEP_HINTS: Record<WizardStep, string> = {
  setup: 'Who this is, and which rules they are built under.',
  class: 'What they do. This decides much of what follows.',
  origin: 'Where they came from.',
  abilities: 'The six numbers everything else is worked out from.',
  skills: 'What their class and background made them good at.',
  details: 'Everything here is optional.',
  review: 'The finished sheet, before it becomes one.',
}

export function isWizardStep(value: string | undefined): value is WizardStep {
  return WIZARD_STEPS.includes(value as WizardStep)
}

/**
 * What the wizard is editing.
 *
 * The same object the save call takes, deliberately — the wizard is not a
 * parallel model of a character that has to be translated into one at the end.
 * Each step writes part of an EntityInput, and the last step saves the same
 * thing every earlier step has been saving all along.
 */
export type WizardDraft = EntityInput

/** What the steps need to know beyond the draft itself. */
export type WizardContext = {
  definition: GameSystemDefinition
  /** Null for a ruleset with no content module. Every step degrades to free text. */
  catalog: Catalog | null
}

// --------------------------------------------------------- step schemas --
//
// One schema per step, each validating only its own fields, and each a factory
// because half of them cannot be written without the ruleset in hand: how many
// skills a class grants and whether a subclass is due yet are facts about
// content, not about shape.
//
// They validate the whole draft and ignore what is not theirs. That is what
// makes "advancing validates only the current step" true by construction rather
// than by remembering to pass a subset.

function setupStepSchema(_context: WizardContext) {
  return z.object({
    name: z.string().trim().min(1, 'A character needs a name.').max(120),
    kind: z.enum(['pc', 'npc', 'creature']),
    systemId: z.string().min(1, 'Choose a ruleset.'),
  })
}

function classStepSchema(context: WizardContext) {
  const { levelRange } = context.definition

  return z
    .object({
      data: z.object({
        level: z
          .number()
          .int()
          .min(levelRange.min, `Level must be between ${levelRange.min} and ${levelRange.max}.`)
          .max(levelRange.max, `Level must be between ${levelRange.min} and ${levelRange.max}.`)
          .nullable()
          .refine((level) => level !== null, 'Choose a level.'),
        classes: z
          .array(
            z.object({
              name: z.string().trim().min(1),
              level: z.number().int().min(1),
              subclass: z.string().nullable(),
            }),
          )
          .min(1, 'Choose a class.'),
      }),
    })
    .superRefine((value, ctx) => {
      const first = value.data.classes[0]
      if (!first) return

      // The dependency the step exists to make visible: a subclass is not a
      // question until the level says it is, and then it is not optional.
      const entry = findClass(context.catalog, first.name)
      if (!entry) return

      if (first.level >= entry.subclassLevel && !first.subclass?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['data', 'classes', 0, 'subclass'],
          message: `A ${entry.name} chooses a subclass at level ${entry.subclassLevel}.`,
        })
      }
    })
}

function originStepSchema(_context: WizardContext) {
  return z.object({
    data: z.object({
      species: z
        .string()
        .trim()
        .min(1, 'Choose a species.')
        .nullable()
        .refine((value) => value !== null, 'Choose a species.'),
      background: z
        .string()
        .trim()
        .min(1, 'Choose a background.')
        .nullable()
        .refine((value) => value !== null, 'Choose a background.'),
    }),
  })
}

function abilitiesStepSchema(context: WizardContext) {
  const { abilities, abilityScoreRange } = context.definition

  return z
    .object({
      data: z.object({
        abilities: z.record(z.string(), z.number().int()),
        abilityIncreases: z.record(z.string(), z.number().int()),
        background: z.string().nullable(),
      }),
    })
    .superRefine((value, ctx) => {
      for (const ability of abilities) {
        const score = value.data.abilities[ability.key]

        if (typeof score !== 'number') {
          ctx.addIssue({
            code: 'custom',
            path: ['data', 'abilities', ability.key],
            message: `${ability.name} has no score yet.`,
          })
          continue
        }

        if (score < abilityScoreRange.min || score > abilityScoreRange.max) {
          ctx.addIssue({
            code: 'custom',
            path: ['data', 'abilities', ability.key],
            message: `${ability.name} must be between ${abilityScoreRange.min} and ${abilityScoreRange.max}.`,
          })
        }
      }

      // The background's increases, checked only when there is a background the
      // catalog recognises. Homebrew gets the freedom it came for.
      const background = findBackground(context.catalog, value.data.background)
      if (!background) return

      const increases = Object.entries(value.data.abilityIncreases).filter(([, amount]) => amount)
      const allowed = new Set(background.abilities)

      for (const [key] of increases) {
        if (!allowed.has(key)) {
          ctx.addIssue({
            code: 'custom',
            path: ['data', 'abilityIncreases', key],
            message: `${background.name} does not raise that ability.`,
          })
        }
      }

      const pattern = increases.map(([, amount]) => amount).sort((a, b) => b - a)
      const legal =
        (pattern.length === 2 && pattern[0] === 2 && pattern[1] === 1) ||
        (pattern.length === 3 && pattern.every((amount) => amount === 1))

      if (!legal) {
        ctx.addIssue({
          code: 'custom',
          path: ['data', 'abilityIncreases'],
          message: `${background.name} raises one ability by 2 and another by 1, or three by 1 each.`,
        })
      }
    })
}

function skillsStepSchema(context: WizardContext) {
  return z
    .object({
      data: z.object({
        species: z.string().nullable(),
        background: z.string().nullable(),
        classes: z.array(z.object({ name: z.string() })),
        proficiencies: z.object({ skills: z.record(z.string(), z.string()) }),
      }),
    })
    .superRefine((value, ctx) => {
      // Cast is safe: the sources below read only the fields declared above,
      // and this schema has just proved they are there.
      const grants = skillGrants(value as unknown as WizardDraft, context)
      const chosen = attributeSkills(value as unknown as WizardDraft, context)

      for (const grant of grants) {
        const taken = [...chosen.values()].filter((source) => source === grant.id).length

        if (taken < grant.choose) {
          ctx.addIssue({
            code: 'custom',
            path: ['data', 'proficiencies', 'skills'],
            message:
              grant.fixed.length > 0 && grant.choose === grant.fixed.length
                ? `${grant.label} grants ${grant.fixed.length} skills that are not all applied.`
                : `Choose ${grant.choose - taken} more skill${grant.choose - taken === 1 ? '' : 's'} from ${grant.label.toLowerCase()}.`,
          })
        }
      }
    })
}

/** Every field on this step is optional, which is the whole point of it. */
function detailsStepSchema(_context: WizardContext) {
  return z.object({})
}

const STEP_SCHEMAS: Record<WizardStep, (context: WizardContext) => z.ZodType> = {
  setup: setupStepSchema,
  class: classStepSchema,
  origin: originStepSchema,
  abilities: abilitiesStepSchema,
  skills: skillsStepSchema,
  details: detailsStepSchema,
  // Review collects nothing of its own. What it validates is everything, which
  // is why asking whether it is "complete" is the same as asking whether this
  // is a character yet.
  review: (context) => completeCharacterSchema(context),
}

/** The steps that actually collect something. Review is a page, not a form. */
export const INPUT_STEPS = WIZARD_STEPS.filter((step) => step !== 'review')

/**
 * The whole character, as the composition of the steps that built it.
 *
 * Literally the composition — an intersection of the same schema objects the
 * steps validate against, not a second schema that restates them. A rule added
 * to a step is a rule the finished character is held to, without anybody having
 * to remember to add it twice.
 */
export function completeCharacterSchema(context: WizardContext): z.ZodType {
  return INPUT_STEPS.map((step) => STEP_SCHEMAS[step](context)).reduce((left, right) =>
    z.intersection(left, right),
  )
}

// ------------------------------------------------------------ validation --

/**
 * What is wrong with this step, in words a form can print.
 *
 * Messages rather than a thrown error or a boolean, matching
 * checkAgainstSystem: the answer to "why can I not continue" belongs beside the
 * button that will not move.
 */
export function validateStep(
  step: WizardStep,
  draft: WizardDraft,
  context: WizardContext,
): string[] {
  const result = STEP_SCHEMAS[step](context).safeParse(draft)
  if (result.success) return []

  // Deduplicated: one missing background produces the same sentence from two
  // refinements, and saying it twice reads like two problems.
  return [...new Set(result.error.issues.map((issue) => issue.message))]
}

export function isStepComplete(
  step: WizardStep,
  draft: WizardDraft,
  context: WizardContext,
): boolean {
  return STEP_SCHEMAS[step](context).safeParse(draft).success
}

export function stepProgress(
  draft: WizardDraft,
  context: WizardContext,
): Record<WizardStep, boolean> {
  const progress = {} as Record<WizardStep, boolean>
  for (const step of WIZARD_STEPS) progress[step] = isStepComplete(step, draft, context)
  return progress
}

/**
 * The earliest step that is not finished, or `review` when they all are.
 *
 * Where an interrupted draft resumes, and where a guard sends somebody who
 * arrived somewhere they should not be.
 */
export function firstIncompleteStep(draft: WizardDraft, context: WizardContext): WizardStep {
  return INPUT_STEPS.find((step) => !isStepComplete(step, draft, context)) ?? 'review'
}

/**
 * Which step this URL is actually allowed to show.
 *
 * The guard, in one function. A step is reachable when everything before it is
 * complete; anything else redirects to the earliest gap, so `.../skills` on a
 * draft with no class lands on `.../class` rather than on a skills page with
 * nothing to offer. Going *back* is always allowed — the steps before the gap
 * are exactly the ones that are finished, and a finished step is a step you may
 * return to and change.
 */
export function resolveStep(
  requested: WizardStep,
  draft: WizardDraft,
  context: WizardContext,
): WizardStep {
  const gap = firstIncompleteStep(draft, context)
  return WIZARD_STEPS.indexOf(requested) <= WIZARD_STEPS.indexOf(gap) ? requested : gap
}

// -------------------------------------------------------- skill sourcing --

/** Where a skill proficiency came from. `manual` is anything else. */
export type SkillSource = 'background' | 'species' | 'class' | 'manual'

export type SkillGrant = {
  id: SkillSource
  /** "Soldier", "Elf", "Rogue" — what the step prints beside the picker. */
  label: string
  /** Granted outright. The player does not choose these. */
  fixed: string[]
  /** How many to pick, `fixed` included. */
  choose: number
  /** What may be picked. Empty means any skill in the system. */
  from: string[]
}

/**
 * What each source of this character's proficiencies offers.
 *
 * In the order the SRD grants them, which is also the order they are least
 * negotiable: a background's two skills are fixed, a species' one is a short
 * list, a class's are a longer one. Sources the catalog knows nothing about
 * simply do not appear, which is how a homebrew class ends up with a step that
 * asks for nothing and validates as complete.
 */
export function skillGrants(draft: WizardDraft, context: WizardContext): SkillGrant[] {
  const grants: SkillGrant[] = []

  const background = findBackground(context.catalog, draft.data.background)
  if (background) {
    grants.push({
      id: 'background',
      label: background.name,
      fixed: background.skills,
      choose: background.skills.length,
      from: background.skills,
    })
  }

  const species = context.catalog?.species.find(
    (entry) => entry.name.toLowerCase() === draft.data.species?.trim().toLowerCase(),
  )
  if (species?.skillChoices) {
    grants.push({
      id: 'species',
      label: species.name,
      fixed: [],
      choose: species.skillChoices.choose,
      from: species.skillChoices.from,
    })
  }

  const characterClass = findClass(context.catalog, draft.data.classes[0]?.name ?? null)
  if (characterClass) {
    grants.push({
      id: 'class',
      label: characterClass.name,
      fixed: [],
      choose: characterClass.skills.choose,
      from: characterClass.skills.from,
    })
  }

  return grants
}

/**
 * Which source each of this character's skills came from.
 *
 * Recomputed rather than stored, because it can be: what a background grants is
 * fixed, and what a class may grant is a list. Storing the attribution would
 * mean storing something that can be worked out, and then keeping the two in
 * step every time a background changes.
 *
 * Assigned most-constrained-first — fixed grants, then the shortest list of
 * options, with "any skill" last. That order matters: a human rogue's four
 * class skills would otherwise be eaten one at a time by the species' choice of
 * any skill at all, and the step would ask for a fifth. It is a heuristic and
 * not a matching algorithm, and it is exact for every shape the SRD contains.
 */
export function attributeSkills(
  draft: WizardDraft,
  context: WizardContext,
): Map<string, SkillSource> {
  const attribution = new Map<string, SkillSource>()

  const proficient = Object.entries(draft.data.proficiencies.skills)
    .filter(([, rank]) => rank)
    .map(([skill]) => skill)

  const unassigned = new Set(proficient)

  const openness = (grant: SkillGrant) =>
    grant.fixed.length > 0 ? -1 : grant.from.length === 0 ? Number.MAX_SAFE_INTEGER : grant.from.length

  const ordered = [...skillGrants(draft, context)].sort((a, b) => openness(a) - openness(b))

  for (const grant of ordered) {
    let remaining = grant.choose

    if (grant.fixed.length > 0) {
      for (const skill of grant.fixed) {
        if (!unassigned.has(skill)) continue
        attribution.set(skill, grant.id)
        unassigned.delete(skill)
      }
      continue
    }

    for (const skill of [...unassigned]) {
      if (remaining <= 0) break
      if (grant.from.length > 0 && !grant.from.includes(skill)) continue

      attribution.set(skill, grant.id)
      unassigned.delete(skill)
      remaining -= 1
    }
  }

  // Anything left was typed in by hand, on the detail page or by an import.
  // Worth naming rather than hiding: a skill with no source is still a fact.
  for (const skill of unassigned) attribution.set(skill, 'manual')

  return attribution
}

// ---------------------------------------------------------- hit points --

/**
 * Starting hit points, from the class hit die and Constitution.
 *
 * Written by the wizard as an *input*, not computed by the derivation module.
 * That module has no notion of a hit die — the ruleset definition does not
 * carry one, and hit points are a resource rather than a derived stat — so the
 * alternative to writing a number here is a character sheet whose most-read
 * value is blank. Anyone who disagrees with it edits it, and nothing overwrites
 * an edit once the wizard is finished.
 *
 * Levels after the first take the fixed average the rules offer instead of a
 * roll, because a wizard cannot roll dice on your behalf and pretend it was you.
 */
export function startingHitPoints(
  hitDie: number,
  level: number,
  constitutionModifier: number,
): number {
  const first = hitDie + constitutionModifier
  const perLevel = Math.floor(hitDie / 2) + 1 + constitutionModifier

  return Math.max(1, first + Math.max(0, level - 1) * perLevel)
}

/**
 * The draft's resources with hit points brought up to date, or null when there
 * is nothing to work them out from.
 *
 * Called from both the class step and the ability scores step, because both
 * halves of the sum are chosen on different pages and whichever moves last
 * should be the one the number reflects. Null rather than a guess: a homebrew
 * class has no hit die, and a made-up one printed in the same weight as a real
 * one is worse than a blank.
 */
export function hitPointResources(
  draft: WizardDraft,
  context: WizardContext,
): WizardDraft['data']['resources'] | null {
  const entry = findClass(context.catalog, draft.data.classes[0]?.name ?? null)
  if (!entry || !context.catalog || draft.data.level === null) return null

  const { offset, divisor } = context.definition.abilityModifier
  const score = draft.data.abilities[context.catalog.hitPointAbility]
  const modifier = typeof score === 'number' ? Math.floor((score - offset) / divisor) : 0

  const max = startingHitPoints(entry.hitDie, draft.data.level, modifier)
  return { ...draft.data.resources, hitPoints: { current: max, max } }
}

// ------------------------------------------------------ ability methods --

export type AbilityMethod = 'standardArray' | 'pointBuy' | 'manual'

export const ABILITY_METHOD_LABELS: Record<AbilityMethod, string> = {
  standardArray: 'Standard array',
  pointBuy: 'Point buy',
  manual: 'Enter by hand',
}

/**
 * Which method these scores look like they came from.
 *
 * Recovered rather than stored, for the same reason as the skill attribution: a
 * draft resumed a day later should open on the method it was left on, and the
 * scores themselves say which that was. The standard array is a multiset — six
 * specific numbers in any arrangement — and a point-buy array is any six scores
 * inside the cost table that come to no more than the budget. Anything else was
 * typed.
 *
 * Reads the *base* scores, before the background's increases, because that is
 * what the method produced.
 */
export function detectAbilityMethod(base: number[], catalog: Catalog | null): AbilityMethod {
  if (!catalog || base.length === 0) return 'manual'

  const { standardArray, pointBuy } = catalog.abilityScores

  if (base.length === standardArray.length) {
    const sorted = [...base].sort((a, b) => a - b).join(',')
    if (sorted === [...standardArray].sort((a, b) => a - b).join(',')) return 'standardArray'
  }

  const cost = pointBuyCost(catalog.abilityScores, base)
  if (cost !== null && cost <= pointBuy.budget) return 'pointBuy'

  return 'manual'
}
