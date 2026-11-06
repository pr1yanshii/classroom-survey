import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../lib/auth.tsx'
import Loading from './Loading.tsx'

export default function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Loading message="Loading..." />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
