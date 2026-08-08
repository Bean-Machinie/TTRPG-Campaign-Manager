import { useState } from 'react'
import { useCampaignQuests } from '../../../campaigns/hooks'
import { createQuest, deleteQuest, updateQuest } from '../../../campaigns/campaignsApi'
import type { CampaignQuest, QuestInput } from '../../../campaigns/types'
import { errorMessage } from '../../../lib/errors'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { QuestForm } from './QuestForm'
import { useCampaignOutlet } from './useCampaignOutlet'
import './entryList.css'

const STATUS_LABELS = {
  active: 'Active',
  completed: 'Completed',
  abandoned: 'Abandoned',
}

export function CampaignQuestsPage() {
  const { campaign, role } = useCampaignOutlet()
  const canManage = role === 'owner' || role === 'gm'

  const { quests, loading, error, reload } = useCampaignQuests(campaign.id)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const editing = quests.find((quest) => quest.id === editingId) ?? null
  const activeQuests = quests.filter((quest) => quest.status === 'active')
  const closedQuests = quests.filter((quest) => quest.status !== 'active')

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

  function handleSubmit(input: QuestInput) {
    const id = editingId
    void run(async () => {
      if (id) {
        await updateQuest(id, input)
      } else {
        await createQuest(campaign.id, input)
      }
      setEditingId(null)
      reload()
    }, 'Could not save the quest.')
  }

  function renderQuest(quest: CampaignQuest) {
    return (
      <li className="entry" key={quest.id}>
        <div className="entry__heading">
          <div>
            <h3 className="entry__title">
              {quest.title}
              {quest.status !== 'active' ? (
                <span className="entry__badge">{STATUS_LABELS[quest.status]}</span>
              ) : null}
            </h3>
          </div>

          {canManage ? (
            <div className="entry__actions">
              <Button variant="secondary" disabled={busy} onClick={() => setEditingId(quest.id)}>
                Edit
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Delete "${quest.title}"?`)) return
                  void run(async () => {
                    await deleteQuest(quest.id)
                    if (editingId === quest.id) setEditingId(null)
                    reload()
                  }, 'Could not delete that quest.')
                }}
              >
                Delete
              </Button>
            </div>
          ) : null}
        </div>

        {quest.description ? <p className="entry__body">{quest.description}</p> : null}
      </li>
    )
  }

  return (
    <div className="entry-section">
      {actionError ? <Alert>{actionError}</Alert> : null}

      {canManage ? (
        <Card>
          <h2 className="section-title">{editing ? 'Edit quest' : 'Add a quest'}</h2>
          <QuestForm
            // Remounting resets the fields when switching between create and edit.
            key={editingId ?? 'new'}
            initialValue={
              editing
                ? {
                    title: editing.title,
                    status: editing.status,
                    description: editing.description,
                  }
                : undefined
            }
            submitLabel={editing ? 'Save changes' : 'Add quest'}
            busy={busy}
            onSubmit={handleSubmit}
            onCancel={editing ? () => setEditingId(null) : undefined}
          />
        </Card>
      ) : null}

      <Card>
        <h2 className="section-title">Active quests</h2>

        {error ? <Alert>{error}</Alert> : null}
        {loading ? <p className="entry-status">Loading quests…</p> : null}

        {!loading && !error && activeQuests.length === 0 ? (
          <p className="entry-status">
            No active quests.
            {canManage ? ' Add one above.' : ' Your GM has not added any.'}
          </p>
        ) : null}

        <ul className="entry-list">{activeQuests.map(renderQuest)}</ul>
      </Card>

      {closedQuests.length > 0 ? (
        <Card>
          <h2 className="section-title">Finished</h2>
          <ul className="entry-list">{closedQuests.map(renderQuest)}</ul>
        </Card>
      ) : null}
    </div>
  )
}
