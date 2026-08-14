import { describe, expect, it } from 'vitest'
import { deriveEntity, displayValue, isOverridden, proficiencyBonus } from './derive'
import { gameSystemDefinitionSchema } from './system'
import { entityDataSchema } from './entityData'
import type { GameSystemDefinition } from './system'
import type { EntityData } from './entityData'

/**
 * The derivation module is the one piece of this feature with real arithmetic
 * in it, and the only piece that can be tested without a database, a session or
 * a browser. So it is tested hard, against a definition small enough to hold in
 * your head but shaped exactly like the 5e one: abilities, skills governed by
 * them, a proficiency table, ranks as multipliers, and two derived stats.
 *
 * Deliberately not the real 5e definition. That one lives in a database row and
 * a copy here would be a second source of truth for eighteen skills; what these
 * tests are for is the evaluator, and an evaluator that handles three skills
 * correctly handles eighteen.
 */

const PROFICIENCY_TABLE = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6]

const system: GameSystemDefinition = gameSystemDefinitionSchema.parse({
  abilityModifier: { offset: 10, divisor: 2 },
  abilities: [
    { key: 'str', name: 'Strength', abbr: 'STR' },
    { key: 'dex', name: 'Dexterity', abbr: 'DEX' },
    { key: 'wis', name: 'Wisdom', abbr: 'WIS' },
  ],
  skills: [
    { key: 'athletics', name: 'Athletics', ability: 'str' },
    { key: 'stealth', name: 'Stealth', ability: 'dex' },
    { key: 'perception', name: 'Perception', ability: 'wis' },
  ],
  passiveSkills: ['perception'],
  proficiencyBonusByLevel: PROFICIENCY_TABLE,
  levelRange: { min: 1, max: 20 },
  proficiencyRanks: [
    { key: 'none', name: 'Not proficient', multiplier: 0 },
    { key: 'half', name: 'Half proficient', multiplier: 0.5 },
    { key: 'proficient', name: 'Proficient', multiplier: 1 },
    { key: 'expertise', name: 'Expertise', multiplier: 2 },
  ],
  derived: [
    {
      key: 'armorClass',
      label: 'Armor Class',
      formula: {
        op: 'sum',
        of: [
          { op: 'const', value: 10 },
          { op: 'abilityMod', ability: 'dex' },
        ],
      },
    },
    {
      key: 'initiative',
      label: 'Initiative',
      formula: { op: 'abilityMod', ability: 'dex' },
    },
    {
      // Exists only to prove that a formula naming another stat sees that
      // stat's *displayed* value, overrides included.
      key: 'shieldedArmorClass',
      label: 'Armor Class with a shield',
      formula: {
        op: 'sum',
        of: [
          { op: 'stat', key: 'armorClass' },
          { op: 'const', value: 2 },
        ],
      },
    },
  ],
})

function entity(overrides: Partial<EntityData> = {}): EntityData {
  return entityDataSchema.parse({
    derive: true,
    level: 5,
    abilities: { str: 16, dex: 14, wis: 11 },
    ...overrides,
  })
}

/** What the sheet would print. Every assertion below is about this. */
function shown(data: EntityData, key: string): number | null {
  return displayValue(deriveEntity(system, data).stats[key])
}

describe('ability modifiers', () => {
  it('floors towards negative infinity, so odd and low scores are right', () => {
    const sheet = deriveEntity(
      system,
      entity({ abilities: { str: 16, dex: 15, wis: 7 } }),
    )

    expect(sheet.abilities.str.modifier).toBe(3)
    expect(sheet.abilities.dex.modifier).toBe(2)
    // 7 is -1.5 before flooring. Rounding towards zero would give -1, which is
    // the classic off-by-one in every homebrew character sheet.
    expect(sheet.abilities.wis.modifier).toBe(-2)
  })

  it('reports a missing score as unknown rather than as ten', () => {
    const sheet = deriveEntity(system, entity({ abilities: { str: 16 } }))

    expect(sheet.abilities.dex).toEqual({ score: null, modifier: null })
  })

  it('is still read when derivation is switched off', () => {
    const sheet = deriveEntity(system, entity({ derive: false }))

    // A statblock prints STR 16 (+3). The modifier is a way of writing the
    // score down, not something the rules worked out.
    expect(sheet.abilities.str).toEqual({ score: 16, modifier: 3 })
    expect(sheet.stats['armorClass'].computed).toBeNull()
  })
})

describe('proficiency bonus', () => {
  it('comes from the table, indexed by level', () => {
    expect(proficiencyBonus(system, 1)).toBe(2)
    expect(proficiencyBonus(system, 5)).toBe(3)
    expect(proficiencyBonus(system, 20)).toBe(6)
  })

  it('has no answer for a level the table does not cover', () => {
    expect(proficiencyBonus(system, null)).toBeNull()
    expect(proficiencyBonus(system, 0)).toBeNull()
    expect(proficiencyBonus(system, 21)).toBeNull()
  })
})

