import { useState } from 'react'
import type { FormEvent } from 'react'
import type { LocationInput } from '../../../campaigns/types'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Textarea } from '../../../components/ui/Textarea'

type LocationFormProps = {
  initialValue?: LocationInput
  submitLabel: string
  busy: boolean
  onSubmit: (input: LocationInput) => void
  onCancel?: () => void
}

export function LocationForm({
  initialValue,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: LocationFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '')
  const [description, setDescription] = useState(initialValue?.description ?? '')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({ name, description: description || null })
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <Input
        label="Name"
        required
        maxLength={120}
        placeholder="Ravenhollow"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />

      <Textarea
        label="Description"
        placeholder="What the party knows about this place."
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      <div className="page-actions">
        <Button type="submit" disabled={busy || name.trim().length === 0}>
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
