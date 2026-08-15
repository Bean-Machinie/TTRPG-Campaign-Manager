export const AVATAR_PRESETS = [
  { key: 'knight', label: 'Human knight', column: 0, row: 0 },
  { key: 'elf', label: 'Elven mage', column: 1, row: 0 },
  { key: 'dwarf', label: 'Dwarven explorer', column: 2, row: 0 },
  { key: 'tiefling', label: 'Tiefling scholar', column: 3, row: 0 },
  { key: 'orc', label: 'Orc ranger', column: 0, row: 1 },
  { key: 'halfling', label: 'Halfling bard', column: 1, row: 1 },
  { key: 'dragonborn', label: 'Dragonborn guardian', column: 2, row: 1 },
  { key: 'cleric', label: 'Celestial cleric', column: 3, row: 1 },
] as const

export type AvatarPreset = (typeof AVATAR_PRESETS)[number]['key']

export function isAvatarPreset(value: unknown): value is AvatarPreset {
  return AVATAR_PRESETS.some((preset) => preset.key === value)
}

export function avatarPosition(preset: AvatarPreset): string {
  const entry = AVATAR_PRESETS.find((candidate) => candidate.key === preset)!
  return `${(entry.column / 3) * 100}% ${entry.row * 100}%`
}
