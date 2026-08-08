import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../../auth/useAuth'
import { useCampaignInvitations, useCampaignMembers } from '../../../campaigns/hooks'
import {
  deleteInvitation,
  inviteToCampaign,
  removeMember,
} from '../../../campaigns/campaignsApi'
import type { InvitableRole } from '../../../campaigns/types'
import { errorMessage } from '../../../lib/errors'
import { formatDate } from '../../../lib/format'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import { Select } from '../../../components/ui/Select'
import { useCampaignOutlet } from './useCampaignOutlet'
import './CampaignMembersPage.css'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  gm: 'GM',
  player: 'Player',
}

export function CampaignMembersPage() {
  const { campaign, role } = useCampaignOutlet()
  const { user } = useAuth()
  const navigate = useNavigate()

  const isOwner = role === 'owner'
  const members = useCampaignMembers(campaign.id)
  const invitations = useCampaignInvitations(campaign.id)

  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<InvitableRole>('player')
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

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    return run(async () => {
      await inviteToCampaign(campaign.id, email, inviteRole)
      setEmail('')
      invitations.reload()
    }, 'Could not send the invitation.')
  }

  return (
    <div className="members">
      {actionError ? <Alert>{actionError}</Alert> : null}

      <Card>
        <h2 className="section-title">Members</h2>

        {members.error ? <Alert>{members.error}</Alert> : null}
        {members.loading ? <p className="members__status">Loading members…</p> : null}

        <ul className="members__list">
          {members.members.map((member) => {
            const isSelf = member.userId === user?.id

            return (
              <li className="members__row" key={member.membershipId}>
                <div>
                  <span className="members__email">{member.name}</span>
                  {isSelf ? <span className="members__you"> (you)</span> : null}
                  <span className="members__role">{ROLE_LABELS[member.role]}</span>
                  {/* The email still identifies them when a display name is set. */}
                  {member.displayName ? (
                    <span className="members__meta">{member.email}</span>
                  ) : null}
                </div>

                {isSelf && member.role !== 'owner' ? (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await removeMember(member.membershipId)
                        navigate('/app')
                      }, 'Could not leave this campaign.')
                    }
                  >
                    Leave campaign
                  </Button>
                ) : null}

                {!isSelf && isOwner && member.role !== 'owner' ? (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await removeMember(member.membershipId)
                        members.reload()
                      }, 'Could not remove that member.')
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </Card>

      {isOwner ? (
        <Card>
          <h2 className="section-title">Pending invitations</h2>

          {invitations.error ? <Alert>{invitations.error}</Alert> : null}

          {invitations.invitations.length === 0 && !invitations.loading ? (
            <p className="members__status">No invitations are waiting to be accepted.</p>
          ) : null}

          <ul className="members__list">
            {invitations.invitations.map((invitation) => (
              <li className="members__row" key={invitation.id}>
                <div>
                  <span className="members__email">{invitation.email}</span>
                  <span className="members__role">{ROLE_LABELS[invitation.role]}</span>
                  <span className="members__meta">Invited {formatDate(invitation.createdAt)}</span>
                </div>

                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await deleteInvitation(invitation.id)
                      invitations.reload()
                    }, 'Could not revoke that invitation.')
                  }
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {isOwner ? (
        <Card>
          <h2 className="section-title">Invite someone</h2>

          <form className="members__invite" onSubmit={handleInvite}>
            <Input
              label="Email address"
              type="email"
              required
              placeholder="player@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Select
              label="Role"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as InvitableRole)}
            >
              <option value="player">Player</option>
              <option value="gm">GM</option>
            </Select>

            <Button type="submit" disabled={busy || email.trim().length === 0}>
              {busy ? 'Sending…' : 'Send invitation'}
            </Button>
          </form>

          <p className="members__note">
            No email is sent yet. They will see the invitation on their dashboard the next
            time they sign in with that address.
          </p>
        </Card>
      ) : null}
    </div>
  )
}
