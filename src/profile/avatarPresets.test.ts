import { describe, expect, it } from 'vitest'
import { AVATAR_PRESETS, avatarPosition, isAvatarPreset } from './avatarPresets'

describe('default profile avatars', () => {
  it('defines one unique cell for each portrait in the 4 by 2 sprite', () => {
    expect(AVATAR_PRESETS).toHaveLength(8)
    expect(new Set(AVATAR_PRESETS.map((preset) => preset.key)).size).toBe(8)
    expect(new Set(AVATAR_PRESETS.map((preset) => avatarPosition(preset.key))).size).toBe(8)
  })

  it('accepts only published preset keys', () => {
    expect(isAvatarPreset('dragonborn')).toBe(true)
    expect(isAvatarPreset('mimic')).toBe(false)
    expect(isAvatarPreset(null)).toBe(false)
  })
})
