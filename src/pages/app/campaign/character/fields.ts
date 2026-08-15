import type { deriveEntity } from '../../../../entities/derive'
import type { EntityData } from '../../../../entities/entityData'

/**
 * The small conversions the character forms share.
 *
 * Apart from the components in editors.tsx so that file exports components and
 * nothing else — which is what keeps fast refresh working on it, and is worth
 * one extra module for controls that are edited as often as these will be.
 */

/**
 * What the rules would say, ignoring what was typed.
 *
 * Deliberately the computed half rather than the displayed value: this is what
 * an override field shows as its placeholder, and a placeholder that echoed the
 * override already in the box would tell you nothing.
 */
export function computedOf(
  sheet: ReturnType<typeof deriveEntity> | null,
  key: string,
): number | null {
  return sheet?.stats[key]?.computed ?? null
}

export function numberOrNull(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const value = Number(trimmed)
  return Number.isFinite(value) ? Math.trunc(value) : null
}

export function toList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function withRank(
  ranks: Record<string, string>,
  key: string,
  rank: string,
): Record<string, string> {
  const next = { ...ranks }
  if (rank) next[key] = rank
  else delete next[key]
  return next
}

export function withResource(
  resources: EntityData['resources'],
  key: string,
  value: { current: number | null; max: number | null },
) {
  const next = { ...resources }

  if (value.current === null && value.max === null) delete next[key]
  else next[key] = { current: value.current ?? 0, max: value.max }

  return next
}
