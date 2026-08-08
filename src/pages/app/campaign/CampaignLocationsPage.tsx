import { useState } from 'react'
import { useCampaignLocations } from '../../../campaigns/hooks'
import { createLocation, deleteLocation, updateLocation } from '../../../campaigns/campaignsApi'
import type { LocationInput } from '../../../campaigns/types'
import { errorMessage } from '../../../lib/errors'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { LocationForm } from './LocationForm'
import { useCampaignOutlet } from './useCampaignOutlet'
import './entryList.css'

export function CampaignLocationsPage() {
  const { campaign, role } = useCampaignOutlet()
  const canManage = role === 'owner' || role === 'gm'

  const { locations, loading, error, reload } = useCampaignLocations(campaign.id)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const editing = locations.find((location) => location.id === editingId) ?? null

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

  function handleSubmit(input: LocationInput) {
    const id = editingId
    void run(async () => {
      if (id) {
        await updateLocation(id, input)
      } else {
        await createLocation(campaign.id, input)
      }
      setEditingId(null)
      reload()
    }, 'Could not save the location.')
  }

  return (
    <div className="entry-section">
      {actionError ? <Alert>{actionError}</Alert> : null}

      {canManage ? (
        <Card>
          <h2 className="section-title">{editing ? 'Edit location' : 'Add a location'}</h2>
          <LocationForm
            // Remounting resets the fields when switching between create and edit.
            key={editingId ?? 'new'}
            initialValue={
              editing ? { name: editing.name, description: editing.description } : undefined
            }
            submitLabel={editing ? 'Save changes' : 'Add location'}
            busy={busy}
            onSubmit={handleSubmit}
            onCancel={editing ? () => setEditingId(null) : undefined}
          />
        </Card>
      ) : null}

      <Card>
        <h2 className="section-title">Locations</h2>

        {error ? <Alert>{error}</Alert> : null}
        {loading ? <p className="entry-status">Loading locations…</p> : null}

        {!loading && !error && locations.length === 0 ? (
          <p className="entry-status">
            No locations yet.
            {canManage ? ' Add the first one above.' : ' Your GM has not added any.'}
          </p>
        ) : null}

        <ul className="entry-list">
          {locations.map((location) => (
            <li className="entry" key={location.id}>
              <div className="entry__heading">
                <h3 className="entry__title">{location.name}</h3>

                {canManage ? (
                  <div className="entry__actions">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setEditingId(location.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Delete "${location.name}"?`)) return
                        void run(async () => {
                          await deleteLocation(location.id)
                          if (editingId === location.id) setEditingId(null)
                          reload()
                        }, 'Could not delete that location.')
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </div>

              {location.description ? <p className="entry__body">{location.description}</p> : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
