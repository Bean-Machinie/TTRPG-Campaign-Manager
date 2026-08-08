import { Navigate, Outlet, useLocation } from 'react-router'
import { LoadingScreen } from '../components/layout/LoadingScreen'
import { useAuth } from './useAuth'

/** Wraps everything under /app. Unauthenticated visitors are sent to /login. */
export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingScreen />
  }

  if (!session) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
