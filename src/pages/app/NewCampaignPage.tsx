import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Page, PageHeader } from '../../components/ui/Page'

export function NewCampaignPage() {
  return (
    <Page width="narrow">
      <PageHeader title="Create Campaign" />

      <Card>
        <p>Campaign creation will be implemented in the next iteration.</p>
      </Card>

      <div className="page-actions">
        <ButtonLink to="/app" variant="secondary">
          Back to campaigns
        </ButtonLink>
      </div>
    </Page>
  )
}
