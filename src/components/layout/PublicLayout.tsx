import { Link, Outlet } from 'react-router'
import { APP_NAME } from '../../constants'
import './PublicLayout.css'

/** Shell for the public / marketing side of the product. */
export function PublicLayout() {
  return (
    <div className="public-layout">
      <header className="public-header">
        <div className="public-header__inner">
          <Link className="public-header__brand" to="/">
            {APP_NAME}
          </Link>
          <nav className="public-header__nav">
            <Link to="/login">Sign in</Link>
            <Link to="/signup">Create account</Link>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  )
}
