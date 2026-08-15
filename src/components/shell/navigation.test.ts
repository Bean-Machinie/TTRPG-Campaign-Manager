import { describe, expect, it } from 'vitest'
import {
  campaignKey,
  expansionAfterSectionActivation,
  isEntryRoute,
  revealedKeys,
  sectionKey,
} from './navigation'

describe('tree item identity', () => {
  it('gives the same section in different campaigns a different stable key', () => {
    expect(sectionKey('campaign-a', 'documents')).not.toBe(
      sectionKey('campaign-b', 'documents'),
    )
    expect(sectionKey('campaign-a', '')).not.toBe(sectionKey('campaign-b', ''))
  })
})

describe('expansionAfterSectionActivation', () => {
  const documents = 'section:c1:documents'

  it('keeps an open destination expanded when navigating from another section', () => {
    expect(
      expansionAfterSectionActivation(new Set([documents]), documents, false, true).has(documents),
    ).toBe(true)
  })

  it('keeps the parent expanded when navigating from a record inside it', () => {
    expect(
      expansionAfterSectionActivation(new Set([documents]), documents, false, true).has(documents),
    ).toBe(true)
  })

  it('opens a closed destination when navigating from another section', () => {
    expect(
      expansionAfterSectionActivation(new Set(), documents, false, true).has(documents),
    ).toBe(true)
  })

  it('collapses an open section only when its exact overview label is pressed again', () => {
    expect(
      expansionAfterSectionActivation(new Set([documents]), documents, true, true).has(documents),
    ).toBe(false)
  })

  it('does not invent expansion state for a section without children', () => {
    expect(
      expansionAfterSectionActivation(new Set(), documents, false, false).has(documents),
    ).toBe(false)
  })
})

describe('isEntryRoute', () => {
  const character = '/app/campaigns/c1/entities/e-1'

  it('matches the entry itself', () => {
    expect(isEntryRoute(character, character)).toBe(true)
  })

  it('matches a section inside it, which is where a character is actually read', () => {
    expect(isEntryRoute(`${character}/sheet`, character)).toBe(true)
    expect(isEntryRoute(`${character}/description`, character)).toBe(true)
  })

  it('does not match a sibling whose id merely starts the same way', () => {
    expect(isEntryRoute('/app/campaigns/c1/entities/e-12', character)).toBe(false)
  })

  it('does not match the list the entry is in', () => {
    expect(isEntryRoute('/app/campaigns/c1/entities', character)).toBe(false)
  })
})

/**
 * Which rows the tree opens to show you where you are.
 *
 * The interesting half is the difference between the two kinds of entry: a
 * document has a page of its own and so its section has to be opened for the
 * row to exist, while a session's row points at the sessions list, which is
 * already visible under an open campaign. Getting that wrong is invisible in
 * the sidebar — it just quietly expands a nine-item list nobody asked for.
 */
describe('revealedKeys', () => {
  const documents = [
    { id: 'documents:doc-1', to: '/app/campaigns/c1/documents/doc-1' },
    { id: 'documents:doc-2', to: '/app/campaigns/c1/documents/doc-2' },
  ]
  const sessions = [
    { id: 'sessions:s-1', to: '/app/campaigns/c1/sessions' },
    { id: 'sessions:s-2', to: '/app/campaigns/c1/sessions' },
  ]

  it('opens nothing when the route is not inside a campaign', () => {
    expect(revealedKeys(null, documents, '/app/settings')).toEqual([])
  })

  it('opens the campaign for a campaign route', () => {
    expect(revealedKeys('c1', documents, '/app/campaigns/c1')).toEqual([campaignKey('c1')])
  })

  it('opens the campaign but not a section for a section route', () => {
    expect(revealedKeys('c1', documents, '/app/campaigns/c1/documents')).toEqual([
      campaignKey('c1'),
    ])
  })

  it('opens the section holding the document you are reading', () => {
    expect(revealedKeys('c1', documents, '/app/campaigns/c1/documents/doc-2')).toEqual([
      campaignKey('c1'),
      sectionKey('c1', 'documents'),
    ])
  })

  it('leaves a section shut when its entries have no page of their own', () => {
    expect(revealedKeys('c1', sessions, '/app/campaigns/c1/sessions')).toEqual([campaignKey('c1')])
  })

  it('opens the section holding the character you are looking at, on any of its tabs', () => {
    const characters = [{ id: 'entities:e-1', to: '/app/campaigns/c1/entities/e-1' }]

    expect(revealedKeys('c1', characters, '/app/campaigns/c1/entities/e-1/sheet')).toEqual([
      campaignKey('c1'),
      sectionKey('c1', 'entities'),
    ])
  })

  it('opens nothing extra before the campaign contents have loaded', () => {
    expect(revealedKeys('c1', [], '/app/campaigns/c1/documents/doc-2')).toEqual([campaignKey('c1')])
  })
})
