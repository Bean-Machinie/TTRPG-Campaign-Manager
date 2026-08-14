import { describe, expect, it } from 'vitest'
import {
  PROFICIENCY_BONUS_KEY,
  expressionReferences,
  gameSystemDefinitionSchema,
  statKeys,
  statLabel,
} from './system'

/**
 * A system definition is content, and content is written by hand and pasted
 * into a SQL editor. So the schema's job is not only to describe the shape but
 * to catch the mistakes that shape allows: a skill governed by an ability that
 * does not exist parses perfectly and derives NaN, and NaN on a character sheet
 * is a bug report that takes an afternoon to trace back to a typo in a blob.
 */

const minimal = {
  abilities: [
    { key: 'dex', name: 'Dexterity', abbr: 'DEX' },
    { key: 'wis', name: 'Wisdom', abbr: 'WIS' },
  ],
  skills: [{ key: 'stealth', name: 'Stealth', ability: 'dex' }],
  proficiencyBonusByLevel: [2, 2, 3],
  levelRange: { min: 1, max: 3 },
  proficiencyRanks: [{ key: 'proficient', name: 'Proficient', multiplier: 1 }],
}

describe('gameSystemDefinitionSchema', () => {
  it('fills in what every d20 system agrees on', () => {
    const definition = gameSystemDefinitionSchema.parse(minimal)

    expect(definition.abilityModifier).toEqual({ offset: 10, divisor: 2 })
    expect(definition.passiveBase).toBe(10)
    expect(definition.derived).toEqual([])
  })

  it('drops fields it does not know about, rather than failing on them', () => {
    // A definition written against a later version of this schema should cost
    // you the field, not the ruleset.
    const definition = gameSystemDefinitionSchema.parse({ ...minimal, encumbrance: 'variant' })

    expect(definition).not.toHaveProperty('encumbrance')
  })

  it('refuses a skill governed by an ability that does not exist', () => {
    const result = gameSystemDefinitionSchema.safeParse({
      ...minimal,
      skills: [{ key: 'stealth', name: 'Stealth', ability: 'dexterity' }],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('not one of this system')
  })

  it('refuses a passive score for a skill that does not exist', () => {
    const result = gameSystemDefinitionSchema.safeParse({
      ...minimal,
      passiveSkills: ['perception'],
    })

    expect(result.success).toBe(false)
  })

  it('refuses duplicate keys', () => {
    const result = gameSystemDefinitionSchema.safeParse({
      ...minimal,
      abilities: [...minimal.abilities, { key: 'dex', name: 'Agility', abbr: 'AGI' }],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('Duplicate')
  })

  it('refuses a formula naming an ability or a stat that does not exist', () => {
    const badAbility = gameSystemDefinitionSchema.safeParse({
      ...minimal,
      derived: [
        { key: 'armorClass', label: 'AC', formula: { op: 'abilityMod', ability: 'con' } },
      ],
    })

    const badStat = gameSystemDefinitionSchema.safeParse({
      ...minimal,
      derived: [{ key: 'armorClass', label: 'AC', formula: { op: 'stat', key: 'touchAc' } }],
    })

    expect(badAbility.success).toBe(false)
    expect(badStat.success).toBe(false)
  })

  it('refuses a proficiency table with fewer rows than the game has levels', () => {
    const result = gameSystemDefinitionSchema.safeParse({
      ...minimal,
      levelRange: { min: 1, max: 20 },
    })

    // Otherwise a level 12 character silently takes the level 3 bonus.
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('20 entries')
  })

  it('refuses an unknown operation in a formula', () => {
    const result = gameSystemDefinitionSchema.safeParse({
      ...minimal,
      derived: [{ key: 'armorClass', label: 'AC', formula: { op: 'sqrt', of: [] } }],
    })

    expect(result.success).toBe(false)
  })
})

describe('expressionReferences', () => {
  it('reaches into nested operands', () => {
    const references = expressionReferences({
      op: 'max',
      of: [
        { op: 'const', value: 10 },
        {
          op: 'sum',
          of: [
            { op: 'abilityMod', ability: 'dex' },
            { op: 'abilityScore', ability: 'wis' },
            { op: 'stat', key: 'armorClass' },
          ],
        },
      ],
    })

    expect(references.abilities).toEqual(['dex', 'wis'])
    expect(references.stats).toEqual(['armorClass'])
  })
})

describe('the stat namespace', () => {
  const definition = gameSystemDefinitionSchema.parse({
    ...minimal,
    passiveSkills: ['stealth'],
    derived: [
      { key: 'armorClass', label: 'Armor Class', formula: { op: 'const', value: 10 } },
    ],
  })

  it('names every value that can be overridden, and nothing else', () => {
    expect(statKeys(definition)).toEqual([
      PROFICIENCY_BONUS_KEY,
      'save.dex',
      'save.wis',
      'skill.stealth',
      'passive.stealth',
      'armorClass',
    ])
  })

  it('turns a key back into something a person would read', () => {
    expect(statLabel(definition, PROFICIENCY_BONUS_KEY)).toBe('Proficiency bonus')
    expect(statLabel(definition, 'save.dex')).toBe('Dexterity save')
    expect(statLabel(definition, 'skill.stealth')).toBe('Stealth')
    expect(statLabel(definition, 'passive.stealth')).toBe('Passive Stealth')
    expect(statLabel(definition, 'armorClass')).toBe('Armor Class')
  })

  it('falls back to the key itself when it names nothing', () => {
    expect(statLabel(definition, 'skill.brewing')).toBe('skill.brewing')
  })
})
