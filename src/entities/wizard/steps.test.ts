import { describe, expect, it } from 'vitest'
import { emptyEntityData, entityDataSchema } from '../entityData'
import type { EntityData } from '../entityData'
import { gameSystemDefinitionSchema } from '../system'
import { catalogFor } from '../srd/catalog'
import {
  attributeSkills,
  detectAbilityMethod,
  firstIncompleteStep,
  resolveStep,
  skillGrants,
  startingHitPoints,
  validateStep,
} from './steps'
import type { WizardContext, WizardDraft } from './steps'

/**
 * The wizard's sequencing, tested without a browser.
 *
 * Which is the reason the rules live in a module of their own: "you cannot land
 * on the skills step without a class" is a claim about a function, and proving
 * it by clicking through seven pages would prove it once.
 */

const definition = gameSystemDefinitionSchema.parse({
  abilities: [
    { key: 'str', name: 'Strength', abbr: 'STR' },
    { key: 'dex', name: 'Dexterity', abbr: 'DEX' },
    { key: 'con', name: 'Constitution', abbr: 'CON' },
    { key: 'int', name: 'Intelligence', abbr: 'INT' },
    { key: 'wis', name: 'Wisdom', abbr: 'WIS' },
    { key: 'cha', name: 'Charisma', abbr: 'CHA' },
  ],
  abilityScoreRange: { min: 1, max: 30 },
  skills: [
    { key: 'acrobatics', name: 'Acrobatics', ability: 'dex' },
    { key: 'athletics', name: 'Athletics', ability: 'str' },
    { key: 'deception', name: 'Deception', ability: 'cha' },
    { key: 'insight', name: 'Insight', ability: 'wis' },
    { key: 'intimidation', name: 'Intimidation', ability: 'cha' },
    { key: 'investigation', name: 'Investigation', ability: 'int' },
    { key: 'perception', name: 'Perception', ability: 'wis' },
    { key: 'performance', name: 'Performance', ability: 'cha' },
    { key: 'persuasion', name: 'Persuasion', ability: 'cha' },
    { key: 'sleightOfHand', name: 'Sleight of Hand', ability: 'dex' },
    { key: 'stealth', name: 'Stealth', ability: 'dex' },
    { key: 'survival', name: 'Survival', ability: 'wis' },
  ],
  proficiencyBonusByLevel: [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6],
  levelRange: { min: 1, max: 20 },
  proficiencyRanks: [
    { key: 'none', name: 'Not proficient', multiplier: 0 },
    { key: 'proficient', name: 'Proficient', multiplier: 1 },
    { key: 'expertise', name: 'Expertise', multiplier: 2 },
  ],
})

const context: WizardContext = { definition, catalog: catalogFor('dnd5e') }

function draft(data: Partial<EntityData> = {}, name = 'Thalia'): WizardDraft {
  return {
    name,
    kind: 'pc',
    systemId: 'system-uuid',
    playerUserId: null,
    summary: null,
    visibility: 'shared',
    data: entityDataSchema.parse({ ...emptyEntityData('pc'), ...data }),
  }
}

/** A draft that has cleared every step up to, but not including, `stop`. */
function upTo(stop: string): WizardDraft {
  const data: Partial<EntityData> = {}

  if (stop !== 'class') {
    data.level = 3
    data.classes = [{ name: 'Rogue', level: 3, subclass: 'Thief' }]
  }
  if (stop !== 'class' && stop !== 'origin') {
    data.species = 'Dwarf'
    data.background = 'Soldier'
  }
  if (stop === 'skills' || stop === 'details' || stop === 'review') {
    data.abilities = { str: 15, dex: 15, con: 13, int: 12, wis: 10, cha: 8 }
    data.abilityIncreases = { str: 2, dex: 1 }
  }
  if (stop === 'details' || stop === 'review') {
    data.proficiencies = {
      saves: {},
      skills: {
        athletics: 'proficient',
        intimidation: 'proficient',
        acrobatics: 'proficient',
        deception: 'proficient',
        perception: 'proficient',
        stealth: 'proficient',
      },
    }
  }

  return draft(data)
}

describe('what each step demands before it will let go', () => {
  it('wants a name before anything else', () => {
    expect(validateStep('setup', draft({}, '  '), context)).toContain('A character needs a name.')
    expect(validateStep('setup', draft(), context)).toEqual([])
  })

  it('wants a class and a level', () => {
    expect(validateStep('class', draft(), context)).toContain('Choose a class.')
  })

  it('asks for a subclass only once the level has earned one', () => {
    const early = draft({ level: 2, classes: [{ name: 'Rogue', level: 2, subclass: null }] })
    expect(validateStep('class', early, context)).toEqual([])

    const due = draft({ level: 3, classes: [{ name: 'Rogue', level: 3, subclass: null }] })
    expect(validateStep('class', due, context)).toContain(
      'A Rogue chooses a subclass at level 3.',
    )
  })

  it('leaves a homebrew class alone', () => {
    const homebrew = draft({
      level: 9,
      classes: [{ name: 'Blood Hunter', level: 9, subclass: null }],
    })
    expect(validateStep('class', homebrew, context)).toEqual([])
  })

  it('will not accept five ability scores', () => {
    const partial = draft({ abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10 } })
    expect(validateStep('abilities', partial, context)).toContain('Charisma has no score yet.')
  })

  it('holds the background to its own increases', () => {
    const wrong = draft({
      background: 'Soldier',
      abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      abilityIncreases: { cha: 2, wis: 1 },
    })
    const problems = validateStep('abilities', wrong, context)
    expect(problems).toContain('Soldier does not raise that ability.')

    const lopsided = draft({
      background: 'Soldier',
      abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      abilityIncreases: { str: 3 },
    })
    expect(validateStep('abilities', lopsided, context)).toContain(
      'Soldier raises one ability by 2 and another by 1, or three by 1 each.',
    )

    const right = draft({
      background: 'Soldier',
      abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
      abilityIncreases: { str: 1, dex: 1, con: 1 },
    })
    expect(validateStep('abilities', right, context)).toEqual([])
  })

  it('counts the skills each source still owes', () => {
    const short = upTo('skills')
    expect(validateStep('skills', short, context).join(' ')).toContain('Choose')

    expect(validateStep('skills', upTo('details'), context)).toEqual([])
  })

  it('asks nothing at all on the details step', () => {
    expect(validateStep('details', draft(), context)).toEqual([])
  })

  it('checks the whole character on review, as the composition of the steps', () => {
    expect(validateStep('review', upTo('review'), context)).toEqual([])
    expect(validateStep('review', draft(), context)).toContain('Choose a class.')
  })
})

