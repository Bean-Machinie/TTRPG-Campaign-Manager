import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { useCampaignMembership } from '../../campaigns/useCampaignMembership'
import { formatDate } from '../../lib/format'
import { Alert } from '../../components/ui/Alert'
import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Page, PageHeader } from '../../components/ui/Page'
import './CampaignWorkspacePage.css'

/**
 * Everything campaign-scoped belongs beneath this route, so that future features
 * become nested routes such as /app/campaigns/:campaignId/sessions rather than
 * global application state.
 */
const FUTURE_SECTIONS = [
  'Sessions',
  'Characters',
  'Locations',
  'Quests',
  'Notes',
  'Maps',
  'Settings',
]

const ROLE_LABELS = {
  owner: 'Owner',
  gm: 'GM',
  player: 'Player',
}

export function CampaignWorkspacePage() {
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
          <span className="workspace-nav__item workspace-nav__item--current" aria-current="page">
            Overview
          </span>
          {FUTURE_SECTIONS.map((section) => (
            <span key={section} className="workspace-nav__item workspace-nav__item--future">
              {section}
            </span>
          ))}
        </nav>

        <Card>
          <h2 className="workspace-section-title">Overview</h2>
          <p>Campaign features will be added here incrementally.</p>
        </Card>
      </div>
    </Page>
  )
}
