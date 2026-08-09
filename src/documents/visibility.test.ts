import { describe, expect, it } from 'vitest'
import { VISIBILITY_TIERS, mostRestrictive } from './visibility'
import type { DocumentVisibility } from './visibility'

describe('mostRestrictive', () => {
  it('leaves two shared visibilities shared', () => {
    expect(mostRestrictive('shared', 'shared')).toBe('shared')
  })

  it('narrows shared to gm_only', () => {
    expect(mostRestrictive('shared', 'gm_only')).toBe('gm_only')
  })

  it('narrows gm_only to author_only', () => {
    expect(mostRestrictive('gm_only', 'author_only')).toBe('author_only')
  })

  // The tier a GM must not be able to widen. A secret block inside somebody's
  // private document is still theirs alone.
  it('does not widen author_only', () => {
    expect(mostRestrictive('author_only', 'shared')).toBe('author_only')
    expect(mostRestrictive('author_only', 'gm_only')).toBe('author_only')
  })

  it('is symmetric', () => {
    for (const a of VISIBILITY_TIERS) {
      for (const b of VISIBILITY_TIERS) {
        expect(mostRestrictive(a, b)).toBe(mostRestrictive(b, a))
      }
    }
  })

  it('never returns a tier looser than either input', () => {
    const looseness: Record<DocumentVisibility, number> = {
      shared: 0,
      gm_only: 1,
      author_only: 2,
    }

    for (const a of VISIBILITY_TIERS) {
      for (const b of VISIBILITY_TIERS) {
        const result = mostRestrictive(a, b)
        expect(looseness[result]).toBeGreaterThanOrEqual(Math.max(looseness[a], looseness[b]))
      }
    }
  })
})
