import { findClass } from '../../../../../entities/srd/catalog'
import { hitPointResources } from '../../../../../entities/wizard/steps'
import { Input } from '../../../../../components/ui/Input'
import { ChoiceCards } from '../../../../../components/diceui/ChoiceCards'
import { ComboboxField } from '../../../../../components/diceui/ComboboxField'
import { Swords } from 'lucide-react'
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
    <div className="flex flex-col gap-6">
      {catalog ? (
        <ChoiceCards
          label="Choose your calling"
          description="Your class determines core proficiencies, hit points, and future features."
          value={known?.name ?? ''}
          onValueChange={(name) => setClass({ name })}
          options={catalog.classes.map((option) => ({
            value: option.name,
            label: option.name,
            description: `${option.primaryAbility} · ${option.armorTraining}`,
            badge: `d${option.hitDie}`,
            icon: <Swords aria-hidden="true" />,
          }))}
        />
      ) : (
        <Input
          label="Class"
          value={entry.name}
          hint="This ruleset has no class list, so anything goes."
          onChange={(event) => setClass({ name: event.target.value })}
        />
      )}


      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Input
          label="Starting level"
          type="number"
          min={context.definition.levelRange.min}
          max={context.definition.levelRange.max}
          value={entry.level}
          hint={known ? `A ${known.name} uses a d${known.hitDie} Hit Point Die.` : undefined}
          onChange={(event) => setClass({ level: Number(event.target.value) || 1 })}
        />

        {subclassDue ? (
          <ComboboxField
            label="Subclass"
            value={entry.subclass ?? ''}
            hint={`Unlocked at level ${known.subclassLevel}.`}
            placeholder="Choose a subclass…"
            onValueChange={(subclass) => setClass({ subclass: subclass || null })}
            options={known.subclasses.map((subclass) => ({
              value: subclass,
              label: subclass,
              description: `${known.name} specialization`,
            }))}
          />
        ) : known ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <strong className="block text-gray-900 dark:text-gray-100">Subclass comes later</strong>
            A {known.name} chooses one at level {known.subclassLevel}.
          </div>
        ) : null}
      </div>

      {known ? (
        <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Core {known.name} traits
          </h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <ReferenceRow label="Primary ability" value={known.primaryAbility} />
            <ReferenceRow label="Hit Point Die" value={`d${known.hitDie} per level`} />
            <ReferenceRow label="Weapons" value={known.weaponProficiencies} />
            <ReferenceRow label="Armor training" value={known.armorTraining} />
            {known.toolProficiencies ? (
              <ReferenceRow label="Tools" value={known.toolProficiencies} />
            ) : null}
            <ReferenceRow label="Starting equipment" value={known.startingEquipment} wide />
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
