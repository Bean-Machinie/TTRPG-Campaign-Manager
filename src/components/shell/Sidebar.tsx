import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components'
import { Link, NavLink, useNavigate } from 'react-router'
import { Dices, EllipsisVertical, LogOut, Plus, Settings } from 'lucide-react'
import { useRef } from 'react'
import type { Key, ReactNode } from 'react'
import { APP_NAME } from '../../constants'
import { useAuth } from '../../auth/useAuth'
import { useCampaignList } from '../../campaigns/useCampaignList'
import { useMyProfile } from '../../profile/hooks'
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
 *   settings ─── who you are signed in as
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
    <div className="flex h-full w-full flex-col bg-white">
      <div className="flex flex-col gap-4 px-4 pt-5">
        <Link
          to="/app"
          onClick={onNavigate}
          className="icon-host flex items-center gap-2.5 rounded-md px-1 py-0.5 no-underline"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-600 text-white shadow-xs">
            <Dices className="ui-icon size-5" data-motion="spin" aria-hidden="true" />
          </span>
          <span className="truncate text-base font-semibold tracking-tight text-gray-900">
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
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <SearchIcon ref={searchIcon} size={20} className="shrink-0 text-gray-400" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-px font-sans text-xs text-gray-500">
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

      <div className="mt-auto flex flex-col gap-1 border-t border-gray-200 px-4 py-4">
        <NavItem
          to="/app/settings"
          icon={cssIcon(Settings, 'spin')}
          label="Settings"
          onNavigate={onNavigate}
        />
        <AccountCard />
      </div>
    </div>
  )
}

function NavGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <p className="truncate px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
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
          isActive ? 'bg-gray-50 text-gray-900' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <NavIcon
            icon={icon}
            ref={iconRef}
            className={isActive ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-500'}
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
            <span className="size-6 animate-pulse rounded-md bg-gray-100" />
            <span className="h-2.5 flex-1 animate-pulse rounded-full bg-gray-100" />
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
          className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-700 no-underline transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <Avatar initials={initialsOf(campaign.name)} />
          <span className="truncate">{campaign.name}</span>
        </NavLink>
      ))}
    </NavGroup>
  )
}

function Avatar({ initials, size = 'sm' }: { initials: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={[
        'grid shrink-0 place-items-center rounded-md bg-brand-50 font-semibold text-brand-700',
        size === 'sm' ? 'size-6 text-[0.625rem]' : 'size-9 rounded-lg text-xs',
      ].join(' ')}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}

/** Who you are signed in as, and the way out. */
function AccountCard() {
  const { user, signOut } = useAuth()
  const { profile } = useMyProfile(user?.id)
  const navigate = useNavigate()

  const email = user?.email ?? ''
  const name = profile?.displayName?.trim() || email.split('@')[0] || 'Signed in'

  async function handleAction(key: Key) {
    if (key === 'settings') {
      navigate('/app/settings')
      return
    }

    await signOut()
    navigate('/')
  }

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      <Avatar initials={initialsOf(name)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-900">{name}</span>
        <span className="block truncate text-xs text-gray-500">{email}</span>
      </span>

      <MenuTrigger>
        <Button
          aria-label="Account menu"
          className="icon-host grid size-8 shrink-0 place-items-center rounded-md text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
        >
          <EllipsisVertical className="ui-icon size-4" data-motion="pulse" aria-hidden="true" />
        </Button>

        <Popover
          placement="top end"
          offset={6}
          className="w-52 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
        >
          <Menu onAction={handleAction} className="outline-hidden">
            <MenuItem
              id="settings"
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-gray-700 outline-hidden focus:bg-gray-50"
            >
              <Settings className="size-4 text-gray-400" aria-hidden="true" />
              Settings
            </MenuItem>
            <MenuItem
              id="sign-out"
              className="icon-host flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-gray-700 outline-hidden focus:bg-gray-50"
            >
              <LogOut className="ui-icon size-4 text-gray-400" data-motion="slide" aria-hidden="true" />
              Sign out
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </div>
  )
}
