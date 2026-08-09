import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { useCampaignList } from '../../campaigns/useCampaignList'
import { initialsOf } from '../../components/shell/navigation'
import { formatDateOnly } from '../../lib/format'
import { Alert } from '../../components/ui/Alert'
import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Page, PageHeader } from '../../components/ui/Page'
import { PendingInvitations } from './PendingInvitations'
import '../../components/shell/icons.css'
import './DashboardPage.css'

export function DashboardPage() {
  // The shell already loaded these for the switcher and the palette.
  const { campaigns, loading, error, reload } = useCampaignList()

  return (
    <Page>
      <PageHeader
        title="Your campaigns"
        description="Everything you run or play in."
        action={<ButtonLink to="/app/campaigns/new">+ Create campaign</ButtonLink>}
      />

      {/* Accepting an invitation adds a campaign, so the list below reloads. */}
      <PendingInvitations onAccepted={reload} />

      {error ? <Alert>{error}</Alert> : null}

      {loading && campaigns.length === 0 ? (
        <ul className="campaign-grid">
          {[0, 1, 2].map((row) => (
            <li key={row}>
              <div className="campaign-card campaign-card--loading" />
            </li>
          ))}
        </ul>
      ) : null}

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
              {/*
                The whole card is the link. A card with one button on it asks
                the reader to aim at the button; there is nothing else here to
                click, so there is nothing to aim at.
              */}
              <Link className="campaign-card icon-host" to={`/app/campaigns/${campaign.id}`}>
                <span className="campaign-card__avatar" aria-hidden="true">
                  {initialsOf(campaign.name)}
                </span>

                <span className="campaign-card__body">
                  <span className="campaign-card__name">{campaign.name}</span>
                  <span className="campaign-card__meta">
                    {campaign.lastPlayedOn
                      ? `Last played ${formatDateOnly(campaign.lastPlayedOn)}`
                      : 'Not played yet'}
                  </span>
                </span>

                <ArrowRight
                  className="ui-icon campaign-card__go"
                  data-motion="slide"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Page>
  )
}
