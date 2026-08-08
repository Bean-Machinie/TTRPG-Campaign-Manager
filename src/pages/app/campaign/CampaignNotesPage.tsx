import { useState } from 'react'
import { useAuth } from '../../../auth/useAuth'
import { useCampaignMembers, useCampaignNotes } from '../../../campaigns/hooks'
import { createNote, deleteNote, updateNote } from '../../../campaigns/campaignsApi'
import type { NoteInput } from '../../../campaigns/types'
import { errorMessage } from '../../../lib/errors'
import { formatDate } from '../../../lib/format'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { NoteForm } from './NoteForm'
import { useCampaignOutlet } from './useCampaignOutlet'
import './entryList.css'

export function CampaignNotesPage() {
  const { campaign } = useCampaignOutlet()
  const { user } = useAuth()

  const { notes, loading, error, reload } = useCampaignNotes(campaign.id)
  const { members } = useCampaignMembers(campaign.id)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const editing = notes.find((note) => note.id === editingId) ?? null
  const nameByUserId = new Map(members.map((member) => [member.userId, member.name]))

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

  function handleSubmit(input: NoteInput) {
    const id = editingId
    void run(async () => {
      if (id) {
        await updateNote(id, input)
      } else {
        await createNote(campaign.id, input)
      }
      setEditingId(null)
      reload()
    }, 'Could not save the note.')
  }

  return (
    <div className="entry-section">
      {actionError ? <Alert>{actionError}</Alert> : null}

      <Card>
        <h2 className="section-title">{editing ? 'Edit note' : 'Write a note'}</h2>
        <NoteForm
          // Remounting resets the fields when switching between create and edit.
          key={editingId ?? 'new'}
          initialValue={
            editing
              ? { title: editing.title, body: editing.body, isPrivate: editing.isPrivate }
              : undefined
          }
          submitLabel={editing ? 'Save changes' : 'Add note'}
          busy={busy}
          onSubmit={handleSubmit}
          onCancel={editing ? () => setEditingId(null) : undefined}
        />
      </Card>

      <Card>
        <h2 className="section-title">Notes</h2>

        {error ? <Alert>{error}</Alert> : null}
        {loading ? <p className="entry-status">Loading notes…</p> : null}

        {!loading && !error && notes.length === 0 ? (
          <p className="entry-status">No notes yet. Write the first one above.</p>
        ) : null}

        <ul className="entry-list">
          {notes.map((note) => {
            const isMine = note.authorId === user?.id

            return (
              <li className="entry" key={note.id}>
                <div className="entry__heading">
                  <div>
                    <h3 className="entry__title">
                      {note.title}
                      {note.isPrivate ? <span className="entry__badge">Private</span> : null}
                    </h3>
                    <p className="entry__meta">
                      {isMine ? 'You' : (nameByUserId.get(note.authorId) ?? 'Unknown author')} ·{' '}
                      {formatDate(note.createdAt)}
                    </p>
                  </div>

                  {/* Nobody edits or removes someone else's note. */}
                  {isMine ? (
                    <div className="entry__actions">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setEditingId(note.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`Delete "${note.title}"?`)) return
                          void run(async () => {
                            await deleteNote(note.id)
                            if (editingId === note.id) setEditingId(null)
                            reload()
                          }, 'Could not delete that note.')
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </div>

                {note.body ? <p className="entry__body">{note.body}</p> : null}
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
