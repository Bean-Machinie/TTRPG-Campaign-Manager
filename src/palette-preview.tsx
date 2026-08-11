import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { CampaignListContext } from './campaigns/CampaignListContext'
import { CommandPalette } from './components/shell/CommandPalette'
import './styles/theme.css'
import './styles/global.css'

const campaigns: Array<{ id: string; name: string; createdAt: string; lastPlayedOn: null }> = []

declare global {
  interface Window {
    __log: string[]
  }
}
window.__log = []

function Watch() {
  const { pathname } = useLocation()
  window.__log.push(`route:${pathname}`)
  return null
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/app/campaigns/c1']}>
    <Watch />
    <CampaignListContext value={{ campaigns, loading: false, error: null, reload: () => {} }}>
      <CommandPalette
        isOpen
        onOpenChange={(open) => window.__log.push(`open:${open}`)}
        campaignId={null}
        campaignName="Campaign"
      />
    </CampaignListContext>
  </MemoryRouter>,
)
