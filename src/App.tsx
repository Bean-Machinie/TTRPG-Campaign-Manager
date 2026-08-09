import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { LoadingScreen } from './components/layout/LoadingScreen'
import { PublicOnlyRoute } from './auth/PublicOnlyRoute'
import { AppShell } from './components/shell/AppShell'
import { PublicLayout } from './components/layout/PublicLayout'
import { LandingPage } from './pages/public/LandingPage'
import { LoginPage } from './pages/auth/LoginPage'
import { SignUpPage } from './pages/auth/SignUpPage'
import { DashboardPage } from './pages/app/DashboardPage'
import { NewCampaignPage } from './pages/app/NewCampaignPage'
import { CampaignWorkspaceLayout } from './pages/app/campaign/CampaignWorkspaceLayout'
import { CampaignOverviewPage } from './pages/app/campaign/CampaignOverviewPage'
import { CampaignMembersPage } from './pages/app/campaign/CampaignMembersPage'
import { CampaignSessionsPage } from './pages/app/campaign/CampaignSessionsPage'
import { CampaignCharactersPage } from './pages/app/campaign/CampaignCharactersPage'
import { CampaignLocationsPage } from './pages/app/campaign/CampaignLocationsPage'
import { CampaignQuestsPage } from './pages/app/campaign/CampaignQuestsPage'
import { CampaignNotesPage } from './pages/app/campaign/CampaignNotesPage'
import { CampaignDocumentsPage } from './pages/app/campaign/CampaignDocumentsPage'
import { CampaignMapsPage } from './pages/app/campaign/CampaignMapsPage'
import { SettingsPage } from './pages/app/SettingsPage'
import { NotFoundPage } from './pages/NotFoundPage'

/**
 * TipTap and ProseMirror are most of the application's JavaScript, and only one
 * route uses them. Splitting this chunk out keeps them off every other page.
 */
const CampaignDocumentPage = lazy(() =>
  import('./pages/app/campaign/CampaignDocumentPage').then((module) => ({
    default: module.CampaignDocumentPage,
  })),
)

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

      {/* TEMPORARY: shell preview for visual verification. Remove. */}
      <Route path="/__shell" element={<AppShell />}>
        <Route index element={<DashboardPage />} />
      </Route>

      {/* Authenticated application */}
      <Route path="/app" element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="campaigns" element={<Navigate to="/app" replace />} />
          <Route path="campaigns/new" element={<NewCampaignPage />} />
          {/* Campaign features are child routes here; the layout loads the campaign. */}
          <Route path="campaigns/:campaignId" element={<CampaignWorkspaceLayout />}>
            <Route index element={<CampaignOverviewPage />} />
            <Route path="sessions" element={<CampaignSessionsPage />} />
            <Route path="characters" element={<CampaignCharactersPage />} />
            <Route path="locations" element={<CampaignLocationsPage />} />
            <Route path="quests" element={<CampaignQuestsPage />} />
            <Route path="notes" element={<CampaignNotesPage />} />
            {/* A document is the only section with a page of its own, because
                it is the only one you open rather than read from a list. */}
            <Route path="documents" element={<CampaignDocumentsPage />} />
            <Route
              path="documents/:documentId"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <CampaignDocumentPage />
                </Suspense>
              }
            />
            <Route path="maps" element={<CampaignMapsPage />} />
            <Route path="members" element={<CampaignMembersPage />} />
          </Route>
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
