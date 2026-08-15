import { useState } from 'react'
import { statKeys, statLabel } from '../../../../../entities/system'
import type { EntitySecrets } from '../../../../../entities/entityData'
import { Input } from '../../../../../components/ui/Input'
import { Textarea } from '../../../../../components/ui/Textarea'
import { useCharacterDetail } from '../detailContext'
import { EditableSection, OverrideField } from '../editors'

/**
 * The GM's half of the same character.
 *
 * This tab is not a permission check. `secrets` arrives populated for somebody
 * who manages the campaign and as an empty shell for everybody else, decided by
 * get_campaign_entity() in Postgres before the row is sent — so what is
 * rendered here is whatever was in the box, and for a player there is no box
 * and no tab. Hiding the tab is courtesy; the server is the rule.
 *
 * Written through saveEntitySecrets rather than as part of the entity save, for
 * the reason spelled out on that function: a player saving their own character
 * must not be able to write an empty secrets object over the GM's notes, and
 * splitting the call is what makes that impossible rather than merely unlikely.
 */
export function NotesSection() {
  const { entity, system, editable, saveSecrets } = useCharacterDetail()
  const definition = system.definition

  const [editing, setEditing] = useState(false)
  const [trueName, setTrueName] = useState(entity.secrets.trueName ?? '')
  const [gmNotes, setGmNotes] = useState(entity.secrets.gmNotes ?? '')
  const [overrides, setOverrides] = useState<Record<string, number>>(
    entity.secrets.data?.overrides ?? {},
  )

  function begin() {
    setTrueName(entity.secrets.trueName ?? '')
    setGmNotes(entity.secrets.gmNotes ?? '')
    setOverrides(entity.secrets.data?.overrides ?? {})
    setEditing(true)
  }

  async function commit() {
    const secrets: EntitySecrets = {
      trueName: trueName.trim() || null,
      gmNotes: gmNotes.trim() || null,
      data: Object.keys(overrides).length > 0 ? { overrides } : null,
    }

    await saveSecrets(secrets)
    setEditing(false)
  }

  function setOverride(key: string, value: number | null) {
    setOverrides((current) => {
      const next = { ...current }
      if (value === null) delete next[key]
      else next[key] = value
      return next
    })
  }

  const hidden = Object.entries(entity.secrets.data?.overrides ?? {})

  return (
    <EditableSection
      title="GM only"
      editable={editable}
      editing={editing}
      onEdit={begin}
      onCancel={() => setEditing(false)}
      onSave={commit}
    >
      {editing ? (
        <div className="flex flex-col gap-4">
          <Input
            label="True name"
            maxLength={120}
            placeholder="What it actually is"
            value={trueName}
            onChange={(event) => setTrueName(event.target.value)}
          />
          <Textarea
            label="GM notes"
            rows={8}
            placeholder="Motivation, secrets, what it wants."
            value={gmNotes}
            onChange={(event) => setGmNotes(event.target.value)}
          />

          <fieldset>
            <legend className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              Hidden statistics — what the party has been told is on the Sheet tab; what is
              true goes here.
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {statKeys(definition).map((key) => (
                <OverrideField
                  key={key}
                  label={statLabel(definition, key)}
                  computed={null}
                  value={overrides[key]}
                  onChange={(value) => setOverride(key, value)}
                />
              ))}
            </div>
          </fieldset>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-md border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          {entity.secrets.trueName ? (
            <p className="text-sm text-gray-900 dark:text-gray-100">
              <span className="text-gray-500 dark:text-gray-400">Actually: </span>
              {entity.secrets.trueName}
            </p>
          ) : null}

          {entity.secrets.gmNotes ? (
            <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">
              {entity.secrets.gmNotes}
            </p>
          ) : null}

          {hidden.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
                Hidden statistics
              </h3>
              <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
                {hidden.map(([key, value]) => (
                  <li key={key} className="flex justify-between gap-2">
                    <span className="text-gray-700 dark:text-gray-300">
                      {statLabel(definition, key)}
                    </span>
                    <span className="font-medium tabular-nums">{value}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                The Sheet tab shows these in place of the published values. A player sees the
                published ones.
              </p>
            </div>
          ) : null}

          {!entity.secrets.trueName && !entity.secrets.gmNotes && hidden.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nothing hidden about this one yet.
            </p>
          ) : null}
        </div>
      )}
    </EditableSection>
  )
}
