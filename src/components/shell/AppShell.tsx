import { useEffect, useState } from 'react'
import { Dialog, Modal, ModalOverlay } from 'react-aria-components'
import { Outlet, useLocation } from 'react-router'
import { CampaignListContext } from '../../campaigns/CampaignListContext'
import { useCampaigns } from '../../campaigns/hooks'
import { CommandPalette } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { isSearchShortcut } from './shortcut'
import { useActiveCampaignId } from './useActiveCampaignId'
import './AppShell.css'

/**
 * The application shell.
 *
 * One screen-height row: navigation on the left, everything else on the right.
 * The page scrolls inside the content column rather than the window, which is
 * what keeps the sidebar and the trail put while a long document moves under
 * them — the sidebar is the product's map, and a map that scrolls away is a
 * list.
 *
 * Below `lg` the same sidebar becomes a drawer. It is the same component, not a
 * second cut-down one: two navigations always drift.
 */
export function AppShell() {
  // Loaded here, at the top of everything signed in, so the switcher, the
  // palette and the dashboard share one request and one answer.
  const campaignList = useCampaigns()

  return (
    <CampaignListContext value={campaignList}>
      <Shell />
    </CampaignListContext>
  )
}

function Shell() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { pathname } = useLocation()
  const campaignId = useActiveCampaignId()

  // Following a link inside the drawer should leave you looking at where you
  // went, not at the drawer you went there from.
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isSearchShortcut(event)) return
      // Chrome and Firefox both bind this to their own search bar.
      event.preventDefault()
      setSearchOpen((open) => !open)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function openSearch() {
    setDrawerOpen(false)
    setSearchOpen(true)
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-gray-50 dark:bg-gray-950">
      <aside className="hidden w-sidebar shrink-0 border-r border-gray-200 lg:block dark:border-gray-800">
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setDrawerOpen(true)} onSearch={openSearch} />

        <main className="app-workspace flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <ModalOverlay
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        isDismissable
        className="fixed inset-0 z-40 flex bg-gray-950/40 lg:hidden"
      >
        <Modal className="h-full w-sidebar max-w-[85vw] border-r border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <Dialog aria-label="Navigation" className="h-full outline-hidden">
            <Sidebar
              onNavigate={() => setDrawerOpen(false)}
              onClose={() => setDrawerOpen(false)}
            />
          </Dialog>
        </Modal>
      </ModalOverlay>

      <CommandPalette isOpen={searchOpen} onOpenChange={setSearchOpen} campaignId={campaignId} />
    </div>
  )
}
