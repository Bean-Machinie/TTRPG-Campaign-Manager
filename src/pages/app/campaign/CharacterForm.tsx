import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CampaignMember, CharacterInput, CharacterKind } from '../../../campaigns/types'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { Textarea } from '../../../components/ui/Textarea'

type CharacterFormProps = {
  members: CampaignMember[]
  /** Owners and GMs may create NPCs and assign characters to anyone. */
  canManage: boolean
  currentUserId: string
  initialValue?: CharacterInput
  submitLabel: string
  busy: boolean
  onSubmit: (input: CharacterInput) => void
  onCancel?: () => void
}

export function CharacterForm({
  members,
  canManage,
  currentUserId,
  initialValue,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: CharacterFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '')
  const [kind, setKind] = useState<CharacterKind>(initialValue?.kind ?? 'pc')
  const [playerUserId, setPlayerUserId] = useState(initialValue?.playerUserId ?? '')
  const [description, setDescription] = useState(initialValue?.description ?? '')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    onSubmit({
      name,
      // A player can only ever write their own PC, so the fields they cannot
      // see are filled in for them. The database policies enforce the same rule.
      kind: canManage ? kind : 'pc',
      playerUserId: canManage ? playerUserId || null : currentUserId,
      description: description || null,
    })
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="entry-form__row">
        <Input
          label="Name"
          required
          maxLength={120}
          placeholder="Thalia Bramblefoot"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        {canManage ? (
          <Select
            label="Type"
            value={kind}
            onChange={(event) => setKind(event.target.value as CharacterKind)}
          >
            <option value="pc">Player character</option>
            <option value="npc">NPC</option>
          </Select>
        ) : null}
      </div>

      {canManage && kind === 'pc' ? (
        <Select
          label="Played by"
          value={playerUserId}
          onChange={(event) => setPlayerUserId(event.target.value)}
        >
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </Select>
      ) : null}

      <Textarea
        label="Description"
        placeholder="Who they are, and anything worth remembering."
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
