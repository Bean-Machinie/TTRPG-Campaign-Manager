import { Outlet, useLocation, useParams } from 'react-router'
import { useAuth } from '../../../auth/useAuth'
import { useCampaignMembership } from '../../../campaigns/hooks'
import { formatDate } from '../../../lib/format'
import { Alert } from '../../../components/ui/Alert'
import { ButtonLink } from '../../../components/ui/Button'
import { Page, PageHeader } from '../../../components/ui/Page'
import { CAMPAIGN_SECTIONS } from '../../../components/shell/navigation'
import type { CampaignOutletContext } from './useCampaignOutlet'
import './CampaignWorkspaceLayout.css'

/**
 * The campaign workspace.
 *
 * It used to own a column of nine links down the left of the content. Those
 * moved into the application sidebar, where they sit beside everything else the
 * product can do instead of forming a second, competing navigation inside the
 * page — so what is left here is the part that only this route can do: load the
 * membership, refuse politely when there is not one, and title the section.
 */

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  gm: 'GM',
  player: 'Player',
}

export function CampaignWorkspaceLayout() {
  const { campaignId } = useParams()
  const { user } = useAuth()
  const { membership, loading, error } = useCampaignMembership(campaignId, user?.id)
  const heading = useSectionHeading()

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

  // A document has a title, a heading and chrome of its own, and it is the
  // whole page. Anything this layout added above it would be said twice.
  if (heading === 'own') {
    return (
      <div className="workspace-detail">
        <Outlet context={context} />
      </div>
    )
  }

  return (
    <Page>
      <PageHeader
        title={heading ? heading.title : campaign.name}
        description={
          heading
            ? heading.description
            : `${ROLE_LABELS[role]} · Created ${formatDate(campaign.createdAt)}`
        }
      />

      <Outlet context={context} />
    </Page>
  )
}

/**
 * What to call the page.
 *
 * The campaign's own name on the overview — landing on a campaign should say
 * which campaign — and the section's name inside a section. `own` means the
 * route below this one is titling itself.
 */
function useSectionHeading(): { title: string; description: string } | 'own' | null {
  const { pathname } = useLocation()
  // /app/campaigns/:campaignId/<section>/<rest…>
  const segments = pathname.split('/').filter(Boolean).slice(3)

  if (segments.length === 0) return null
  if (segments.length > 1) return 'own'

  const section = CAMPAIGN_SECTIONS.find((entry) => entry.path === segments[0])
  return section ? { title: section.label, description: section.hint } : null
}
