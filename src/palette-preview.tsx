import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { AuthContext } from './auth/AuthContext'
import { CampaignListContext } from './campaigns/CampaignListContext'
import { Sidebar } from './components/shell/Sidebar'
import './styles/theme.css'
import './styles/global.css'

const auth = {
  session: null,
  user: { id: 'u1', email: 'test@example.com' } as never,
  loading: false,
  isConfigured: true,
  signIn: async () => {},
  signUp: async () => ({ needsEmailConfirmation: false }),
  signOut: async () => {},
}

const campaigns = [{ id: 'c1', name: 'Curse of Strahd', createdAt: '2026-01-01', lastPlayedOn: null }]

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/app/campaigns/c1']}>
    <AuthContext value={auth}>
      <CampaignListContext value={{ campaigns, loading: false, error: null, reload: () => {} }}>
        <div style={{ width: 288, height: 500 }}>
          <Sidebar onSearch={() => {}} />
        </div>
      </CampaignListContext>
    </AuthContext>
  </MemoryRouter>,
)
