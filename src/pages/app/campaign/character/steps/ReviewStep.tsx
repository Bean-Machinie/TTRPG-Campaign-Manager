import { ENTITY_KIND_LABELS } from '../../../../../campaigns/types'
import { VISIBILITY_LABELS } from '../../../../../documents/visibility'
import { attributeSkills } from '../../../../../entities/wizard/steps'
import { EntitySheet } from '../../EntitySheet'
import type { StepProps } from '../stepProps'

/**
 * Step seven: the character, before it is one.
 *
 * The same renderer the detail page uses, deliberately. A review screen that
 * drew its own summary would be a second opinion about what this character is,
 * and the moment the two disagreed it would be the reviewed version that was
 * wrong. What is added here is the one thing the sheet cannot show — where each
 * proficiency came from — because this is the last moment at which that is
 * still a decision rather than a record.
 */
export function ReviewStep({ draft, context }: StepProps) {
  const sources = attributeSkills(draft, context)
  const skillName = new Map(context.definition.skills.map((skill) => [skill.key, skill.name]))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{draft.name}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {[ENTITY_KIND_LABELS[draft.kind], VISIBILITY_LABELS[draft.visibility]].join(' · ')}
        </p>
      </div>

      <EntitySheet definition={context.definition} data={draft.data} />

      {sources.size > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
            Where the proficiencies came from
          </h3>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {[...sources.entries()].map(([skill, source]) => (
              <li key={skill} className="flex justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">
                  {skillName.get(skill) ?? skill}
                </span>
                <span className="text-gray-500 dark:text-gray-400">{source}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
