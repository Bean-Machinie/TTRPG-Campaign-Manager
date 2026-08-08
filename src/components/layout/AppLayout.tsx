import { Link, Outlet, useNavigate } from 'react-router'
import { APP_NAME } from '../../constants'
import { useAuth } from '../../auth/useAuth'
import { Button } from '../ui/Button'
import './AppLayout.css'

/**
 * Shell for the authenticated application.
 * Deliberately minimal: real navigation should be discovered as the product grows.
 */
export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header__inner">
          <Link className="app-header__brand" to="/app">
            {APP_NAME}
          </Link>

          <div className="app-header__account">
            <span className="app-header__email">{user?.email}</span>
            <Link className="app-header__link" to="/app/settings">
              Settings
            </Link>
            <Button variant="secondary" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  )
}
