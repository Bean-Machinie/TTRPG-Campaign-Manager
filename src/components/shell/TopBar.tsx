import { Fragment, useMemo, useRef } from 'react'
import {
  Button as AriaButton,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger,
  Popover,
} from 'react-aria-components'
import { Link, useLocation, useNavigate } from 'react-router'
import { Dices, Menu, Plus } from 'lucide-react'
import { APP_NAME } from '../../constants'
import { cn } from '../../lib/cn'
import { useCampaignContents } from './commands'
import { useCampaignList } from '../../campaigns/useCampaignList'
import { IconButton } from '../ui/IconButton'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/Breadcrumb'
import { Kbd } from '../ui/Kbd'
import { Separator } from '../ui/Separator'
import { menuItem, menuPanel } from '../ui/menuStyles'
import { BellIcon } from './icons/BellIcon'
import type { BellIconHandle } from './icons/BellIcon'
import { SearchIcon } from './icons/SearchIcon'
import type { AnimatedIconHandle } from './icons/types'
import { CAMPAIGN_SECTIONS, sectionHref } from './navigation'
import { SEARCH_SHORTCUT_LABEL } from './shortcut'
import './icons.css'

/**
 * The bar above the content.
 *
 * Two different jobs at two sizes, which is why it looks like two components.
 * Below `lg` the sidebar is a drawer, so this also carries the menu and compact
 * product mark. At every size the right edge owns global actions — search,
 * campaign creation and notifications — while the desktop trail fills the
 * space between navigation and those fixed controls.
 */

type TopBarProps = {
  onMenu: () => void
  onSearch: () => void
}

export function TopBar({ onMenu, onSearch }: TopBarProps) {
  const searchIcon = useRef<AnimatedIconHandle>(null)
  const bellIcon = useRef<BellIconHandle>(null)

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

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onSearch}
          onMouseEnter={() => searchIcon.current?.startAnimation()}
          onMouseLeave={() => searchIcon.current?.stopAnimation()}
          onFocus={() => searchIcon.current?.startAnimation()}
          onBlur={() => searchIcon.current?.stopAnimation()}
          className={cn(
            'group inline-flex h-10 cursor-pointer items-center gap-2 rounded-md px-2.5',
            'text-sm font-medium text-gray-600 outline-hidden transition-colors',
            'hover:bg-gray-100 hover:text-gray-900',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            'dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white',
          )}
          aria-label="Search"
        >
          <SearchIcon ref={searchIcon} size={19} />
          <span className="hidden md:inline">Search</span>
          <Kbd className="hidden xl:inline-flex">{SEARCH_SHORTCUT_LABEL}</Kbd>
        </button>

        <Link
          to="/app/campaigns/new"
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-3 text-sm font-semibold text-white no-underline shadow-xs',
            'transition-colors hover:bg-brand-700 hover:text-white',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          )}
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden md:inline">New campaign</span>
        </Link>

        <Separator orientation="vertical" className="mx-1" />

        <IconButton
          onMouseEnter={() => bellIcon.current?.startAnimation()}
          onMouseLeave={() => bellIcon.current?.stopAnimation()}
          onFocus={() => bellIcon.current?.startAnimation()}
          onBlur={() => bellIcon.current?.stopAnimation()}
          aria-label="Notifications — none"
          title="No new notifications"
        >
          <BellIcon ref={bellIcon} size={20} />
        </IconButton>
      </div>
    </header>
  )
}

function Trail() {
  const crumbs = useTrail()
  const navigate = useNavigate()
  const collapsedCrumbs = crumbs.length > 3 ? crumbs.slice(1, -2) : []
  const visibleCrumbs = collapsedCrumbs.length > 0 ? [crumbs[0], ...crumbs.slice(-2)] : crumbs

  return (
    <Breadcrumb className="hidden min-w-0 lg:block">
      <BreadcrumbList>
        {visibleCrumbs.map((crumb, index) => {
          const isCurrent = index === visibleCrumbs.length - 1

          return (
            <Fragment key={crumb.to ?? crumb.label}>
              {index > 0 ? <BreadcrumbSeparator /> : null}

              {index === 1 && collapsedCrumbs.length > 0 ? (
                <>
                  <BreadcrumbItem>
                    <MenuTrigger>
                      <AriaButton
                        aria-label="Show hidden breadcrumb levels"
                        className={cn(
                          'grid size-8 shrink-0 cursor-pointer place-items-center rounded-md outline-hidden',
                          'text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                          'data-[pressed]:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200',
                        )}
                      >
                        <BreadcrumbEllipsis />
                      </AriaButton>
                      <Popover placement="bottom start" offset={6} className="z-50 outline-hidden">
                        <AriaMenu
                          aria-label="Hidden breadcrumb levels"
                          className={cn(menuPanel, 'min-w-44 outline-hidden')}
                          onAction={(key) => {
                            const hiddenCrumb = collapsedCrumbs[Number(key)]
                            if (hiddenCrumb?.to) navigate(hiddenCrumb.to)
                          }}
                        >
                          {collapsedCrumbs.map((hiddenCrumb, hiddenIndex) => (
                            <AriaMenuItem
                              key={hiddenCrumb.to ?? hiddenCrumb.label}
                              id={String(hiddenIndex)}
                              textValue={hiddenCrumb.label}
                              className={menuItem()}
                            >
                              {hiddenCrumb.label}
                            </AriaMenuItem>
                          ))}
                        </AriaMenu>
                      </Popover>
                    </MenuTrigger>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              ) : null}

              <BreadcrumbItem className={isCurrent ? 'min-w-0' : 'shrink-0'}>
                {crumb.to && !isCurrent ? (
                  <BreadcrumbLink to={crumb.to}>{crumb.label}</BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
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

  if (segments[0] === 'profile') {
    crumbs.push({ label: 'Profile' })
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
