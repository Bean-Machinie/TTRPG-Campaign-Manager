import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router'
import { CampaignListContext } from './campaigns/CampaignListContext'
import { CommandPalette } from './components/shell/CommandPalette'
import './styles/theme.css'
import './styles/global.css'

/**
 * Two, not none: an empty list only ever exercises the empty state, and the
 * palette's resting view is the campaign tree. Contents stay empty here —
 * there is no Supabase behind this harness — so what this shows is the tree's
 * chrome, which is exactly what it is for.
 */
const campaigns: Array<{ id: string; name: string; createdAt: string; lastPlayedOn: null }> = [
  { id: 'c1', name: 'Curse of Strahd', createdAt: '2026-01-01', lastPlayedOn: null },
  { id: 'c2', name: 'Bean test', createdAt: '2026-01-02', lastPlayedOn: null },
]

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
        campaignId="c2"
      />
    </CampaignListContext>
  </MemoryRouter>,
)
