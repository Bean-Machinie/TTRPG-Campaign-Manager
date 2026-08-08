import { useState } from 'react'
import { useAuth } from '../../../auth/useAuth'
import { useCampaignCharacters, useCampaignMembers } from '../../../campaigns/hooks'
import {
  createCharacter,
  deleteCharacter,
  updateCharacter,
} from '../../../campaigns/campaignsApi'
import type { CampaignCharacter, CharacterInput } from '../../../campaigns/types'
import { errorMessage } from '../../../lib/errors'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { CharacterForm } from './CharacterForm'
import { useCampaignOutlet } from './useCampaignOutlet'
import './CampaignCharactersPage.css'

export function CampaignCharactersPage() {
  const { campaign, role } = useCampaignOutlet()
  const { user } = useAuth()
  const canManage = role === 'owner' || role === 'gm'

  const { characters, loading, error, reload } = useCampaignCharacters(campaign.id)
  const { members } = useCampaignMembers(campaign.id)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const editing = characters.find((character) => character.id === editingId) ?? null
  const playerCharacters = characters.filter((character) => character.kind === 'pc')
  const nonPlayerCharacters = characters.filter((character) => character.kind === 'npc')

  const nameByUserId = new Map(members.map((member) => [member.userId, member.name]))

  /** Owners and GMs edit anything; a player edits only their own character. */
  function canEdit(character: CampaignCharacter) {
    return canManage || (character.playerUserId !== null && character.playerUserId === user?.id)
  }

  async function run(action: () => Promise<void>, fallback: string) {
    setActionError(null)
    setBusy(true)
    try {
      await action()
    } catch (caught) {
      setActionError(errorMessage(caught, fallback))
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(input: CharacterInput) {
    const id = editingId
    void run(async () => {
      if (id) {
        await updateCharacter(id, input)
      } else {
        await createCharacter(campaign.id, input)
      }
      setEditingId(null)
      reload()
    }, 'Could not save the character.')
  }

  function renderCharacter(character: CampaignCharacter) {
    const playedBy = character.playerUserId ? nameByUserId.get(character.playerUserId) : null

    return (
      <li className="characters__item" key={character.id}>
        <div className="characters__heading">
          <div>
            <h3 className="characters__name">{character.name}</h3>
            {character.kind === 'pc' ? (
              <p className="characters__player">
                {playedBy ? `Played by ${playedBy}` : 'Unassigned'}
              </p>
            ) : null}
          </div>

          {canEdit(character) ? (
            <div className="characters__actions">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setEditingId(character.id)}
              >
                Edit
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Delete "${character.name}"?`)) return
                  void run(async () => {
                    await deleteCharacter(character.id)
                    if (editingId === character.id) setEditingId(null)
                    reload()
                  }, 'Could not delete that character.')
                }}
              >
                Delete
              </Button>
            </div>
          ) : null}
        </div>

        {character.description ? (
          <p className="characters__description">{character.description}</p>
        ) : null}
      </li>
    )
  }

  return (
    <div className="characters">
      {actionError ? <Alert>{actionError}</Alert> : null}

      <Card>
        <h2 className="section-title">
          {editing ? 'Edit character' : canManage ? 'Add a character' : 'Add your character'}
        </h2>
        <CharacterForm
          // Remounting resets the fields when switching between create and edit.
          key={editingId ?? 'new'}
          members={members}
          canManage={canManage}
          currentUserId={user?.id ?? ''}
          initialValue={
            editing
              ? {
                  name: editing.name,
                  kind: editing.kind,
                  playerUserId: editing.playerUserId,
                  description: editing.description,
                }
              : undefined
          }
          submitLabel={editing ? 'Save changes' : 'Add character'}
          busy={busy}
          onSubmit={handleSubmit}
          onCancel={editing ? () => setEditingId(null) : undefined}
        />
      </Card>

      <Card>
        <h2 className="section-title">Player characters</h2>

        {error ? <Alert>{error}</Alert> : null}
        {loading ? <p className="characters__status">Loading characters…</p> : null}

        {!loading && !error && playerCharacters.length === 0 ? (
          <p className="characters__status">No player characters yet.</p>
        ) : null}

        <ul className="characters__list">{playerCharacters.map(renderCharacter)}</ul>
      </Card>

      {canManage || nonPlayerCharacters.length > 0 ? (
        <Card>
          <h2 className="section-title">NPCs</h2>

          {!loading && nonPlayerCharacters.length === 0 ? (
            <p className="characters__status">No NPCs yet.</p>
          ) : null}

          <ul className="characters__list">{nonPlayerCharacters.map(renderCharacter)}</ul>
        </Card>
      ) : null}
    </div>
  )
}
