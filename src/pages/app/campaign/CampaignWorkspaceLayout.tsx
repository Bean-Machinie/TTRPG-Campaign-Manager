import { Link, NavLink, Outlet, useParams } from 'react-router'
import { useAuth } from '../../../auth/useAuth'
import { useCampaignMembership } from '../../../campaigns/hooks'
import { formatDate } from '../../../lib/format'
import { Alert } from '../../../components/ui/Alert'
import { ButtonLink } from '../../../components/ui/Button'
import { Page, PageHeader } from '../../../components/ui/Page'
import type { CampaignOutletContext } from './useCampaignOutlet'
import './CampaignWorkspaceLayout.css'

/**
 * Sections that do not exist yet. Each becomes a NavLink to a child route as it
 * is built, exactly like Members did.
 */
const FUTURE_SECTIONS = ['Characters', 'Locations', 'Quests', 'Notes', 'Maps']

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
          <NavLink className="workspace-nav__item" to="members">
            Members
          </NavLink>
          {FUTURE_SECTIONS.map((section) => (
            <span key={section} className="workspace-nav__item workspace-nav__item--future">
              {section}
            </span>
          ))}
        </nav>

        <div>
          <Outlet context={context} />
        </div>
      </div>
    </Page>
  )
}
