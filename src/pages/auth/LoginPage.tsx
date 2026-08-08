import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { SUPABASE_SETUP_MESSAGE } from '../../lib/supabase/client'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Page, PageHeader } from '../../components/ui/Page'
import './AuthPage.css'

export function LoginPage() {
  const { signIn, isConfigured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Where the user was headed before being redirected to /login.
  const from = (location.state as { from?: string } | null)?.from ?? '/app'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.')
      setSubmitting(false)
    }
  }

  return (
    <Page width="narrow">
      <PageHeader title="Sign in" description="Welcome back." />

      <Card>
        <form className="auth-form" onSubmit={handleSubmit}>
          {!isConfigured ? <p className="auth-form__notice">{SUPABASE_SETUP_MESSAGE}</p> : null}
          {error ? (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          ) : null}

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
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>

      <p className="auth-footer">
        Don&apos;t have an account? <Link to="/signup">Create one</Link>
      </p>
    </Page>
  )
}