describe('the guard', () => {
  it('sends a fresh draft to the first step it has not finished', () => {
    expect(firstIncompleteStep(draft(), context)).toBe('class')
    expect(firstIncompleteStep(upTo('origin'), context)).toBe('origin')
    expect(firstIncompleteStep(upTo('review'), context)).toBe('review')
  })

  it('will not let you land on skills without a class', () => {
    expect(resolveStep('skills', draft(), context)).toBe('class')
  })

  it('lets you go back to a step you have already finished', () => {
    expect(resolveStep('setup', upTo('review'), context)).toBe('setup')
    expect(resolveStep('class', upTo('skills'), context)).toBe('class')
  })

  it('lets you stand on the gap itself', () => {
    expect(resolveStep('origin', upTo('origin'), context)).toBe('origin')
  })
})

describe('where a proficiency came from', () => {
  it('offers one grant per source that has something to offer', () => {
    const grants = skillGrants(upTo('details'), context)
    expect(grants.map((grant) => grant.id)).toEqual(['background', 'class'])
    expect(grants.find((grant) => grant.id === 'class')?.choose).toBe(4)
  })

  it('attributes the background’s two before the class’s four', () => {
    const sources = attributeSkills(upTo('details'), context)

    expect(sources.get('athletics')).toBe('background')
    expect(sources.get('intimidation')).toBe('background')
    expect(sources.get('stealth')).toBe('class')
  })

  it('does not let a species that may pick anything eat the class’s choices', () => {
    // A human rogue: the species may take any skill at all, the class four from
    // its own list. Assigned the other way round, the class would come up short
    // and the step would ask for a fifth skill that does not exist.
    const human = draft({
      level: 3,
      classes: [{ name: 'Rogue', level: 3, subclass: 'Thief' }],
      species: 'Human',
      background: 'Soldier',
      abilities: { str: 15, dex: 15, con: 13, int: 12, wis: 10, cha: 8 },
      abilityIncreases: { str: 2, dex: 1 },
      proficiencies: {
        saves: {},
        skills: {
          athletics: 'proficient',
          intimidation: 'proficient',
          acrobatics: 'proficient',
          deception: 'proficient',
          perception: 'proficient',
          stealth: 'proficient',
          survival: 'proficient',
        },
      },
    })

    const sources = attributeSkills(human, context)
    const byClass = [...sources.values()].filter((source) => source === 'class').length
    const bySpecies = [...sources.values()].filter((source) => source === 'species').length

    expect(byClass).toBe(4)
    expect(bySpecies).toBe(1)
    expect(validateStep('skills', human, context)).toEqual([])
  })

  it('calls anything it cannot place manual rather than hiding it', () => {
    const extra = draft({
      classes: [{ name: 'Blood Hunter', level: 1, subclass: null }],
      proficiencies: { saves: {}, skills: { stealth: 'proficient' } },
    })

    expect(attributeSkills(extra, context).get('stealth')).toBe('manual')
  })
})

describe('recovering what was not stored', () => {
  it('recognises the standard array in any arrangement', () => {
    expect(detectAbilityMethod([8, 10, 12, 13, 14, 15], context.catalog)).toBe('standardArray')
    expect(detectAbilityMethod([15, 14, 13, 12, 10, 8], context.catalog)).toBe('standardArray')
  })

  it('recognises a legal point-buy spread', () => {
    expect(detectAbilityMethod([15, 15, 15, 8, 8, 8], context.catalog)).toBe('pointBuy')
  })

  it('calls anything else manual', () => {
    expect(detectAbilityMethod([18, 18, 18, 18, 18, 18], context.catalog)).toBe('manual')
    expect(detectAbilityMethod([15, 14, 13, 12, 10, 8], null)).toBe('manual')
  })
})

describe('starting hit points', () => {
  it('is the whole die at first level, plus Constitution', () => {
    expect(startingHitPoints(10, 1, 2)).toBe(12)
  })

  it('takes the fixed average afterwards rather than rolling for you', () => {
    // d10: 10 + 2, then two levels of (6 + 2).
    expect(startingHitPoints(10, 3, 2)).toBe(28)
  })

  it('never lands on zero, however bad the Constitution', () => {
    expect(startingHitPoints(6, 1, -5)).toBe(1)
  })
})
