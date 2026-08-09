import { Link, NavLink, Outlet, useParams } from 'react-router'
import { useAuth } from '../../../auth/useAuth'
import { useCampaignMembership } from '../../../campaigns/hooks'
import { formatDate } from '../../../lib/format'
import { Alert } from '../../../components/ui/Alert'
import { ButtonLink } from '../../../components/ui/Button'
import { Page, PageHeader } from '../../../components/ui/Page'
import type { CampaignOutletContext } from './useCampaignOutlet'
import './CampaignWorkspaceLayout.css'

// Every planned section now exists as a real child route.

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  gm: 'GM',
  player: 'Player',
}

export function CampaignWorkspaceLayout() {
  const { campaignId } = useParams()
  const { user } = useAuth()
  const { membership, loading, error } = useCampaignMembership(campaignId, user?.id)

  if (loading) {
    return (
      <Page>
        <p className="workspace-status">Loading campaign…</p>
      </Page>
    )
  }

  if (error) {
    return (
      <Page>
        <Alert>{error}</Alert>
      </Page>
    )
  }

  if (!membership) {
    return (
      <Page width="narrow">
        <PageHeader
          title="Campaign not found"
          description="It does not exist, or it is not shared with you."
        />
        <div className="page-actions">
          <ButtonLink to="/app" variant="secondary">
            Back to campaigns
          </ButtonLink>
        </div>
      </Page>
    )
  }

  const { campaign, role } = membership
  const context: CampaignOutletContext = { campaign, role }

  return (
    <Page>
      <PageHeader
        title={campaign.name}
        description={
          <>
            {ROLE_LABELS[role]} · Created {formatDate(campaign.createdAt)} ·{' '}
            <Link to="/app">Back to campaigns</Link>
          </>
        }
      />

      <div className="workspace">
        <nav className="workspace-nav" aria-label="Campaign sections">
          <NavLink className="workspace-nav__item" to="." end>
            Overview
          </NavLink>
          <NavLink className="workspace-nav__item" to="sessions">
            Sessions
          </NavLink>
          <NavLink className="workspace-nav__item" to="characters">
            Characters
          </NavLink>
          <NavLink className="workspace-nav__item" to="locations">
            Locations
          </NavLink>
          <NavLink className="workspace-nav__item" to="quests">
            Quests
          </NavLink>
          <NavLink className="workspace-nav__item" to="notes">
            Notes
          </NavLink>
          <NavLink className="workspace-nav__item" to="documents">
            Documents
          </NavLink>
          <NavLink className="workspace-nav__item" to="maps">
            Maps
          </NavLink>
          <NavLink className="workspace-nav__item" to="members">
            Members
          </NavLink>
        </nav>

        <div>
          <Outlet context={context} />
        </div>
      </div>
    </Page>
  )
}
