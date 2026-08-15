import { findClass } from '../../../../../entities/srd/catalog'
import { hitPointResources } from '../../../../../entities/wizard/steps'
import { Input } from '../../../../../components/ui/Input'
import { Select } from '../../../../../components/ui/Select'
import type { StepProps } from '../stepProps'

/**
 * Step two: class, then level, then subclass — in that order, because that is
 * the order in which each answer decides whether the next question exists.
 *
 * The subclass field is the reason this step is worth a page of its own. On the
 * old form it sat in a grid beside "Speed" and "Languages", always visible and
 * always accepting anything, so a level 1 barbarian could be given a Path they
 * would not choose for two more levels and nothing would say so. Here it is
 * absent until the level earns it, and required the moment it does.
 *
 * Hit points are written here as an input rather than derived. See
 * startingHitPoints: the ruleset definition carries no hit dice, so the
 * alternative to a number the wizard writes is a blank on the most-read line of
 * the sheet. It is rewritten whenever class or level changes, and left alone
 * once the wizard is done.
 */
export function ClassStep({ draft, context, onPatchData }: StepProps) {
  const catalog = context.catalog
  const entry = draft.data.classes[0] ?? { name: '', level: 1, subclass: null }
  const known = findClass(catalog, entry.name)

  const subclassDue = known !== null && entry.level >= known.subclassLevel

  function setClass(changes: Partial<typeof entry>) {
    const next = { ...entry, ...changes }

    // A subclass belongs to the class that granted it. Changing class and
    // keeping the old one would leave a Thief barbarian nobody chose.
    if (changes.name !== undefined && changes.name !== entry.name) next.subclass = null

    const nextKnown = findClass(catalog, next.name)
    if (nextKnown && next.level < nextKnown.subclassLevel) next.subclass = null

    // Worked out against the draft as it will be, not as it is: hit points move
    // with the level being set, and this runs before that level is state.
    const ahead = { ...draft, data: { ...draft.data, classes: [next], level: next.level } }
    const resources = hitPointResources(ahead, context)

    onPatchData({
      classes: [next],
      // One class in the wizard, so the character's level is the class's. The
      // blob holds an array because multiclassing is a thing; adding a second
      // class is a job for the detail page, where nothing has to be sequenced.
      level: next.level,
      ...(resources ? { resources } : {}),
      // Saving throw proficiencies are granted outright by class, and are not a
      // choice anyone makes. Applied here rather than asked about on step five.
      proficiencies: {
        ...draft.data.proficiencies,
        saves: nextKnown
          ? Object.fromEntries(nextKnown.savingThrows.map((key) => [key, 'proficient']))
          : draft.data.proficiencies.saves,
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {catalog ? (
        <Select
          label="Class"
          value={known?.name ?? ''}
          onChange={(event) => setClass({ name: event.target.value })}
        >
          <option value="">Choose a class…</option>
          {catalog.classes.map((option) => (
            <option key={option.key} value={option.name}>
              {option.name}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          label="Class"
          value={entry.name}
          hint="This ruleset has no class list, so anything goes."
          onChange={(event) => setClass({ name: event.target.value })}
        />
      )}

      <Input
        label="Level"
        type="number"
        min={context.definition.levelRange.min}
        max={context.definition.levelRange.max}
        value={entry.level}
        hint={known ? `A ${known.name} has a d${known.hitDie} hit die.` : undefined}
        onChange={(event) => setClass({ level: Number(event.target.value) || 1 })}
      />

      {subclassDue ? (
        <Select
          label="Subclass"
          value={entry.subclass ?? ''}
          hint={`Chosen at level ${known.subclassLevel}.`}
          onChange={(event) => setClass({ subclass: event.target.value || null })}
        >
          <option value="">Choose a subclass…</option>
          {known.subclasses.map((subclass) => (
            <option key={subclass} value={subclass}>
              {subclass}
            </option>
          ))}
        </Select>
      ) : known ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          A {known.name} chooses a subclass at level {known.subclassLevel}. Nothing to decide
          yet.
        </p>
      ) : null}
    </div>
  )
}
