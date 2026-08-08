import { useState } from 'react'
import type { FormEvent } from 'react'
import type { QuestInput, QuestStatus } from '../../../campaigns/types'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Textarea } from '../../../components/ui/Textarea'

type QuestFormProps = {
  initialValue?: QuestInput
  submitLabel: string
  busy: boolean
  onSubmit: (input: QuestInput) => void
  onCancel?: () => void
}

export function QuestForm({
  initialValue,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: QuestFormProps) {
  const [title, setTitle] = useState(initialValue?.title ?? '')
  const [status, setStatus] = useState<QuestStatus>(initialValue?.status ?? 'active')
  const [description, setDescription] = useState(initialValue?.description ?? '')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({ title, status, description: description || null })
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="entry-form__row">
        <Input
          label="Title"
          required
          maxLength={200}
          placeholder="Recover the shattered crown"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as QuestStatus)}
        >
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="abandoned">Abandoned</option>
        </Select>
      </div>

      <Textarea
        label="Description"
        placeholder="What the party is trying to do, and why."
        value={description}
        onChange={(event) => setDescription(event.target.value)}
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
