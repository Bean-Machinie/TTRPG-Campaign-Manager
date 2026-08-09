import { Breadcrumb, Breadcrumbs } from 'react-aria-components'
import { Link, useLocation } from 'react-router'
import { ChevronRight, Dices, Menu, Search } from 'lucide-react'
import { APP_NAME } from '../../constants'
import { useCampaignList } from '../../campaigns/useCampaignList'
import { CAMPAIGN_SECTIONS, sectionHref } from './navigation'
import './icons.css'

/**
 * The bar above the content.
 *
 * Two different jobs at two sizes, which is why it looks like two components.
 * Below `lg` the sidebar is a drawer, so this is the only way to reach
 * navigation or search and it carries the buttons for both. From `lg` up the
 * sidebar is always on screen, so all that is left worth saying is where in it
 * you are — the trail, and nothing else. Page titles and page actions belong to
 * the pages, and they already have them.
 */

type TopBarProps = {
  onMenu: () => void
  onSearch: () => void
}

export function TopBar({ onMenu, onSearch }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:px-8">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
        className="icon-host grid size-10 shrink-0 place-items-center rounded-md text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 lg:hidden"
      >
        <Menu className="ui-icon size-5" data-motion="lift" aria-hidden="true" />
      </button>

      <Link to="/app" className="flex items-center gap-2 no-underline lg:hidden">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
          <Dices className="size-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-gray-900">{APP_NAME}</span>
      </Link>

      <Trail />

      <button
        type="button"
        onClick={onSearch}
        aria-label="Search"
        className="icon-host ml-auto grid size-10 shrink-0 place-items-center rounded-md text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 lg:hidden"
      >
        <Search className="ui-icon size-5" data-motion="pulse" aria-hidden="true" />
      </button>
    </header>
  )
}

function Trail() {
  const crumbs = useTrail()

  return (
    <Breadcrumbs className="hidden min-w-0 items-center lg:flex">
      {crumbs.map((crumb, index) => (
        <Breadcrumb key={crumb.to ?? crumb.label} className="flex min-w-0 items-center">
          {index > 0 ? (
            <ChevronRight className="mx-1 size-4 shrink-0 text-gray-300" aria-hidden="true" />
          ) : null}

          {crumb.to && index < crumbs.length - 1 ? (
            <Link
              to={crumb.to}
              className="truncate rounded px-1.5 py-1 text-sm font-medium text-gray-500 no-underline transition-colors hover:bg-gray-50 hover:text-gray-700"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="truncate px-1.5 py-1 text-sm font-semibold text-gray-700" aria-current="page">
              {crumb.label}
            </span>
          )}
        </Breadcrumb>
      ))}
    </Breadcrumbs>
  )
}

type Crumb = { label: string; to?: string }

/**
 * The trail, read off the URL.
 *
 * Deriving it from the path rather than having each page declare its own is
 * what keeps it honest: there is no page that can forget to say where it is.
 * The one thing the URL cannot supply is a document's title — that is the
 * document page's own heading, and repeating it here would say it twice.
 */
function useTrail(): Crumb[] {
  const { pathname } = useLocation()
  const { campaigns } = useCampaignList()

  const segments = pathname.split('/').filter(Boolean).slice(1)
  const crumbs: Crumb[] = [{ label: 'Campaigns', to: '/app' }]

  if (segments[0] === 'settings') {
    crumbs.push({ label: 'Settings' })
    return crumbs
  }

  if (segments[0] !== 'campaigns' || segments.length < 2) return crumbs

  if (segments[1] === 'new') {
    crumbs.push({ label: 'New campaign' })
    return crumbs
  }

  const campaignId = segments[1]
  const campaign = campaigns.find((entry) => entry.id === campaignId)
  crumbs.push({ label: campaign?.name ?? 'Campaign', to: `/app/campaigns/${campaignId}` })

  const section = CAMPAIGN_SECTIONS.find((entry) => entry.path && entry.path === segments[2])
  if (section) crumbs.push({ label: section.label, to: sectionHref(campaignId, section.path) })

  return crumbs
}
