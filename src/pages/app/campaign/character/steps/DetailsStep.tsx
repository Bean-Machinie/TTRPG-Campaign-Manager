import { Input } from '../../../../../components/ui/Input'
import { Textarea } from '../../../../../components/ui/Textarea'
import type { StepProps } from '../stepProps'

/**
 * Step six: everything optional, and said so.
 *
 * It comes last among the input steps because nothing depends on it — no
 * number moves, no later choice narrows. That is worth a step of its own rather
 * than fields scattered through the earlier ones, because it means a player who
 * wants to get to the table can skip a page rather than skip a field here and a
 * field there and wonder what they missed.
 */
export function DetailsStep({ draft, onChange, onPatchData }: StepProps) {
  const data = draft.data

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        None of this is required, and all of it can be written later.
      </p>

      <Input
        label="Alignment"
        placeholder="Chaotic good"
        value={data.alignment ?? ''}
        onChange={(event) => onPatchData({ alignment: event.target.value || null })}
      />

      <Textarea
        label="Appearance"
        placeholder="What somebody notices first."
        value={data.appearance ?? ''}
        onChange={(event) => onPatchData({ appearance: event.target.value || null })}
      />

      <Textarea
        label="Personality"
        placeholder="How they behave when nothing is at stake."
        value={data.personality ?? ''}
        onChange={(event) => onPatchData({ personality: event.target.value || null })}
      />

      <Textarea
        label="Backstory"
        placeholder="Where they were before the first session."
        rows={8}
        value={data.backstory ?? ''}
        onChange={(event) => onPatchData({ backstory: event.target.value || null })}
      />

      {/* The one field here that is not part of the rules blob: it belongs to
          the row, because the list page reads it without fetching the blob. */}
      <Textarea
        label="Summary"
        hint="One line, for the character list."
        placeholder="A dwarf soldier with a debt to settle."
        value={draft.summary ?? ''}
        onChange={(event) => onChange({ summary: event.target.value || null })}
      />
    </div>
  )
}
