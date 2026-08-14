import { describe, expect, it } from 'vitest'
import {
  applyOverlay,
  checkAgainstSystem,
  emptyEntityData,
  entityDataSchema,
  formatChallengeRating,
  formatModifier,
  parseChallengeRating,
  parseEntityData,
  parseEntitySecrets,
} from './entityData'
import { gameSystemDefinitionSchema } from './system'

const system = gameSystemDefinitionSchema.parse({
  abilities: [
    { key: 'str', name: 'Strength', abbr: 'STR' },
    { key: 'dex', name: 'Dexterity', abbr: 'DEX' },
  ],
  abilityScoreRange: { min: 1, max: 30 },
  skills: [{ key: 'stealth', name: 'Stealth', ability: 'dex' }],
  proficiencyBonusByLevel: [2, 2, 3],
  levelRange: { min: 1, max: 3 },
  proficiencyRanks: [
    { key: 'none', name: 'Not proficient', multiplier: 0 },
    { key: 'proficient', name: 'Proficient', multiplier: 1 },
  ],
  resources: [{ key: 'hitPoints', label: 'Hit points', track: 'pool' }],
  derived: [{ key: 'armorClass', label: 'Armor Class', formula: { op: 'const', value: 10 } }],
})

describe('reading a blob back out of the database', () => {
  it('fills in every field, so nothing downstream has to guess', () => {
    const data = parseEntityData({})

    expect(data.derive).toBe(true)
    expect(data.level).toBeNull()
    expect(data.abilities).toEqual({})
    expect(data.proficiencies).toEqual({ saves: {}, skills: {} })
    expect(data.traits).toEqual([])
  })

  it('drops fields it does not recognise', () => {
    // A row written under an older shape, or by a later version of the form.
    const data = parseEntityData({ level: 3, inspiration: true })

    expect(data.level).toBe(3)
    expect(data).not.toHaveProperty('inspiration')
  })

  it('falls back to a blank entity rather than throwing', () => {
    // A page that renders empty is a problem you can see and fix. A page that
    // throws is a white screen with a stack trace behind it.
    expect(parseEntityData({ abilities: 'strong' }).abilities).toEqual({})
    expect(parseEntityData(null).level).toBeNull()
    expect(parseEntitySecrets(undefined).gmNotes).toBeNull()
  })

  it('starts a character derived and a creature asserted', () => {
    expect(emptyEntityData('pc')).toMatchObject({ derive: true, level: 1 })
    expect(emptyEntityData('creature')).toMatchObject({ derive: false, level: null })
  })
})

describe('the GM overlay', () => {
  const published = entityDataSchema.parse({
    level: 3,
    abilities: { str: 10, dex: 10 },
    overrides: { armorClass: 12 },
    resources: { hitPoints: { current: 8, max: 8 } },
    traits: [{ name: 'Affable', text: 'Buys a round.' }],
  })

  it('is a no-op when there is nothing hidden', () => {
    // Which is what every player gets: `secrets` arrives as `{}` from the
    // server, so this is not a rule they could talk their way past.
    expect(applyOverlay(published, null)).toBe(published)
  })

  it('merges the maps key by key rather than replacing them wholesale', () => {
    const merged = applyOverlay(published, { abilities: { str: 18 } })

    expect(merged.abilities).toEqual({ str: 18, dex: 10 })
  })

  it('replaces the scalars and the lists it names, and leaves the rest alone', () => {
    const merged = applyOverlay(published, {
      level: 9,
      traits: [{ name: 'Doppelganger', text: 'Reads surface thoughts.' }],
    })

    expect(merged.level).toBe(9)
    expect(merged.traits).toHaveLength(1)
    expect(merged.traits[0].name).toBe('Doppelganger')
    expect(merged.resources).toEqual(published.resources)
  })

  it('can hide a null, which is not the same as saying nothing', () => {
    const merged = applyOverlay(published, { level: null })

    expect(merged.level).toBeNull()
  })
})

describe('checking data against a system', () => {
  const valid = entityDataSchema.parse({
    level: 2,
    abilities: { str: 12, dex: 14 },
    proficiencies: { saves: { dex: 'proficient' }, skills: { stealth: 'proficient' } },
    overrides: { armorClass: 15, 'skill.stealth': 6 },
    resources: { hitPoints: { current: 11, max: 11 } },
  })

  it("passes data that speaks the system's vocabulary", () => {
    expect(checkAgainstSystem(system, valid)).toEqual([])
  })

  it('catches a key that parses but derives nothing', () => {
    // The failure this whole function exists for: `strength` is a perfectly
    // good string, and a system whose ability is `str` will never look at it.
    const problems = checkAgainstSystem(
      system,
      entityDataSchema.parse({ abilities: { strength: 16 } }),
    )

    expect(problems).toContain('"strength" is not an ability in this system.')
  })

  it('catches an override on a stat that does not exist', () => {
    const problems = checkAgainstSystem(
      system,
      entityDataSchema.parse({ overrides: { touchAc: 12 } }),
    )

    expect(problems).toContain('"touchAc" is not a stat that can be overridden.')
  })

  it('catches an unknown proficiency rank, skill and resource', () => {
    const problems = checkAgainstSystem(
      system,
      entityDataSchema.parse({
        proficiencies: { saves: {}, skills: { brewing: 'expertise' } },
        resources: { sorceryPoints: { current: 2, max: 2 } },
      }),
    )

    expect(problems).toContain('"brewing" is not a skill in this system.')
    expect(problems).toContain('"expertise" is not a proficiency rank.')
    expect(problems).toContain('"sorceryPoints" is not a resource in this system.')
  })

  it('catches values outside the ranges the system declares', () => {
    const problems = checkAgainstSystem(
      system,
      entityDataSchema.parse({ level: 7, abilities: { str: 40 } }),
    )

    expect(problems).toContain('Level must be between 1 and 3.')
    expect(problems).toContain('STR must be between 1 and 30.')
  })
})

describe('challenge rating', () => {
  it('prints the three fractions the books use', () => {
    expect(formatChallengeRating(0.125)).toBe('1/8')
    expect(formatChallengeRating(0.25)).toBe('1/4')
    expect(formatChallengeRating(0.5)).toBe('1/2')
    expect(formatChallengeRating(17)).toBe('17')
    expect(formatChallengeRating(null)).toBe('—')
  })

  it('reads them back, so the form can be typed into', () => {
    expect(parseChallengeRating('1/8')).toBe(0.125)
    expect(parseChallengeRating(' 17 ')).toBe(17)
    expect(parseChallengeRating('')).toBeNull()
    expect(parseChallengeRating('very hard')).toBeNull()
    expect(parseChallengeRating('-2')).toBeNull()
  })
})

describe('formatModifier', () => {
  it('always carries a sign, because a sheet reads +0 and not 0', () => {
    expect(formatModifier(3)).toBe('+3')
    expect(formatModifier(0)).toBe('+0')
    expect(formatModifier(-1)).toBe('-1')
    expect(formatModifier(null)).toBe('—')
  })
})
