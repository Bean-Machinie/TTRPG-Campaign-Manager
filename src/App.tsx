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
import { CampaignEntitiesPage } from './pages/app/campaign/CampaignEntitiesPage'
import { NewCharacterPage } from './pages/app/campaign/character/NewCharacterPage'
import { CharacterWizardPage } from './pages/app/campaign/character/CharacterWizardPage'
import { QuickCreatePage } from './pages/app/campaign/character/QuickCreatePage'
import { CharacterDetailPage } from './pages/app/campaign/character/CharacterDetailPage'
import { SheetSection } from './pages/app/campaign/character/sections/SheetSection'
import { FeaturesSection } from './pages/app/campaign/character/sections/FeaturesSection'
import { DescriptionSection } from './pages/app/campaign/character/sections/DescriptionSection'
import { NotesSection } from './pages/app/campaign/character/sections/NotesSection'
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
            {/* Characters, NPCs and creatures are one entity feature; the old
                /characters path is kept as a redirect so links still resolve. */}
            <Route path="characters" element={<Navigate to="../entities" replace />} />
            <Route path="entities" element={<CampaignEntitiesPage />} />

            {/*
              Creation is a sequence and editing is random access, so they are
              different routes rather than one page doing both.

              The wizard's step is a URL segment, which is what gives it a back
              button, deep links and survival across a refresh. It is one route
              and not seven: the step list lives in entities/wizard/steps.ts,
              where the guard and the progress rail also read it, and a second
              copy here would be a list that could disagree with the one
              enforcing it. `new/:draftId/quick` is matched before it because a
              static segment outranks a dynamic one.
            */}
            <Route path="entities/new" element={<NewCharacterPage />} />
            <Route path="entities/new/:draftId/quick" element={<QuickCreatePage />} />
            <Route path="entities/new/:draftId/:step" element={<CharacterWizardPage />} />

            <Route path="entities/:entityId" element={<CharacterDetailPage />}>
              <Route index element={<Navigate to="sheet" replace />} />
              <Route path="sheet" element={<SheetSection />} />
              <Route path="features" element={<FeaturesSection />} />
              <Route path="description" element={<DescriptionSection />} />
              <Route path="notes" element={<NotesSection />} />
              {/* The old edit route, kept so existing links still resolve. */}
              <Route path="edit" element={<Navigate to="../sheet" replace />} />
            </Route>
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
          <Route path="profile" element={<SettingsPage />} />
          <Route path="settings" element={<Navigate to="/app/profile" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
