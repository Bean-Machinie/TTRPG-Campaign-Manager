import { useMemo, useRef } from 'react'
import { Breadcrumb, Breadcrumbs } from 'react-aria-components'
import { Link, useLocation } from 'react-router'
import { ChevronRight, Dices, Menu } from 'lucide-react'
import { APP_NAME } from '../../constants'
import { useCampaignContents } from './commands'
import { useCampaignList } from '../../campaigns/useCampaignList'
import { IconButton } from '../ui/IconButton'
import { SearchIcon } from './icons/SearchIcon'
import type { AnimatedIconHandle } from './icons/types'
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
  const searchIcon = useRef<AnimatedIconHandle>(null)

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:px-8 dark:border-gray-800 dark:bg-gray-900">
      <IconButton onClick={onMenu} aria-label="Open navigation" className="lg:hidden">
        <Menu className="ui-icon size-5" data-motion="lift" aria-hidden="true" />
      </IconButton>

      <Link to="/app" className="flex items-center gap-2 no-underline lg:hidden">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
          <Dices className="size-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{APP_NAME}</span>
      </Link>

      <Trail />

      <IconButton
        onClick={onSearch}
        aria-label="Search"
        onMouseEnter={() => searchIcon.current?.startAnimation()}
        onMouseLeave={() => searchIcon.current?.stopAnimation()}
        className="ml-auto lg:hidden"
      >
        <SearchIcon ref={searchIcon} size={20} />
      </IconButton>
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
            <ChevronRight className="mx-1 size-4 shrink-0 text-gray-300 dark:text-gray-700" aria-hidden="true" />
          ) : null}

          {crumb.to && index < crumbs.length - 1 ? (
            <Link
              to={crumb.to}
              className="truncate rounded-md px-1.5 py-1 text-sm font-medium text-gray-500 no-underline outline-hidden transition-colors hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
            >
              {crumb.label}
            </Link>
          ) : (
            <span
              className="truncate px-1.5 py-1 text-sm font-semibold text-gray-700 dark:text-gray-200"
              aria-current="page"
            >
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
 * Record names are resolved from the campaign-content cache when the route is
 * inside a character. The URL only has an id, and putting that id in the trail
 * would be technically accurate but useless to the person navigating it.
 */
function useTrail(): Crumb[] {
  const { pathname } = useLocation()
  const { campaigns } = useCampaignList()

  const segments = pathname.split('/').filter(Boolean).slice(1)
  const crumbs: Crumb[] = [{ label: 'Campaigns', to: '/app' }]
  const campaignId = segments[0] === 'campaigns' ? segments[1] : undefined
  const campaign = campaigns.find((entry) => entry.id === campaignId)
  const characterId =
    segments[2] === 'entities' && segments[3] && segments[3] !== 'new'
      ? segments[3]
      : undefined
  const campaignsToLoad = useMemo(
    () => (campaign && characterId ? [campaign] : []),
    [campaign, characterId],
  )
  const { byCampaign } = useCampaignContents(campaignsToLoad)

  if (segments[0] === 'settings') {
    crumbs.push({ label: 'Settings' })
    return crumbs
  }

  if (segments[0] !== 'campaigns' || segments.length < 2) return crumbs

  if (segments[1] === 'new') {
    crumbs.push({ label: 'New campaign' })
    return crumbs
  }

  if (!campaignId) return crumbs
  crumbs.push({ label: campaign?.name ?? 'Campaign', to: `/app/campaigns/${campaignId}` })

  const section = CAMPAIGN_SECTIONS.find((entry) => entry.path && entry.path === segments[2])
  if (section) crumbs.push({ label: section.label, to: sectionHref(campaignId, section.path) })

  if (characterId) {
    const character = byCampaign[campaignId]?.find(
      (entry) => entry.id === `entities:${characterId}`,
    )
    crumbs.push({ label: character?.label ?? 'Character' })
  }

  return crumbs
}
