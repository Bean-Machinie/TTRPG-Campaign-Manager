import { Navigate, Outlet } from 'react-router'
import { LoadingScreen } from '../components/layout/LoadingScreen'
import { useAuth } from './useAuth'

/** Wraps /login and /signup. Signed-in users are sent into the app instead. */
export function PublicOnlyRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (session) {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}
