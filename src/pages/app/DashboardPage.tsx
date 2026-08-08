import { useCampaigns } from '../../campaigns/hooks'
import { formatDateOnly } from '../../lib/format'
import { Alert } from '../../components/ui/Alert'
import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Page, PageHeader } from '../../components/ui/Page'
import { PendingInvitations } from './PendingInvitations'
import './DashboardPage.css'

export function DashboardPage() {
  const { campaigns, loading, error, reload } = useCampaigns()

  return (
    <Page>
      <PageHeader
        title="Your Campaigns"
        action={<ButtonLink to="/app/campaigns/new">+ Create campaign</ButtonLink>}
      />

      {/* Accepting an invitation adds a campaign, so the list below reloads. */}
      <PendingInvitations onAccepted={reload} />

      {error ? <Alert>{error}</Alert> : null}

      {loading ? <p className="campaigns-status">Loading campaigns…</p> : null}

      {!loading && !error && campaigns.length === 0 ? (
        <Card>
          <p className="campaigns-empty">
            You are not part of any campaign yet. Create one to get started.
          </p>
        </Card>
      ) : null}

      {campaigns.length > 0 ? (
        <ul className="campaign-grid">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Card className="campaign-card">
                <h2 className="campaign-card__name">{campaign.name}</h2>
                <p className="campaign-card__meta">
                  {campaign.lastPlayedOn
                    ? `Last played ${formatDateOnly(campaign.lastPlayedOn)}`
                    : 'Not played yet'}
                </p>
                <ButtonLink to={`/app/campaigns/${campaign.id}`} variant="secondary">
                  Open campaign
                </ButtonLink>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </Page>
  )
}
