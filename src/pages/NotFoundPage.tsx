import { ButtonLink } from '../components/ui/Button'
import { Page, PageHeader } from '../components/ui/Page'

export function NotFoundPage() {
  return (
    <Page width="narrow">
      <PageHeader title="Page not found" description="That route does not exist." />
      <div className="page-actions">
        <ButtonLink to="/" variant="secondary">
          Back to home
        </ButtonLink>
      </div>
    </Page>
  )
}
