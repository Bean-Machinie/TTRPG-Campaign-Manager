import { useState } from 'react'
import { deriveEntity } from '../../../../../entities/derive'
import type { EntityData } from '../../../../../entities/entityData'
import {
  PROFICIENCY_BONUS_KEY,
  passiveKey,
  saveKey,
  skillKey,
  statLabel,
} from '../../../../../entities/system'
import { attributeSkills } from '../../../../../entities/wizard/steps'
import { catalogFor } from '../../../../../entities/srd/catalog'
import { EntitySheet } from '../../EntitySheet'
import { useCharacterDetail } from '../detailContext'
import { EditableSection, OverrideField, ProficiencyTable } from '../editors'
import { computedOf, numberOrNull, withRank, withResource } from '../fields'

/**
 * The numbers, in three sections that can be edited one at a time.
 *
 * Reading is the whole sheet at once, because at the table you want to see
 * everything; writing is one section, because you came here to change one
 * thing. That asymmetry is the reason this is not a form with a Save button at
 * the bottom — a page in permanent edit mode makes the common case, looking
 * something up, the harder one.
 *
 * Every edit is made against the *public* half of the character, never the copy
 * with the GM's overlay applied. See detailContext for why that matters.
 */
export function SheetSection() {
  const { entity, system, display, editable, save } = useCharacterDetail()
  const definition = system.definition

  const [editing, setEditing] = useState<'abilities' | 'proficiencies' | 'resources' | null>(null)
  const [draft, setDraft] = useState<EntityData>(entity.data)

  const sheet = deriveEntity(definition, draft)
  const sources = attributeSkills(
    {
      name: entity.name,
      kind: entity.kind,
      systemId: entity.systemId,
      playerUserId: entity.playerUserId,
      summary: entity.summary,
      visibility: entity.visibility,
      data: display,
    },
    { definition, catalog: catalogFor(system.key) },
  )

  function begin(section: typeof editing) {
    setDraft(entity.data)
    setEditing(section)
  }

  async function commit() {
    await save({ data: draft })
    setEditing(null)
  }

  function patch(changes: Partial<EntityData>) {
    setDraft((current) => ({ ...current, ...changes }))
  }

  function setOverride(key: string, value: number | null) {
    setDraft((current) => {
      const overrides = { ...current.overrides }
      if (value === null) delete overrides[key]
      else overrides[key] = value
      return { ...current, overrides }
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <EditableSection
        title="Ability scores"
        editable={editable}
        editing={editing === 'abilities'}
        onEdit={() => begin('abilities')}
        onCancel={() => setEditing(null)}
        onSave={commit}
      >
        {editing === 'abilities' ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              {definition.abilities.map((ability) => (
                <label key={ability.key} className="flex flex-col gap-1 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{ability.abbr}</span>
                  <input
                    type="number"
                    className="field__input"
                    min={definition.abilityScoreRange.min}
                    max={definition.abilityScoreRange.max}
                    value={draft.abilities[ability.key] ?? ''}
                    onChange={(event) => {
                      const abilities = { ...draft.abilities }
                      const value = numberOrNull(event.target.value)
                      if (value === null) delete abilities[ability.key]
                      else abilities[ability.key] = value
                      patch({ abilities })
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <OverrideField
                label={statLabel(definition, PROFICIENCY_BONUS_KEY)}
                computed={computedOf(sheet, PROFICIENCY_BONUS_KEY)}
                value={draft.overrides[PROFICIENCY_BONUS_KEY]}
                onChange={(value) => setOverride(PROFICIENCY_BONUS_KEY, value)}
              />
              {definition.derived.map((stat) => (
                <OverrideField
                  key={stat.key}
                  label={stat.label}
                  computed={computedOf(sheet, stat.key)}
                  value={draft.overrides[stat.key]}
                  onChange={(value) => setOverride(stat.key, value)}
                />
              ))}
              {definition.passiveSkills.map((skill) => (
                <OverrideField
                  key={skill}
                  label={statLabel(definition, passiveKey(skill))}
                  computed={computedOf(sheet, passiveKey(skill))}
                  value={draft.overrides[passiveKey(skill)]}
                  onChange={(value) => setOverride(passiveKey(skill), value)}
                />
              ))}
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="mt-1"
                checked={draft.derive}
                onChange={(event) => patch({ derive: event.target.checked })}
              />
              <span>
                Derive statistics from ability scores, level and proficiencies.
                <span className="block text-gray-500 dark:text-gray-400">
                  Leave this off for a statblock: nothing is computed, and every value is
                  whatever is typed above.
                </span>
              </span>
            </label>
          </div>
        ) : (
          <EntitySheet definition={definition} data={display} />
        )}
      </EditableSection>

      {editing === 'proficiencies' ? (
        <EditableSection
          title="Saving throws and skills"
          editable={editable}
          editing
          onEdit={() => begin('proficiencies')}
          onCancel={() => setEditing(null)}
          onSave={commit}
        >
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium">Saving throws</h3>
              <ProficiencyTable
                definition={definition}
                rows={definition.abilities.map((ability) => ({
                  key: ability.key,
                  label: ability.name,
                  statKey: saveKey(ability.key),
                }))}
                ranks={draft.proficiencies.saves}
                onRank={(key, rank) =>
                  patch({
                    proficiencies: {
                      ...draft.proficiencies,
                      saves: withRank(draft.proficiencies.saves, key, rank),
                    },
                  })
                }
                overrides={draft.overrides}
                onOverride={setOverride}
                sheet={sheet}
              />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">Skills</h3>
              <ProficiencyTable
                definition={definition}
                rows={definition.skills.map((skill) => ({
                  key: skill.key,
                  label: skill.name,
                  statKey: skillKey(skill.key),
                }))}
                ranks={draft.proficiencies.skills}
                onRank={(key, rank) =>
                  patch({
                    proficiencies: {
                      ...draft.proficiencies,
                      skills: withRank(draft.proficiencies.skills, key, rank),
                    },
                  })
                }
                overrides={draft.overrides}
                onOverride={setOverride}
                sheet={sheet}
              />
            </div>
          </div>
        </EditableSection>
      ) : (
        <EditableSection
          title="Where the proficiencies came from"
          editable={editable}
          editing={false}
          onEdit={() => begin('proficiencies')}
          onCancel={() => setEditing(null)}
          onSave={commit}
        >
          {sources.size === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No skill proficiencies yet.
            </p>
          ) : (
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {[...sources.entries()].map(([skill, source]) => (
                <li key={skill} className="flex justify-between gap-2">
                  <span className="text-gray-700 dark:text-gray-300">
                    {statLabel(definition, skillKey(skill))}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">{source}</span>
                </li>
              ))}
            </ul>
          )}
        </EditableSection>
      )}

      {definition.resources.length > 0 ? (
        <EditableSection
          title="Resources"
          editable={editable}
          editing={editing === 'resources'}
          onEdit={() => begin('resources')}
          onCancel={() => setEditing(null)}
          onSave={commit}
        >
          {editing === 'resources' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {definition.resources.map((resource) => {
                const value = draft.resources[resource.key]

                return (
                  <div key={resource.key} className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {resource.label} — now
                      </span>
                      <input
                        type="number"
                        className="field__input"
                        value={value?.current ?? ''}
                        onChange={(event) =>
                          patch({
                            resources: withResource(draft.resources, resource.key, {
                              current: numberOrNull(event.target.value),
                              max: value?.max ?? null,
                            }),
                          })
                        }
                      />
                    </label>

                    {resource.track === 'pool' ? (
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Max</span>
                        <input
                          type="number"
                          className="field__input"
                          value={value?.max ?? ''}
                          onChange={(event) =>
                            patch({
                              resources: withResource(draft.resources, resource.key, {
                                current: value?.current ?? 0,
                                max: numberOrNull(event.target.value),
                              }),
                            })
                          }
                        />
                      </label>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {definition.resources.map((resource) => {
                const value = display.resources[resource.key]

                return (
                  <li
                    key={resource.key}
                    className="rounded-md border border-gray-200 p-2 text-sm dark:border-gray-800"
                  >
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {resource.label}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {value ? value.current : '—'}
                      {value?.max != null ? ` / ${value.max}` : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </EditableSection>
      ) : null}
    </div>
  )
}
