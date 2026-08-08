import { useState } from 'react'
import { useCampaignLocations, useCampaignMaps } from '../../../campaigns/hooks'
import { createMap, deleteMap, updateMap } from '../../../campaigns/campaignsApi'
import type { MapInput } from '../../../campaigns/types'
import { errorMessage } from '../../../lib/errors'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { MapForm } from './MapForm'
import { useCampaignOutlet } from './useCampaignOutlet'
import './entryList.css'
import './CampaignMapsPage.css'

export function CampaignMapsPage() {
  const { campaign, role } = useCampaignOutlet()
  const canManage = role === 'owner' || role === 'gm'

  const { maps, loading, error, reload } = useCampaignMaps(campaign.id)
  const { locations } = useCampaignLocations(campaign.id)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const editing = maps.find((map) => map.id === editingId) ?? null
  const locationNameById = new Map(locations.map((location) => [location.id, location.name]))

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

  function handleSubmit(input: MapInput, file: File | null) {
    const id = editingId
    void run(async () => {
      if (id) {
        await updateMap(id, input)
      } else {
        if (!file) return
        await createMap(campaign.id, input, file)
      }
      setEditingId(null)
      reload()
    }, 'Could not save the map.')
  }

  return (
    <div className="entry-section">
      {actionError ? <Alert>{actionError}</Alert> : null}

      {canManage ? (
        <Card>
          <h2 className="section-title">{editing ? 'Edit map' : 'Upload a map'}</h2>
          <MapForm
            // Remounting resets the fields when switching between create and edit.
            key={editingId ?? 'new'}
            locations={locations}
            initialValue={
              editing ? { name: editing.name, locationId: editing.locationId } : undefined
            }
            submitLabel={editing ? 'Save changes' : 'Upload map'}
            busy={busy}
            onSubmit={handleSubmit}
            onCancel={editing ? () => setEditingId(null) : undefined}
          />
        </Card>
      ) : null}

      <Card>
        <h2 className="section-title">Maps</h2>

        {error ? <Alert>{error}</Alert> : null}
        {loading ? <p className="entry-status">Loading maps…</p> : null}

        {!loading && !error && maps.length === 0 ? (
          <p className="entry-status">
            No maps yet.
            {canManage ? ' Upload the first one above.' : ' Your GM has not added any.'}
          </p>
        ) : null}

        <ul className="map-grid">
          {maps.map((map) => (
            <li className="map-card" key={map.id}>
              {map.signedUrl ? (
                // Opens the full image in a new tab; the list shows a preview.
                <a href={map.signedUrl} target="_blank" rel="noreferrer">
                  <img className="map-card__image" src={map.signedUrl} alt={map.name} />
                </a>
              ) : (
                <div className="map-card__missing">Image unavailable</div>
              )}

              <div className="map-card__info">
                <div>
                  <h3 className="entry__title">{map.name}</h3>
                  <p className="entry__meta">
                    {map.locationId
                      ? (locationNameById.get(map.locationId) ?? 'Unknown location')
                      : 'Whole campaign'}
                  </p>
                </div>

                {canManage ? (
                  <div className="entry__actions">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setEditingId(map.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Delete "${map.name}"?`)) return
                        void run(async () => {
                          await deleteMap(map.id, map.storagePath)
                          if (editingId === map.id) setEditingId(null)
                          reload()
                        }, 'Could not delete that map.')
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
