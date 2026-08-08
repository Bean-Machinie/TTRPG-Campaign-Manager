import { useState } from 'react'
import type { FormEvent } from 'react'
import type { NoteInput } from '../../../campaigns/types'
import { Button } from '../../../components/ui/Button'
import { Checkbox } from '../../../components/ui/Checkbox'
import { Input } from '../../../components/ui/Input'
import { Textarea } from '../../../components/ui/Textarea'

type NoteFormProps = {
  initialValue?: NoteInput
  submitLabel: string
  busy: boolean
  onSubmit: (input: NoteInput) => void
  onCancel?: () => void
}

export function NoteForm({ initialValue, submitLabel, busy, onSubmit, onCancel }: NoteFormProps) {
  const [title, setTitle] = useState(initialValue?.title ?? '')
  const [body, setBody] = useState(initialValue?.body ?? '')
  const [isPrivate, setIsPrivate] = useState(initialValue?.isPrivate ?? false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({ title, body: body || null, isPrivate })
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <Input
        label="Title"
        required
        maxLength={200}
        placeholder="What the innkeeper let slip"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <Textarea
        label="Note"
        rows={5}
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />

      <Checkbox
        label="Private — only I can see this"
        checked={isPrivate}
        onChange={(event) => setIsPrivate(event.target.checked)}
      />

      <div className="page-actions">
        <Button type="submit" disabled={busy || title.trim().length === 0}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}
