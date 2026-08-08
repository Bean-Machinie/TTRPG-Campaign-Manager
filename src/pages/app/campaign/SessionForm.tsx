import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SessionInput } from '../../../campaigns/types'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Textarea } from '../../../components/ui/Textarea'

type SessionFormProps = {
  /** Present when editing. The parent remounts the form with a key to reset it. */
  initialValue?: SessionInput
  submitLabel: string
  busy: boolean
  onSubmit: (input: SessionInput) => void
  onCancel?: () => void
}

export function SessionForm({
  initialValue,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: SessionFormProps) {
  const [title, setTitle] = useState(initialValue?.title ?? '')
  const [scheduledFor, setScheduledFor] = useState(initialValue?.scheduledFor ?? '')
  const [notes, setNotes] = useState(initialValue?.notes ?? '')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({ title, scheduledFor: scheduledFor || null, notes: notes || null })
  }

  return (
    <form className="session-form" onSubmit={handleSubmit}>
      <div className="session-form__row">
        <Input
          label="Title"
          required
          maxLength={200}
          placeholder="Session 4 — Into the catacombs"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Input
          label="Date"
          type="date"
          value={scheduledFor}
          onChange={(event) => setScheduledFor(event.target.value)}
        />
      </div>

      <Textarea
        label="Notes"
        placeholder="What happened, or what to prepare."
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
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
