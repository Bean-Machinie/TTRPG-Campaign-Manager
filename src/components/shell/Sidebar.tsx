import { Link, NavLink } from 'react-router'
import { Dices, Plus } from 'lucide-react'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { APP_NAME } from '../../constants'
import { useCampaignList } from '../../campaigns/useCampaignList'
import { AccountMenu } from './AccountMenu'
import { Avatar } from './Avatar'
import { NavIcon } from './NavIcon'
import { SearchIcon } from './icons/SearchIcon'
import type { AnimatedIconHandle } from './icons/types'
import {
  ALL_CAMPAIGNS_ICON,
  CAMPAIGN_SECTIONS,
  cssIcon,
  initialsOf,
  sectionHref,
} from './navigation'
import type { SectionIcon } from './navigation'
import { SEARCH_SHORTCUT_LABEL } from './shortcut'
import { useActiveCampaignId } from './useActiveCampaignId'
import './icons.css'

/**
 * The left panel: everything the product can do, in one column.
 *
 * The arrangement is Untitled UI's application shell, and each part of it earns
 * its place from the route table rather than from the reference design:
 *
 *   brand ─── search
 *   the campaign you are in, section by section
 *   who you are signed in as, opening onto profile, settings, theme and sign out
 *
 * What is deliberately *not* here: no notifications, no usage meter, no upgrade
 * card, no support link. Those are in the reference dashboards because those
 * dashboards are for products that have them. An item in this list is an item
 * that navigates somewhere real.
 */

type SidebarProps = {
  /** Opens the command palette. The field below is a trigger, not an input. */
  onSearch: () => void
  /** Called after any navigation, so the mobile drawer can close itself. */
  onNavigate?: () => void
}

export function Sidebar({ onSearch, onNavigate }: SidebarProps) {
  const { campaigns } = useCampaignList()
  const activeCampaignId = useActiveCampaignId()
  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId)
  // The lens should jump when the pointer reaches the field, not when it
  // finally reaches the 16 pixels of magnifier inside it.
  const searchIcon = useRef<AnimatedIconHandle>(null)

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-gray-900">
      <div className="flex flex-col gap-4 px-4 pt-5">
        <Link
          to="/app"
          onClick={onNavigate}
          className="icon-host flex items-center gap-2.5 rounded-md px-1 py-0.5 no-underline"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-600 text-white shadow-xs">
            <Dices className="ui-icon size-5" data-motion="spin" aria-hidden="true" />
          </span>
          <span className="truncate text-base font-semibold tracking-tight text-gray-900 dark:text-white">
            {APP_NAME}
          </span>
        </Link>

        {/*
          A button, not a field dressed up as one: it opens a palette rather
          than accepting text itself, and looking like an input it can't act
          like was the part of the old design worth dropping. Same row
          treatment as everything below it in the nav, so it reads as one more
          thing you can do rather than as a second kind of control.
        */}
        <button
          type="button"
          onClick={onSearch}
          onMouseEnter={() => searchIcon.current?.startAnimation()}
          onMouseLeave={() => searchIcon.current?.stopAnimation()}
          onFocus={() => searchIcon.current?.startAnimation()}
          onBlur={() => searchIcon.current?.stopAnimation()}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-gray-100"
        >
          <SearchIcon ref={searchIcon} size={20} className="shrink-0 text-gray-400 dark:text-gray-500" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-px font-sans text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            {SEARCH_SHORTCUT_LABEL}
          </kbd>
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5" aria-label="Main">
        <NavGroup>
          <NavItem
            to="/app"
            end
            icon={ALL_CAMPAIGNS_ICON}
            label="All campaigns"
            onNavigate={onNavigate}
          />
          <NavItem
            to="/app/campaigns/new"
            icon={cssIcon(Plus, 'spin')}
            label="New campaign"
            onNavigate={onNavigate}
          />
        </NavGroup>

        {activeCampaignId ? (
          <NavGroup label={activeCampaign?.name ?? 'Campaign'}>
            {CAMPAIGN_SECTIONS.map((section) => (
              <NavItem
                key={section.path}
                to={sectionHref(activeCampaignId, section.path)}
                // Only the overview matches exactly; every other section owns
                // its subtree, so a document stays under Documents.
                end={section.path === ''}
                icon={section.icon}
                label={section.label}
                onNavigate={onNavigate}
              />
            ))}
          </NavGroup>
        ) : (
          <RecentCampaigns onNavigate={onNavigate} />
        )}
      </nav>

      <div className="mt-auto border-t border-gray-200 px-4 py-4 dark:border-gray-800">
        <AccountMenu onNavigate={onNavigate} />
      </div>
    </div>
  )
}

function NavGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <p className="truncate px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {label}
        </p>
      ) : null}
      {children}
    </div>
  )
}

type NavItemProps = {
  to: string
  end?: boolean
  icon: SectionIcon
  label: string
  onNavigate?: () => void
}

/**
 * A row in the sidebar, and the thing that decides when its icon moves.
 *
 * The row is the hover target, not the glyph. Aiming at a 20px picture to see
 * it move is a game; crossing the row you were already reading is not. The
 * Motion icons are told directly through the handle, and the CSS ones respond
 * to `.icon-host:hover` on this same element — one gesture, two mechanisms.
 */
function NavItem({ to, end, icon, label, onNavigate }: NavItemProps) {
  const iconRef = useRef<AnimatedIconHandle>(null)

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      onMouseEnter={(event) => {
        ;(event.currentTarget as HTMLElement).dataset.probe = String(!!iconRef.current)
        iconRef.current?.startAnimation()
      }}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
      // Keyboard users get the same thing, on the same element, for free.
      onFocus={() => iconRef.current?.startAnimation()}
      onBlur={() => iconRef.current?.stopAnimation()}
      className={({ isActive }) =>
        [
          'icon-host group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium no-underline transition-colors',
          isActive
            ? 'bg-gray-50 text-gray-900 dark:bg-gray-800/60 dark:text-white'
            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-white',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <NavIcon
            icon={icon}
            ref={iconRef}
            className={
              isActive
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400'
            }
          />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

/** The campaigns themselves, listed where the sections would be. */
function RecentCampaigns({ onNavigate }: { onNavigate?: () => void }) {
  const { campaigns, loading } = useCampaignList()

  if (loading && campaigns.length === 0) {
    return (
      <NavGroup label="Campaigns">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3 px-3 py-2">
            <span className="size-6 animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
            <span className="h-2.5 flex-1 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
          </div>
        ))}
      </NavGroup>
    )
  }

  if (campaigns.length === 0) return null

  return (
    <NavGroup label="Campaigns">
      {campaigns.map((campaign) => (
        <NavLink
          key={campaign.id}
          to={`/app/campaigns/${campaign.id}`}
          onClick={onNavigate}
          className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 no-underline transition-colors hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-white"
        >
          <Avatar initials={initialsOf(campaign.name)} />
          <span className="truncate">{campaign.name}</span>
        </NavLink>
      ))}
    </NavGroup>
  )
}
