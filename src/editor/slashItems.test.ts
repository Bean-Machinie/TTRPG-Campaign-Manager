import { describe, expect, it } from 'vitest'
import { filterSlashGroups, flattenGroups } from './slashItems'

describe('cell command menu', () => {
  it('keeps lists out of the cell-type menu', () => {
    const titles = flattenGroups(filterSlashGroups('')).map((item) => item.title)

    expect(titles).not.toContain('Bullet list')
    expect(titles).not.toContain('Numbered list')
    expect(titles).not.toContain('Toggle')
  })

  it('does not offer GM-only cells to players', () => {
    const titles = flattenGroups(filterSlashGroups('', false)).map((item) => item.title)

    expect(titles).not.toContain('GM secret')
  })
})
