import { useAuth } from '../../auth/useAuth'
import { Card } from '../../components/ui/Card'
import { Page, PageHeader } from '../../components/ui/Page'

export function SettingsPage() {
  const { user } = useAuth()

  return (
    <Page width="narrow">
      <PageHeader title="Settings" description="Your account." />

      <Card>
        <p>
          Signed in as <strong>{user?.email}</strong>
        </p>
        <p>Account settings will be implemented in a later iteration.</p>
      </Card>
    </Page>
  )
}
