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
      ...(entry ? { size: entry.size, speed: `${entry.speed} ft.` } : {}),
    })
  }

  function setBackground(name: string) {
    // The increases belong to the background that granted them, and step four
    // validates them against it. Keeping the old allocation would produce a
    // character raising abilities their background has never heard of.
    onPatchData({ background: name || null, abilityIncreases: {} })
  }

  return (
    <div className="flex flex-col gap-4">
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
    </div>
  )
}
