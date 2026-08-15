import { useState } from 'react'
import {
  SRD_REFERENCE,
  catalogFor,
  findBackground,
  findClass,
  findSpecies,
  featuresForClass,
} from '../../../../../entities/srd/catalog'
import type { EntityData } from '../../../../../entities/entityData'
import { useCharacterDetail } from '../detailContext'
import { EditableSection, FeatureEditor } from '../editors'

/**
 * What this character can do, as reference rather than as controls.
 *
 * Two kinds of thing, kept apart because they answer to different owners. The
 * class and species features come from the ruleset and are the same for every
 * fighter in every campaign, so they are listed and not editable — changing one
 * would mean changing it for a character rather than for the rules, which is
 * how house rules quietly become invisible. Traits and actions belong to this
 * character and are edited here.
 *
 * The catalogued list is by name and by level, without the rules text. A
 * feature list transcribed at half accuracy is worse than one that is honestly
 * short: the reader cannot tell which half they are looking at, and would
 * reasonably trust the wrong one at the table.
 */
export function FeaturesSection() {
  const { entity, system, display, editable, save } = useCharacterDetail()

  const catalog = catalogFor(system.key)
  const characterClass = findClass(catalog, display.classes[0]?.name ?? null)
  const species = findSpecies(catalog, display.species)
  const background = findBackground(catalog, display.background)
  const selectedSubclass = display.classes[0]?.subclass ?? null

  const [editing, setEditing] = useState<'traits' | 'actions' | null>(null)
  const [draft, setDraft] = useState<EntityData>(entity.data)

  function begin(section: typeof editing) {
    setDraft(entity.data)
    setEditing(section)
  }

  async function commit() {
    await save({ data: draft })
    setEditing(null)
  }

  const level = display.level ?? 0
  const classFeatures = featuresForClass(characterClass, level, selectedSubclass)

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Class features
          </h2>
          {characterClass ? (
            <a
              className="text-xs text-gray-500 underline dark:text-gray-400"
              href={SRD_REFERENCE.classesUrl}
              target="_blank"
              rel="noreferrer"
            >
              Read canonical SRD rules
            </a>
          ) : null}
        </div>

        {!characterClass ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {display.classes.length > 0
              ? `"${display.classes[0].name}" is not a class this ruleset knows about, so there is nothing to list.`
              : 'No class.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {classFeatures.map((feature) => (
              <li key={`${feature.level}-${feature.name}`} className="flex gap-3">
                <span className="w-16 shrink-0 text-gray-500 dark:text-gray-400">
                  Level {feature.level}
                </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {feature.name}
                  {feature.subclass ? (
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      {feature.subclass}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {characterClass ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Core proficiencies and equipment
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <ReferenceRow label="Primary ability" value={characterClass.primaryAbility} />
            <ReferenceRow label="Weapons" value={characterClass.weaponProficiencies} />
            <ReferenceRow label="Armor training" value={characterClass.armorTraining} />
            {characterClass.toolProficiencies ? (
              <ReferenceRow label="Class tools" value={characterClass.toolProficiencies} />
            ) : null}
            <ReferenceRow label="Starting equipment" value={characterClass.startingEquipment} wide />
          </dl>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
          Species traits
        </h2>

        {species ? (
          <ul className="flex flex-wrap gap-2 text-sm">
            {species.traits.map((trait) => (
              <li
                key={trait}
                className="rounded border border-gray-200 px-2 py-1 text-gray-700 dark:border-gray-700 dark:text-gray-300"
              >
                {trait}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {display.species
              ? `"${display.species}" is not a species this ruleset knows about.`
              : 'No species.'}
          </p>
        )}
      </section>

      {background ? (
        <section>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
              Background benefits
            </h2>
            <a
              className="text-xs text-gray-500 underline dark:text-gray-400"
              href={SRD_REFERENCE.originsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Read canonical SRD rules
            </a>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <ReferenceRow label="Origin feat" value={background.feat} />
            <ReferenceRow label="Tool proficiency" value={background.toolProficiency} />
            <ReferenceRow label="Starting equipment" value={background.startingEquipment} wide />
          </dl>
        </section>
      ) : null}

      <EditableSection
        title="Traits"
        editable={editable}
        editing={editing === 'traits'}
        onEdit={() => begin('traits')}
        onCancel={() => setEditing(null)}
        onSave={commit}
      >
        {editing === 'traits' ? (
          <FeatureEditor
            features={draft.traits}
            addLabel="Add a trait"
            onChange={(traits) => setDraft((current) => ({ ...current, traits }))}
          />
        ) : (
          <FeatureList features={display.traits} empty="Nothing written down yet." />
        )}
      </EditableSection>

      <EditableSection
        title="Actions"
        editable={editable}
        editing={editing === 'actions'}
        onEdit={() => begin('actions')}
        onCancel={() => setEditing(null)}
        onSave={commit}
      >
        {editing === 'actions' ? (
          <FeatureEditor
            features={draft.actions}
            addLabel="Add an action"
            onChange={(actions) => setDraft((current) => ({ ...current, actions }))}
          />
        ) : (
          <FeatureList features={display.actions} empty="No actions written down." />
        )}
      </EditableSection>

      {display.statblock ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Statblock
          </h2>
          <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
            {display.statblock}
          </p>
        </section>
      ) : null}
    </div>
  )
}

function ReferenceRow({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="font-medium text-gray-900 dark:text-gray-100">{label}</dt>
      <dd className="mt-0.5 text-gray-500 dark:text-gray-400">{value}</dd>
    </div>
  )
}

function FeatureList({ features, empty }: { features: EntityData['traits']; empty: string }) {
  if (features.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{empty}</p>
  }

  return (
    <dl className="flex flex-col gap-3 text-sm">
      {features.map((feature, index) => (
        <div key={`${feature.name}-${index}`}>
          <dt className="font-semibold text-gray-900 dark:text-gray-100">{feature.name}</dt>
          <dd className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{feature.text}</dd>
        </div>
      ))}
    </dl>
  )
}
