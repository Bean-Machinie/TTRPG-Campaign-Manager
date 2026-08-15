import { Input } from '../../../../../components/ui/Input'
import { Textarea } from '../../../../../components/ui/Textarea'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../../../components/ui/Accordion'
import { Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Alignment"
          placeholder="Chaotic good"
          value={data.alignment ?? ''}
          onChange={(event) => onPatchData({ alignment: event.target.value || null })}
        />

        <Textarea
          label="Summary"
          hint="One line, for the character list."
          placeholder="A dwarf soldier with a debt to settle."
          value={draft.summary ?? ''}
          onChange={(event) => onChange({ summary: event.target.value || null })}
        />
      </div>

      <Accordion
        multiple
        defaultValue={['appearance']}
        className="rounded-xl border border-gray-200 px-4 dark:border-gray-800"
      >
        <DetailSection value="appearance" title="Appearance">
          <Textarea
            label="What do people notice first?"
            placeholder="Weathered travel cloak, silver-streaked hair, a quick smile…"
            value={data.appearance ?? ''}
            onChange={(event) => onPatchData({ appearance: event.target.value || null })}
          />
        </DetailSection>

        <DetailSection value="personality" title="Personality">
          <Textarea
            label="How do they carry themselves?"
            placeholder="How they behave when nothing is at stake."
            value={data.personality ?? ''}
            onChange={(event) => onPatchData({ personality: event.target.value || null })}
          />
        </DetailSection>

        <DetailSection value="backstory" title="Backstory">
          <Textarea
            label="Where were they before the first session?"
            placeholder="A few defining events are enough to begin."
            rows={8}
            value={data.backstory ?? ''}
            onChange={(event) => onPatchData({ backstory: event.target.value || null })}
          />
        </DetailSection>
      </Accordion>

      {/* The one field here that is not part of the rules blob: it belongs to
          the row, because the list page reads it without fetching the blob. */}
    </div>
  )
}

function DetailSection({ value, title, children }: { value: string; title: string; children: ReactNode }) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>
        <span>{title}</span>
        <Plus className="ml-auto size-4 group-aria-expanded:hidden" aria-hidden="true" />
        <Minus className="ml-auto hidden size-4 group-aria-expanded:block" aria-hidden="true" />
      </AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  )
}
