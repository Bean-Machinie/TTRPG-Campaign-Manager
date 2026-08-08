import { useState } from 'react'
import { useCampaignSessions } from '../../../campaigns/hooks'
import { createSession, deleteSession, updateSession } from '../../../campaigns/campaignsApi'
import type { SessionInput } from '../../../campaigns/types'
import { errorMessage } from '../../../lib/errors'
import { formatDateOnly, todayIsoDate } from '../../../lib/format'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { SessionForm } from './SessionForm'
import { useCampaignOutlet } from './useCampaignOutlet'
import './CampaignSessionsPage.css'

export function CampaignSessionsPage() {
  const { campaign, role } = useCampaignOutlet()
  const canManage = role === 'owner' || role === 'gm'

  const { sessions, loading, error, reload } = useCampaignSessions(campaign.id)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const editing = sessions.find((session) => session.id === editingId) ?? null
  const today = todayIsoDate()

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

  function handleSubmit(input: SessionInput) {
    const id = editingId
    void run(async () => {
      if (id) {
        await updateSession(id, input)
      } else {
        await createSession(campaign.id, input)
      }
      setEditingId(null)
      reload()
    }, 'Could not save the session.')
  }

  return (
    <div className="sessions">
      {actionError ? <Alert>{actionError}</Alert> : null}

      {canManage ? (
        <Card>
          <h2 className="section-title">{editing ? 'Edit session' : 'Plan a session'}</h2>
          <SessionForm
            // Remounting resets the fields when switching between create and edit.
            key={editingId ?? 'new'}
            initialValue={
              editing
                ? {
                    title: editing.title,
                    scheduledFor: editing.scheduledFor,
                    notes: editing.notes,
                  }
                : undefined
            }
            submitLabel={editing ? 'Save changes' : 'Add session'}
            busy={busy}
            onSubmit={handleSubmit}
            onCancel={editing ? () => setEditingId(null) : undefined}
          />
        </Card>
      ) : null}

      <Card>
        <h2 className="section-title">Sessions</h2>

        {error ? <Alert>{error}</Alert> : null}
        {loading ? <p className="sessions__status">Loading sessions…</p> : null}

        {!loading && !error && sessions.length === 0 ? (
          <p className="sessions__status">
            No sessions yet.
            {canManage ? ' Add the first one above.' : ' Your GM has not added any.'}
          </p>
        ) : null}

        <ul className="sessions__list">
          {sessions.map((session) => (
            <li className="sessions__item" key={session.id}>
              <div className="sessions__heading">
                <div>
                  <h3 className="sessions__title">{session.title}</h3>
                  <p className="sessions__date">
                    {session.scheduledFor ? formatDateOnly(session.scheduledFor) : 'No date yet'}
                    {session.scheduledFor && session.scheduledFor > today ? (
                      <span className="sessions__badge">Upcoming</span>
                    ) : null}
                  </p>
                </div>

                {canManage ? (
                  <div className="sessions__actions">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setEditingId(session.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Delete "${session.title}"?`)) return
                        void run(async () => {
                          await deleteSession(session.id)
                          if (editingId === session.id) setEditingId(null)
                          reload()
                        }, 'Could not delete that session.')
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </div>

              {session.notes ? <p className="sessions__notes">{session.notes}</p> : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
