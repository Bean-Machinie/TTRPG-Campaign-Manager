import { useState } from 'react'
import type { FormEvent } from 'react'
import { DOCUMENT_TYPE_LABELS } from '../../../campaigns/types'
import type { DocumentInput, DocumentType } from '../../../campaigns/types'
import { VISIBILITY_LABELS, VISIBILITY_TIERS } from '../../../documents/visibility'
import type { DocumentVisibility } from '../../../documents/visibility'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'

type DocumentFormProps = {
  initialValue?: DocumentInput
  submitLabel: string
  busy: boolean
  /**
   * Whether the GM-only tier is offered. A player choosing it would create a
   * document they could not then open, so it is left out of their list rather
   * than shown and rejected — the insert policy refuses it either way.
   */
  canWriteSecrets: boolean
  onSubmit: (input: DocumentInput) => void
  onCancel?: () => void
}

const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]

export function DocumentForm({
  initialValue,
  submitLabel,
  busy,
  canWriteSecrets,
  onSubmit,
  onCancel,
}: DocumentFormProps) {
  const [title, setTitle] = useState(initialValue?.title ?? '')
  const [docType, setDocType] = useState<DocumentType>(initialValue?.docType ?? 'page')
  const [visibility, setVisibility] = useState<DocumentVisibility>(
    initialValue?.visibility ?? 'shared',
  )

  const tiers = VISIBILITY_TIERS.filter((tier) => tier !== 'gm_only' || canWriteSecrets)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({ title, docType, visibility })
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <Input
        label="Title"
        required
        maxLength={200}
        placeholder="The Vault beneath Ravenhold"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <div className="entry-form__row">
        <Select
          label="Kind"
          value={docType}
          onChange={(event) => setDocType(event.target.value as DocumentType)}
        >
          {DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {DOCUMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>

        <Select
          label="Who can read it"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as DocumentVisibility)}
        >
          {tiers.map((tier) => (
            <option key={tier} value={tier}>
              {VISIBILITY_LABELS[tier]}
            </option>
          ))}
        </Select>
      </div>

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
