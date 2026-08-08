import { demoCampaigns } from '../../data/demoCampaigns'
import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Page, PageHeader } from '../../components/ui/Page'
import './DashboardPage.css'

export function DashboardPage() {
  return (
    <Page>
      <PageHeader
        title="Your Campaigns"
        description="Demonstration data — campaigns are not stored yet."
        action={<ButtonLink to="/app/campaigns/new">+ Create campaign</ButtonLink>}
      />

      <ul className="campaign-grid">
        {demoCampaigns.map((campaign) => (
          <li key={campaign.id}>
            <Card className="campaign-card">
              <h2 className="campaign-card__name">{campaign.name}</h2>
              <p className="campaign-card__meta">{campaign.lastPlayed}</p>
              <ButtonLink to={`/app/campaigns/${campaign.id}`} variant="secondary">
                Open campaign
              </ButtonLink>
            </Card>
          </li>
        ))}
      </ul>
    </Page>
  )
}
