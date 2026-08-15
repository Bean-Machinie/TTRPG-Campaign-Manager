import { useState } from 'react'
import type { ReactNode } from 'react'
import { deriveEntity } from '../../../../entities/derive'
import { formatModifier } from '../../../../entities/entityData'
import type { Feature } from '../../../../entities/entityData'
import type { GameSystemDefinition } from '../../../../entities/system'
import { Alert } from '../../../../components/ui/Alert'
import { Button } from '../../../../components/ui/Button'
import { Input } from '../../../../components/ui/Input'
import { Textarea } from '../../../../components/ui/Textarea'
import { computedOf, numberOrNull } from './fields'

/**
 * The controls the detail page's sections are built from.
 *
 * Lifted out of the old EntityForm rather than rewritten, because the controls
 * were never the problem with that form — putting all ninety of them on one
 * page was. The override input in particular is worth keeping exactly as it
 * was: a number box whose placeholder is what the rules would have said, so
 * empty means "take the computed value" and filled means "no, this". That is
 * `override ?? computed` as a control instead of as a comment.
 */

/**
 * A section that reads until you ask to change it.
 *
 * The edit affordance is per section and not per page, which is the whole point
 * of the restructure: a character sheet is read far more often than it is
 * written, and a page permanently in edit mode is a page permanently asking to
 * be filled in. Cancel restores from the row rather than undoing keystrokes,
 * which is why the caller supplies it — only the caller knows what its draft
 * was seeded from.
 */
export function EditableSection({
  title,
  editable,
  editing,
  onEdit,
  onCancel,
  onSave,
  children,
}: {
  title: string
  editable: boolean
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => Promise<void>
  children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setBusy(true)
    setError(null)

    try {
      await onSave()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save that change.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          {title}
        </h2>

        {editable ? (
          editing ? (
            <span className="flex gap-2">
              <Button disabled={busy} onClick={() => void handleSave()}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={onCancel}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          )
        ) : null}
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {children}
    </section>
  )
}

/**
 * A number box whose placeholder is what the rules would have said.
 *
 * Empty means "take the computed value", filled means "no, this". Nothing has
 * to explain that, because the greyed-out number is sitting in the box the
 * moment you look at it.
 */
export function OverrideField({
  label,
  computed,
  value,
  onChange,
}: {
  label: string
  computed: number | null
  value: number | undefined
  onChange: (value: number | null) => void
}) {
  return (
    <Input
      label={label}
      type="number"
      placeholder={computed === null ? '—' : String(computed)}
      value={value ?? ''}
      onChange={(event) => onChange(numberOrNull(event.target.value))}
    />
  )
}

export function ProficiencyTable({
  definition,
  rows,
  ranks,
  onRank,
  overrides,
  onOverride,
  sheet,
}: {
  definition: GameSystemDefinition
  rows: Array<{ key: string; label: string; statKey: string }>
  ranks: Record<string, string>
  onRank: (key: string, rank: string) => void
  overrides: Record<string, number>
  onOverride: (key: string, value: number | null) => void
  sheet: ReturnType<typeof deriveEntity> | null
}) {
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[1fr_9rem_6rem] items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">{row.label}</span>

          <select
            aria-label={`${row.label} proficiency`}
            className="field__input field__select"
            value={ranks[row.key] ?? ''}
            onChange={(event) => onRank(row.key, event.target.value)}
          >
            <option value="">Not proficient</option>
            {definition.proficiencyRanks
              .filter((rank) => rank.multiplier !== 0)
              .map((rank) => (
                <option key={rank.key} value={rank.key}>
                  {rank.name}
                </option>
              ))}
          </select>

          <input
            aria-label={`${row.label} value`}
            type="number"
            className="field__input"
            placeholder={formatModifier(computedOf(sheet, row.statKey))}
            value={overrides[row.statKey] ?? ''}
            onChange={(event) => onOverride(row.statKey, numberOrNull(event.target.value))}
          />
        </li>
      ))}
    </ul>
  )
}

export function FeatureEditor({
  features,
  addLabel,
  onChange,
}: {
  features: Feature[]
  addLabel: string
  onChange: (features: Feature[]) => void
}) {
  function update(index: number, changes: Partial<Feature>) {
    onChange(features.map((feature, at) => (at === index ? { ...feature, ...changes } : feature)))
  }

  return (
    <div className="flex flex-col gap-3">
      {features.map((feature, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-800"
        >
          <Input
            label="Name"
            value={feature.name}
            onChange={(event) => update(index, { name: event.target.value })}
          />
          <Textarea
            label="Text"
            value={feature.text}
            onChange={(event) => update(index, { text: event.target.value })}
          />
          <div>
            <Button
              variant="secondary"
              onClick={() => onChange(features.filter((_, at) => at !== index))}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}

      <div>
        <Button variant="secondary" onClick={() => onChange([...features, { name: '', text: '' }])}>
          {addLabel}
        </Button>
      </div>
    </div>
  )
}

/**
 * A text box with suggestions behind it.
 *
 * The system's creature types and sizes are a vocabulary, not a constraint —
 * homebrew is the entire reason this feature has overrides — so they are
 * offered rather than enforced.
 */
export function Datalist({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  const listId = `datalist-${label.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div>
      <Input
        label={label}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  )
}
