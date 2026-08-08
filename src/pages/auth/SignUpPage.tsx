import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { errorMessage } from '../../lib/errors'
import { SUPABASE_SETUP_MESSAGE } from '../../lib/supabase/client'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Page, PageHeader } from '../../components/ui/Page'
import './AuthPage.css'

export function SignUpPage() {
  const { signUp, isConfigured } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const { needsEmailConfirmation } = await signUp(email, password)
      if (needsEmailConfirmation) {
        setConfirmationSent(true)
        setSubmitting(false)
        return
      }
      navigate('/app', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught, 'Could not create the account.'))
      setSubmitting(false)
    }
  }

  if (confirmationSent) {
    return (
      <Page width="narrow">
        <PageHeader title="Check your email" />
        <Card>
          <Alert variant="info">
            We sent a confirmation link to {email}. Confirm your address, then sign in.
          </Alert>
        </Card>
        <p className="auth-footer">
          <Link to="/login">Back to sign in</Link>
        </p>
      </Page>
    )
  }

  return (
    <Page width="narrow">
      <PageHeader title="Create account" description="Start your first campaign." />

      <Card>
        <form className="auth-form" onSubmit={handleSubmit}>
          {!isConfigured ? <Alert variant="info">{SUPABASE_SETUP_MESSAGE}</Alert> : null}
          {error ? <Alert>{error}</Alert> : null}

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </Card>

      <p className="auth-footer">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </Page>
  )
}
