import { Navigate, Route, Routes } from 'react-router'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { PublicOnlyRoute } from './auth/PublicOnlyRoute'
import { AppLayout } from './components/layout/AppLayout'
import { PublicLayout } from './components/layout/PublicLayout'
import { LandingPage } from './pages/public/LandingPage'
import { LoginPage } from './pages/auth/LoginPage'
import { SignUpPage } from './pages/auth/SignUpPage'
import { DashboardPage } from './pages/app/DashboardPage'
import { NewCampaignPage } from './pages/app/NewCampaignPage'
import { CampaignWorkspaceLayout } from './pages/app/campaign/CampaignWorkspaceLayout'
import { CampaignOverviewPage } from './pages/app/campaign/CampaignOverviewPage'
import { CampaignMembersPage } from './pages/app/campaign/CampaignMembersPage'
import { SettingsPage } from './pages/app/SettingsPage'
import { NotFoundPage } from './pages/NotFoundPage'

/**
 * The whole route table lives here.
 *
 * Public routes use PublicLayout; everything under /app is guarded by
 * ProtectedRoute and rendered inside the application shell.
 */
export default function App() {
  return (
    <Routes>
      {/* Public website */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />

        {/* Signed-in users get bounced to /app instead of seeing these. */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Authenticated application */}
      <Route path="/app" element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="campaigns" element={<Navigate to="/app" replace />} />
          <Route path="campaigns/new" element={<NewCampaignPage />} />
          {/* Campaign features are child routes here; the layout loads the campaign. */}
          <Route path="campaigns/:campaignId" element={<CampaignWorkspaceLayout />}>
            <Route index element={<CampaignOverviewPage />} />
            <Route path="members" element={<CampaignMembersPage />} />
          </Route>
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