describe('saves and skills', () => {
  it('adds nothing when not proficient', () => {
    expect(shown(entity(), 'save.dex')).toBe(2)
    expect(shown(entity(), 'skill.stealth')).toBe(2)
  })

  it('adds the proficiency bonus when proficient', () => {
    const data = entity({ proficiencies: { saves: { dex: 'proficient' }, skills: {} } })

    // +2 dex, +3 at level 5.
    expect(shown(data, 'save.dex')).toBe(5)
  })

  it('doubles it for expertise', () => {
    const data = entity({ proficiencies: { saves: {}, skills: { stealth: 'expertise' } } })

    expect(shown(data, 'skill.stealth')).toBe(8)
  })

  it('rounds a fractional rank down', () => {
    const data = entity({ proficiencies: { saves: {}, skills: { athletics: 'half' } } })

    // +3 str, half of a +3 bonus is 1.5, and the rules round down.
    expect(shown(data, 'skill.athletics')).toBe(4)
  })

  it('is unknown when the governing ability is', () => {
    const data = entity({ abilities: { str: 16 } })

    expect(shown(data, 'skill.stealth')).toBeNull()
    expect(shown(data, 'save.dex')).toBeNull()
  })

  it('is unknown when the level, and so the bonus, is missing', () => {
    const data = entity({ level: null, proficiencies: { saves: {}, skills: { stealth: 'proficient' } } })

    expect(shown(data, 'skill.stealth')).toBeNull()
    // But a skill nobody is proficient in never needed the bonus.
    expect(shown(data, 'skill.athletics')).toBe(3)
  })

  it('treats an unrecognised rank as unknown rather than as none', () => {
    const data = entity({ proficiencies: { saves: {}, skills: { stealth: 'jack-of-all-trades' } } })

    expect(shown(data, 'skill.stealth')).toBeNull()
  })
})

describe('passive scores', () => {
  it('count up from the base in the definition', () => {
    expect(shown(entity(), 'passive.perception')).toBe(10)
  })

  it('follow an override on the skill they are built from', () => {
    const data = entity({ overrides: { 'skill.perception': 7 } })

    expect(shown(data, 'passive.perception')).toBe(17)
  })
})

describe('derived stats', () => {
  it('evaluate the formula from the definition', () => {
    expect(shown(entity(), 'armorClass')).toBe(12)
    expect(shown(entity(), 'initiative')).toBe(2)
  })

  it('are unknown when an input is missing, rather than treating it as zero', () => {
    const data = entity({ abilities: { str: 16 } })

    // 10 would be a number the product invented and then printed in the same
    // weight as one it worked out.
    expect(shown(data, 'armorClass')).toBeNull()
  })

  it('read another stat at its displayed value, so overrides propagate', () => {
    const data = entity({ overrides: { armorClass: 17 } })

    expect(shown(data, 'shieldedArmorClass')).toBe(19)
  })
})

describe('overrides', () => {
  it('win over the computed value without erasing it', () => {
    const sheet = deriveEntity(system, entity({ overrides: { armorClass: 17 } }))

    expect(sheet.stats['armorClass']).toEqual({ computed: 12, override: 17 })
    expect(displayValue(sheet.stats['armorClass'])).toBe(17)
    expect(isOverridden(sheet.stats['armorClass'])).toBe(true)
  })

  it('are not flagged when they agree with the rules', () => {
    const sheet = deriveEntity(system, entity({ overrides: { armorClass: 12 } }))

    expect(isOverridden(sheet.stats['armorClass'])).toBe(false)
  })

  it('still apply when derivation is switched off', () => {
    const data = entity({ derive: false, overrides: { armorClass: 17 } })

    expect(shown(data, 'armorClass')).toBe(17)
  })
})

describe('a statblock', () => {
  /**
   * The claim the whole design rests on: a monster is not a second kind of
   * row, it is an entity whose numbers are asserted rather than worked out.
   */
  const dragon = entityDataSchema.parse({
    derive: false,
    challengeRating: 17,
    creatureType: 'dragon',
    abilities: { str: 27, dex: 10, wis: 15 },
    overrides: {
      armorClass: 19,
      initiative: 0,
      'save.dex': 6,
      'skill.perception': 13,
      'passive.perception': 23,
    },
  })

  it('shows what it asserts, with nothing computed behind it', () => {
    const sheet = deriveEntity(system, dragon)

    expect(sheet.stats['armorClass']).toEqual({ computed: null, override: 19 })
    expect(displayValue(sheet.stats['save.dex'])).toBe(6)
    expect(displayValue(sheet.stats['passive.perception'])).toBe(23)
  })

  it('leaves anything it did not assert blank rather than guessing', () => {
    const sheet = deriveEntity(system, dragon)

    expect(displayValue(sheet.stats['skill.athletics'])).toBeNull()
    expect(displayValue(sheet.stats['shieldedArmorClass'])).toBeNull()
  })

  it('goes through the same function as a character', () => {
    // Not an assertion about values — an assertion about shape. The renderer
    // gets the same keys either way, which is why there is one renderer.
    const character = deriveEntity(system, entity())
    const statblock = deriveEntity(system, dragon)

    expect(Object.keys(statblock.stats)).toEqual(Object.keys(character.stats))
  })
})

describe('a definition that eats itself', () => {
  const circular: GameSystemDefinition = gameSystemDefinitionSchema.parse({
    ...system,
    derived: [
      { key: 'alpha', label: 'Alpha', formula: { op: 'stat', key: 'beta' } },
      { key: 'beta', label: 'Beta', formula: { op: 'stat', key: 'alpha' } },
    ],
  })

  it('resolves to no value rather than to a stack overflow', () => {
    const sheet = deriveEntity(circular, entity())

    expect(sheet.stats['alpha'].computed).toBeNull()
    expect(sheet.stats['beta'].computed).toBeNull()
  })

  it('still honours an override inside the cycle', () => {
    const sheet = deriveEntity(circular, entity({ overrides: { alpha: 15 } }))

    expect(displayValue(sheet.stats['alpha'])).toBe(15)
    // Beta reads alpha, and alpha is asserted, so beta is knowable after all.
    expect(displayValue(sheet.stats['beta'])).toBe(15)
  })
})
