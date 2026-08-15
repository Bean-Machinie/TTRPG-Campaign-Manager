import { useState } from 'react'
import type { EntityData } from '../../../../../entities/entityData'
import { Input } from '../../../../../components/ui/Input'
import { Textarea } from '../../../../../components/ui/Textarea'
import { useCharacterDetail } from '../detailContext'
import { Datalist, EditableSection } from '../editors'
import { toList } from '../fields'

/**
 * Who they are away from the arithmetic.
 *
 * One editable block rather than four, because these fields are written in one
 * sitting — nobody edits their appearance without also having something to say
 * about their personality — and four separate Edit buttons would be four
 * separate saves of the same paragraph of thought.
 *
 * The physical details sit here too, and not on the Sheet tab, even though a
 * couple of them look like statistics. Speed and senses are read while
 * describing a scene, not while working out a number, and this is the tab
 * somebody is on when they are describing a scene.
 */
export function DescriptionSection() {
  const { entity, system, display, editable, save } = useCharacterDetail()
  const definition = system.definition

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<EntityData>(entity.data)
  const [summary, setSummary] = useState(entity.summary ?? '')

  function begin() {
    setDraft(entity.data)
    setSummary(entity.summary ?? '')
    setEditing(true)
  }

  async function commit() {
    await save({ data: draft, summary: summary.trim() || null })
    setEditing(false)
  }

  function patch(changes: Partial<EntityData>) {
    setDraft((current) => ({ ...current, ...changes }))
  }

  return (
    <EditableSection
      title="Description"
      editable={editable}
      editing={editing}
      onEdit={begin}
      onCancel={() => setEditing(false)}
      onSave={commit}
    >
      {editing ? (
        <div className="flex flex-col gap-4">
          <Textarea
            label="Summary"
            hint="One line, for the character list."
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Alignment"
              value={draft.alignment ?? ''}
              onChange={(event) => patch({ alignment: event.target.value || null })}
            />
            <Datalist
              label="Size"
              options={definition.sizes}
              value={draft.size ?? ''}
              onChange={(value) => patch({ size: value || null })}
            />
            <Datalist
              label="Creature type"
              options={definition.creatureTypes}
              value={draft.creatureType ?? ''}
              onChange={(value) => patch({ creatureType: value || null })}
            />
            <Input
              label="Speed"
              placeholder="30 ft."
              value={draft.speed ?? ''}
              onChange={(event) => patch({ speed: event.target.value || null })}
            />
            <Input
              label="Senses"
              placeholder="darkvision 60 ft."
              value={draft.senses ?? ''}
              onChange={(event) => patch({ senses: event.target.value || null })}
            />
            <Input
              label="Languages"
              value={draft.languages ?? ''}
              onChange={(event) => patch({ languages: event.target.value || null })}
            />
            <Input
              label="Damage resistances"
              placeholder="fire, cold"
              value={draft.damageResistances.join(', ')}
              onChange={(event) => patch({ damageResistances: toList(event.target.value) })}
            />
            <Input
              label="Damage immunities"
              value={draft.damageImmunities.join(', ')}
              onChange={(event) => patch({ damageImmunities: toList(event.target.value) })}
            />
            <Input
              label="Condition immunities"
              value={draft.conditionImmunities.join(', ')}
              onChange={(event) => patch({ conditionImmunities: toList(event.target.value) })}
            />
          </div>

          <Textarea
            label="Appearance"
            value={draft.appearance ?? ''}
            onChange={(event) => patch({ appearance: event.target.value || null })}
          />
          <Textarea
            label="Personality"
            value={draft.personality ?? ''}
            onChange={(event) => patch({ personality: event.target.value || null })}
          />
          <Textarea
            label="Backstory"
            rows={10}
            value={draft.backstory ?? ''}
            onChange={(event) => patch({ backstory: event.target.value || null })}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {details(display).map(([term, value]) => (
              <div key={term}>
                <dt className="text-gray-500 dark:text-gray-400">{term}</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{value}</dd>
              </div>
            ))}
          </dl>

          <Prose title="Appearance" text={display.appearance} />
          <Prose title="Personality" text={display.personality} />
          <Prose title="Backstory" text={display.backstory} />

          {!display.appearance && !display.personality && !display.backstory ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nothing written down yet.
            </p>
          ) : null}
        </div>
      )}
    </EditableSection>
  )
}

function Prose({ title, text }: { title: string; text: string | null }) {
  if (!text) return null

  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{text}</p>
    </section>
  )
}

function details(data: EntityData): Array<[string, string]> {
  const rows: Array<[string, string]> = []

  const push = (term: string, value: string | null) => {
    if (value) rows.push([term, value])
  }

  push('Species', data.species)
  push('Background', data.background)
  push('Alignment', data.alignment)
  push('Size', data.size)
  push('Type', data.creatureType)
  push('Speed', data.speed)
  push('Senses', data.senses)
  push('Languages', data.languages)
  push('Resistances', data.damageResistances.join(', '))
  push('Immunities', data.damageImmunities.join(', '))
  push('Condition immunities', data.conditionImmunities.join(', '))

  return rows
}
