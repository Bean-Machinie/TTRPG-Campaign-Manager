import { describe, expect, it } from 'vitest'
import { BANNER_PRESETS, DEFAULT_BANNER_PRESET, isBannerPreset } from './bannerPresets'

describe('profile banner presets', () => {
  it('keeps the default in the curated preset list', () => {
    expect(isBannerPreset(DEFAULT_BANNER_PRESET)).toBe(true)
  })

  it('accepts only curated banner keys', () => {
    for (const preset of BANNER_PRESETS) expect(isBannerPreset(preset.key)).toBe(true)
    expect(isBannerPreset('custom-upload')).toBe(false)
    expect(isBannerPreset(null)).toBe(false)
  })
})
