import { useState } from 'react'
import type { FormEvent } from 'react'
import { MAP_ACCEPTED_TYPES } from '../../../campaigns/campaignsApi'
import type { CampaignLocation, MapInput } from '../../../campaigns/types'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'

type MapFormProps = {
  locations: CampaignLocation[]
  /** Present when editing. Editing changes name/location only, never the image. */
  initialValue?: MapInput
  submitLabel: string
  busy: boolean
  onSubmit: (input: MapInput, file: File | null) => void
  onCancel?: () => void
}

export function MapForm({
  locations,
  initialValue,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: MapFormProps) {
  const isEditing = initialValue !== undefined

  const [name, setName] = useState(initialValue?.name ?? '')
  const [locationId, setLocationId] = useState(initialValue?.locationId ?? '')
  const [file, setFile] = useState<File | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({ name, locationId: locationId || null }, file)
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="entry-form__row">
        <Input
          label="Name"
          required
          maxLength={120}
          placeholder="The Ravenhollow catacombs"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Select
          label="Location"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
        >
          <option value="">Whole campaign</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </Select>
      </div>

      {!isEditing ? (
        <Input
          label="Image (PNG, JPEG, WebP or GIF, up to 10 MB)"
          type="file"
          required
          accept={MAP_ACCEPTED_TYPES.join(',')}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      ) : null}

      <div className="page-actions">
        <Button
          type="submit"
          disabled={busy || name.trim().length === 0 || (!isEditing && !file)}
        >
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
