export const BANNER_PRESETS = [
  { key: 'astral', label: 'Astral blue' },
  { key: 'ember', label: 'Ember dusk' },
  { key: 'verdant', label: 'Verdant ruins' },
  { key: 'amethyst', label: 'Amethyst veil' },
  { key: 'frost', label: 'Frostbound sky' },
  { key: 'parchment', label: 'Ancient parchment' },
] as const

export type BannerPreset = (typeof BANNER_PRESETS)[number]['key']

export const DEFAULT_BANNER_PRESET: BannerPreset = 'astral'

export function isBannerPreset(value: unknown): value is BannerPreset {
  return BANNER_PRESETS.some((preset) => preset.key === value)
}
