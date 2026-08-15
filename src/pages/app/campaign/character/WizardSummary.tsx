import { deriveEntity, displayValue } from '../../../../entities/derive'
import { formatModifier } from '../../../../entities/entityData'
import { PROFICIENCY_BONUS_KEY } from '../../../../entities/system'
import type { WizardContext, WizardDraft } from '../../../../entities/wizard/steps'
import { ENTITY_KIND_LABELS } from '../../../../campaigns/types'
import { CharacterPortraitUpload } from './CharacterPortraitUpload'
import '../characterGallery.css'

/** The gallery card, alive beside the form while the character takes shape. */
export function WizardSummary({
  draft,
  context,
  portrait,
  onPortraitChange,
}: {
  draft: WizardDraft
  context: WizardContext
  portrait: string | null
  onPortraitChange: (value: string | null) => void
}) {
  const sheet = deriveEntity(context.definition, draft.data)
  const hitPoints = draft.data.resources.hitPoints
  const characterClass = draft.data.classes[0]
  const subtitle =
    [
      characterClass?.name,
      draft.data.species,
      draft.data.background,
    ]
      .filter(Boolean)
      .join(' · ') || draft.summary || 'Your choices will appear here.'
  const palette = draft.kind === 'pc' ? 'violet' : draft.kind === 'npc' ? 'ocean' : 'ember'
  const level = draft.data.level === null ? null : `LV ${draft.data.level}`
  const badge = level ?? ENTITY_KIND_LABELS[draft.kind]
  const previewStats = [
    {
      label: 'HP',
      value: hitPoints?.max === null || !hitPoints ? '—' : String(hitPoints.max),
    },
    {
      label: 'PROF',
      value: stat(sheet, PROFICIENCY_BONUS_KEY, true),
    },
    ...context.definition.derived.slice(0, 2).map((entry) => ({
      label: entry.label,
      value: stat(sheet, entry.key, entry.display === 'modifier'),
    })),
  ]

  return (
    <aside aria-label="Live character preview" className="lg:sticky lg:top-24 lg:self-start">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100">Live preview</p>
          <p className="m-0 text-xs text-gray-500 dark:text-gray-400">Updates as you build.</p>
        </div>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">PNG/JPG · 2 MB</span>
      </div>

      <div className={`character-card character-card--preview character-card--${palette}`}>
        <span className="character-card__art" aria-hidden="true">
          <span className="character-card__monogram">{initials(draft.name) || '?'}</span>
        </span>
        <CharacterPortraitUpload
          value={portrait}
          characterName={draft.name}
          onChange={onPortraitChange}
        />
        <span className="character-card__scrim" aria-hidden="true" />
        <span className="character-card__level">{badge}</span>

        <span className="character-card__content">
          <span className="character-card__name">{draft.name.trim() || 'Unnamed character'}</span>
          <span className="character-card__subtitle">{subtitle}</span>
          <span className="character-card__rule" aria-hidden="true" />
          <span className="character-card__meta">
            {previewStats.map((entry) => (
              <span key={entry.label}>
                {entry.label} {entry.value}
              </span>
            ))}
          </span>
        </span>
      </div>
    </aside>
  )
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function stat(
  sheet: ReturnType<typeof deriveEntity>,
  key: string,
  asModifier: boolean,
): string {
  const derived = sheet.stats[key]
  const value = derived ? displayValue(derived) : null
  if (value === null) return '—'
  return asModifier ? formatModifier(value) : String(value)
}
