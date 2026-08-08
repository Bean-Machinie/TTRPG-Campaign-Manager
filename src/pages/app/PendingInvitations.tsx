import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import { usePendingInvitations } from '../../campaigns/hooks'
import { acceptInvitation, deleteInvitation } from '../../campaigns/campaignsApi'
import { errorMessage } from '../../lib/errors'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import './PendingInvitations.css'

const ROLE_LABELS: Record<string, string> = { gm: 'GM', player: 'Player' }

/** Invitations waiting for the signed-in user. Renders nothing when there are none. */
export function PendingInvitations({ onAccepted }: { onAccepted: () => void }) {
  const { user } = useAuth()
  const { invitations, error, reload } = usePendingInvitations(user?.email)

  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  if (!error && invitations.length === 0) return null

  return (
    <Card className="invitations">
      <h2 className="section-title">Invitations</h2>

      {error ? <Alert>{error}</Alert> : null}
      {actionError ? <Alert>{actionError}</Alert> : null}

      <ul className="invitations__list">
        {invitations.map((invitation) => (
          <li className="invitations__row" key={invitation.id}>
            <div>
              <span className="invitations__campaign">{invitation.campaignName}</span>
              <span className="invitations__role">as {ROLE_LABELS[invitation.role]}</span>
            </div>

            <div className="invitations__actions">
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await acceptInvitation(invitation.id)
                    reload()
                    onAccepted()
                  }, 'Could not accept that invitation.')
                }
              >
                Accept
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await deleteInvitation(invitation.id)
                    reload()
                  }, 'Could not decline that invitation.')
                }
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
