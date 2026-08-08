import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import { useMyProfile } from '../../profile/hooks'
import { updateDisplayName } from '../../profile/profileApi'
import { errorMessage } from '../../lib/errors'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Page, PageHeader } from '../../components/ui/Page'
import './SettingsPage.css'

export function SettingsPage() {
  const { user } = useAuth()
  const { profile, loading, error, reload } = useMyProfile(user?.id)

  return (
    <Page width="narrow">
      <PageHeader title="Settings" description="Your account." />

      <Card>
        <h2 className="section-title">Display name</h2>
        <p className="settings__hint">
          What the people in your campaigns see instead of your email address.
        </p>

        {error ? <Alert>{error}</Alert> : null}
        {loading ? <p className="settings__hint">Loading…</p> : null}

        {profile ? (
          <DisplayNameForm
            // Remounting once the profile arrives seeds the field with it.
            key={profile.displayName ?? ''}
            userId={profile.id}
            initialValue={profile.displayName ?? ''}
            onSaved={reload}
          />
        ) : null}
      </Card>

      <Card className="settings__account">
        <h2 className="section-title">Account</h2>
        <p>
          Signed in as <strong>{user?.email}</strong>
        </p>
        <p className="settings__hint">
          Changing your email address and password will be added in a later iteration.
        </p>
      </Card>
    </Page>
  )
}

type DisplayNameFormProps = {
  userId: string
  initialValue: string
  onSaved: () => void
}

function DisplayNameForm({ userId, initialValue, onSaved }: DisplayNameFormProps) {
  const [name, setName] = useState(initialValue)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError(null)
    setSaved(false)
    setBusy(true)

    try {
      await updateDisplayName(userId, name)
      setSaved(true)
      onSaved()
    } catch (caught) {
      setSaveError(errorMessage(caught, 'Could not save your display name.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="settings__form" onSubmit={handleSubmit}>
      {saveError ? <Alert>{saveError}</Alert> : null}

      <Input
        label="Display name"
        maxLength={60}
        placeholder="Leave empty to show your email"
        value={name}
        onChange={(event) => {
          setName(event.target.value)
          setSaved(false)
        }}
      />

      <div className="page-actions">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        {saved ? <span className="settings__saved">Saved</span> : null}
      </div>
    </form>
  )
}
