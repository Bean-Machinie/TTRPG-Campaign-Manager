import { findBackground, findSpecies } from '../../../../../entities/srd/catalog'
import { Input } from '../../../../../components/ui/Input'
import { Select } from '../../../../../components/ui/Select'
import type { StepProps } from '../stepProps'

/**
 * Step three: where they came from.
 *
 * Two fields, and the reason they share a step is that both feed the two steps
 * after it — the background decides which abilities may be raised, and both
 * decide which skills are on offer. Splitting them would be two pages of one
 * control each; merging them into step two would put a subclass choice next to
 * a species choice, which are not the same kind of decision.
 *
 * Species writes size and speed as a convenience and nothing more. They are
 * ordinary fields on the sheet, editable afterwards like any other, and a
 * player whose character is unusually fast simply changes one.
 */
export function OriginStep({ draft, context, onPatchData }: StepProps) {
  const catalog = context.catalog

  const species = findSpecies(catalog, draft.data.species)
  const background = findBackground(catalog, draft.data.background)

  function setSpecies(name: string) {
    const entry = findSpecies(catalog, name)

    onPatchData({
      species: name || null,
      ...(entry ? { size: entry.sizes[0], speed: `${entry.speed} ft.`, creatureType: 'humanoid' } : {}),
    })
  }

  function setBackground(name: string) {
    // The increases belong to the background that granted them, and step four
    // validates them against it. Keeping the old allocation would produce a
    // character raising abilities their background has never heard of.
    onPatchData({ background: name || null, abilityIncreases: {} })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
      {catalog ? (
        <Select
          label="Species"
          value={species?.name ?? ''}
          hint={species ? species.traits.join(' · ') : undefined}
          onChange={(event) => setSpecies(event.target.value)}
        >
          <option value="">Choose a species…</option>
          {catalog.species.map((option) => (
            <option key={option.key} value={option.name}>
              {option.name}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          label="Species"
          value={draft.data.species ?? ''}
          onChange={(event) => setSpecies(event.target.value)}
        />
      )}

      {catalog ? (
        <Select
          label="Background"
          value={background?.name ?? ''}
          hint={
            background
              ? `Raises ${background.abilities
                  .map(
                    (key) =>
                      context.definition.abilities.find((ability) => ability.key === key)?.name ??
                      key,
                  )
                  .join(', ')} — chosen on the next step. Grants ${background.skills.length} skills and the ${background.feat} feat.`
              : 'What they did before adventuring. It decides two skills and which abilities they can raise.'
          }
          onChange={(event) => setBackground(event.target.value)}
        >
          <option value="">Choose a background…</option>
          {catalog.backgrounds.map((option) => (
            <option key={option.key} value={option.name}>
              {option.name}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          label="Background"
          value={draft.data.background ?? ''}
          onChange={(event) => setBackground(event.target.value)}
        />
      )}
      {species && species.sizes.length > 1 ? (
        <Select
          label="Size"
          value={draft.data.size ?? species.sizes[0]}
          hint="This species lets you choose."
          onChange={(event) => onPatchData({ size: event.target.value })}
        >
          {species.sizes.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </Select>
      ) : null}
      </div>

      {background ? (
        <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {background.name} background
          </h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <ReferenceRow label="Origin feat" value={background.feat} />
            <ReferenceRow label="Tool proficiency" value={background.toolProficiency} />
            <ReferenceRow label="Starting equipment" value={background.startingEquipment} wide />
          </dl>
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
