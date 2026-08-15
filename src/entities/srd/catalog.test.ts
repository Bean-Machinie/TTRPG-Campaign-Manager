import { describe, expect, it } from 'vitest'
import {
  SRD_REFERENCE,
  catalogFor,
  featuresForClass,
  findClass,
} from './catalog'

describe('the SRD 5.2.1 catalog', () => {
  const catalog = catalogFor('dnd5e')!

  it('matches the classes, species, and backgrounds published by the SRD', () => {
    expect(catalog.classes).toHaveLength(12)
    expect(catalog.species).toHaveLength(9)
    expect(catalog.backgrounds.map((background) => background.name)).toEqual([
      'Acolyte',
      'Criminal',
      'Sage',
      'Soldier',
    ])
  })

  it('carries a pinned source revision for reproducible review', () => {
    expect(SRD_REFERENCE.version).toBe('5.2.1')
    expect(SRD_REFERENCE.revision).toMatch(/^[a-f0-9]{40}$/)
  })

  it('shows level-gated core features and only the chosen subclass', () => {
    const rogue = findClass(catalog, 'Rogue')
    const early = featuresForClass(rogue, 2, null).map((feature) => feature.name)
    const thief = featuresForClass(rogue, 3, 'Thief').map((feature) => feature.name)

    expect(early).toContain('Cunning Action')
    expect(early).not.toContain('Steady Aim')
    expect(thief).toContain('Fast Hands')
  })

  it('includes level-dependent species traits and size choices', () => {
    const dragonborn = catalog.species.find((species) => species.key === 'dragonborn')!
    const human = catalog.species.find((species) => species.key === 'human')!

    expect(dragonborn.traits).toContain('Draconic Flight')
    expect(human.sizes).toEqual(['Small', 'Medium'])
  })
})
