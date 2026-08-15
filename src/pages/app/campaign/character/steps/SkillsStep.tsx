import { attributeSkills, skillGrants } from '../../../../../entities/wizard/steps'
import type { SkillGrant } from '../../../../../entities/wizard/steps'
import { Checkbox } from '../../../../../components/ui/Checkbox'
import type { StepProps } from '../stepProps'

/**
 * Step five: what their class and background made them good at.
 *
 * One block per source, and that is the whole design. The old form showed
 * eighteen skills with a rank dropdown each and said nothing about where any of
 * them came from, so "does my background already give me Athletics?" was a
 * question the form could not answer and the player had to remember.
 *
 * Here each source gets its own list, headed by the thing that granted it, with
 * a count of what is still owed. A skill already taken from another source is
 * shown as taken and cannot be picked again — the rules do not let you spend
 * one choice twice, and the interface should not let you either. Saving throws
 * are not on this page at all: the class grants them outright, and step two
 * already applied them.
 */
export function SkillsStep({ draft, context, onPatchData }: StepProps) {
  const { definition } = context

  const grants = skillGrants(draft, context)
  const sources = attributeSkills(draft, context)
  const skillName = new Map(definition.skills.map((skill) => [skill.key, skill.name]))

  function toggle(skill: string, proficient: boolean) {
    const skills = { ...draft.data.proficiencies.skills }
    if (proficient) skills[skill] = 'proficient'
    else delete skills[skill]

    onPatchData({ proficiencies: { ...draft.data.proficiencies, skills } })
  }

  if (grants.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This character's class and background are not ones the ruleset knows about, so there
          are no grants to resolve. Choose whatever fits.
        </p>
        <SkillList
          skills={definition.skills}
          chosen={draft.data.proficiencies.skills}
          sources={sources}
          owner="manual"
          onToggle={toggle}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {grants.map((grant) => {
        const taken = [...sources.entries()].filter(([, source]) => source === grant.id)
        const remaining = grant.choose - taken.length

        const options =
          grant.from.length > 0
            ? definition.skills.filter((skill) => grant.from.includes(skill.key))
            : definition.skills

        return (
          <section key={grant.id} className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                From your {grant.id === 'class' ? 'class' : grant.id}: {grant.label}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {grant.fixed.length > 0
                  ? 'Granted outright — there is nothing to choose here.'
                  : remaining > 0
                    ? `Choose ${remaining} more of ${grant.choose}.`
                    : `All ${grant.choose} chosen.`}
              </p>
            </div>

            {grant.fixed.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {grant.fixed.map((skill) => (
                  <li
                    key={skill}
                    className="rounded border border-gray-200 px-2 py-1 text-sm dark:border-gray-700"
                  >
                    {skillName.get(skill) ?? skill}
                    {draft.data.proficiencies.skills[skill] ? null : (
                      <button
                        type="button"
                        className="ml-2 underline"
                        onClick={() => toggle(skill, true)}
                      >
                        apply
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <SkillList
                skills={options}
                chosen={draft.data.proficiencies.skills}
                sources={sources}
                owner={grant.id}
                full={remaining <= 0}
                onToggle={toggle}
              />
            )}
          </section>
        )
      })}
    </div>
  )
}

/**
 * A list of skills, marked with who has already claimed each one.
 *
 * The claim is what makes double-dipping visible rather than merely forbidden.
 * A rogue whose background already gave them Stealth sees "Stealth — from
 * Soldier" greyed out, which answers the question before it is asked; a
 * disabled box with no reason beside it would only raise it.
 */
function SkillList({
  skills,
  chosen,
  sources,
  owner,
  full = false,
  onToggle,
}: {
  skills: Array<{ key: string; name: string }>
  chosen: Record<string, string>
  sources: Map<string, string>
  owner: SkillGrant['id'] | 'manual'
  /** This source has all it may take; anything unchecked is out of reach. */
  full?: boolean
  onToggle: (skill: string, proficient: boolean) => void
}) {
  return (
    <ul className="grid gap-1 sm:grid-cols-2">
      {skills.map((skill) => {
        const source = sources.get(skill.key)
        const mine = source === owner
        const elsewhere = source !== undefined && !mine

        return (
          <li key={skill.key}>
            <Checkbox
              label={
                elsewhere
                  ? `${skill.name} — already from your ${source}`
                  : skill.name
              }
              checked={Boolean(chosen[skill.key])}
              disabled={elsewhere || (full && !mine)}
              onChange={(event) => onToggle(skill.key, event.target.checked)}
            />
          </li>
        )
      })}
    </ul>
  )
}
