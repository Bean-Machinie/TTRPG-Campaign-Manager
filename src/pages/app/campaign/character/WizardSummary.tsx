import { deriveEntity, displayValue } from '../../../../entities/derive'
import { formatModifier } from '../../../../entities/entityData'
import { PROFICIENCY_BONUS_KEY, saveKey } from '../../../../entities/system'
import type { WizardContext, WizardDraft } from '../../../../entities/wizard/steps'

/**
 * The character so far, beside the step being filled in.
 *
 * This is what makes seven pages feel like one sequence rather than seven
 * forms. Choosing a Constitution on step four moves the hit points and three
 * saving throws in the panel next to it, which is the connection the old
 * single-page form had by accident — everything was visible, so everything was
 * seen to move — and which a wizard loses unless it puts it back on purpose.
 *
 * It shows what is known and prints an em dash for what is not, rather than
 * hiding rows until they fill in: a row that appears when you are not looking
 * at it is a change you will miss.
 */
export function WizardSummary({
  draft,
  context,
}: {
  draft: WizardDraft
  context: WizardContext
}) {
  const { definition } = context
  const sheet = deriveEntity(definition, draft.data)

  const hitPoints = draft.data.resources.hitPoints
  const classLine = draft.data.classes
    .map((entry) => `${entry.name}${entry.subclass ? ` (${entry.subclass})` : ''}`)
    .filter(Boolean)
    .join(', ')

  return (
    <aside
      aria-label="Character so far"
      className="flex flex-col gap-4 rounded-md border border-gray-200 p-4 text-sm dark:border-gray-800"
    >
      <div>
        <p className="font-semibold text-gray-900 dark:text-gray-100">
          {draft.name.trim() || 'Unnamed character'}
        </p>
        <p className="text-gray-500 dark:text-gray-400">
          {[
            draft.data.level === null ? null : `Level ${draft.data.level}`,
            classLine || null,
            draft.data.species,
            draft.data.background,
          ]
            .filter(Boolean)
            .join(' · ') || 'Nothing chosen yet'}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <Figure
          label="Hit points"
          value={hitPoints?.max !== null && hitPoints ? String(hitPoints.max) : '—'}
        />
        <Figure label="Proficiency" value={stat(sheet, PROFICIENCY_BONUS_KEY, true)} />
        {definition.derived.map((entry) => (
          <Figure
            key={entry.key}
            label={entry.label}
            value={stat(sheet, entry.key, entry.display === 'modifier')}
          />
        ))}
      </dl>

      <div>
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          Saving throws
        </h3>
        <ul className="grid grid-cols-3 gap-1">
          {definition.abilities.map((ability) => (
            <li key={ability.key} className="flex justify-between gap-1">
              <span className="text-gray-500 dark:text-gray-400">{ability.abbr}</span>
              <span className="tabular-nums">{stat(sheet, saveKey(ability.key), true)}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  )
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
