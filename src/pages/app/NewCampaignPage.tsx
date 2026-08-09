import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { createCampaign } from '../../campaigns/campaignsApi'
import { useCampaignList } from '../../campaigns/useCampaignList'
import { errorMessage } from '../../lib/errors'
import { Alert } from '../../components/ui/Alert'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Page, PageHeader } from '../../components/ui/Page'
import './NewCampaignPage.css'

export function NewCampaignPage() {
  const navigate = useNavigate()
  const { reload } = useCampaignList()

  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const campaign = await createCampaign(name)
      // The sidebar is about to show this campaign's sections under its name,
      // and the switcher is about to list it. Both read the shell's copy of the
      // list, so it has to know about the campaign before we navigate into it.
      reload()
      navigate(`/app/campaigns/${campaign.id}`, { replace: true })
    } catch (caught) {
      setError(errorMessage(caught, 'Could not create the campaign.'))
      setSubmitting(false)
    }
  }

  return (
    <Page width="narrow">
      <PageHeader title="Create Campaign" description="You will be its owner." />

      <Card>
        <form className="new-campaign-form" onSubmit={handleSubmit}>
          {error ? <Alert>{error}</Alert> : null}

          <Input
            label="Campaign name"
            required
            maxLength={120}
            autoFocus
            placeholder="The Shattered Crown"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <div className="page-actions">
            <Button type="submit" disabled={submitting || name.trim().length === 0}>
              {submitting ? 'Creating…' : 'Create campaign'}
            </Button>
            <ButtonLink to="/app" variant="secondary">
              Cancel
            </ButtonLink>
          </div>
        </form>
      </Card>
    </Page>
  )
}
