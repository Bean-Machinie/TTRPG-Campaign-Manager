import { Link, useParams } from 'react-router'
import { findDemoCampaign } from '../../data/demoCampaigns'
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

export function CampaignWorkspacePage() {
  const { campaignId } = useParams()
  const campaign = campaignId ? findDemoCampaign(campaignId) : undefined

  return (
    <Page>
      <PageHeader
        title={campaign?.name ?? 'Campaign'}
        description={
          <>
            Campaign workspace ·{' '}
            <Link to="/app">Back to campaigns</Link>
          </>
        }
      />

      {!campaign ? (
        <p className="workspace-unknown">
          No demo campaign matches <code>{campaignId}</code>. Real campaigns arrive with
          persistence.
        </p>
      ) : null}

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
