import { Link, NavLink, useNavigate } from 'react-router'
import { Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { APP_NAME } from '../../constants'
import { useCampaignList } from '../../campaigns/useCampaignList'
import { cn } from '../../lib/cn'
import { IconButton } from '../ui/IconButton'
import { Kbd } from '../ui/Kbd'
import { AccountMenu } from './AccountMenu'
import { NavIcon } from './NavIcon'
import { CampaignTree } from './CampaignTree'
import { SearchIcon } from './icons/SearchIcon'
import type { AnimatedIconHandle } from './icons/types'
import {
  ALL_CAMPAIGNS_ICON,
  cssIcon,
} from './navigation'
import type { SectionIcon } from './navigation'
import { SEARCH_SHORTCUT_LABEL } from './shortcut'
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
 *
 * Search, a nav item and a campaign are one row shape, so they are one set of
 * classes. They had been three near-copies that disagreed about the radius and
 * about which grey an idle icon is — the kind of difference nobody can name and
 * everybody sees. 8px corners, the same as the menu rows the account button
 * opens, and a focus ring, which none of the three had.
 *
 * Four bands, and the rules between them are the panel's only structure: a 64px
 * brand band that lines up exactly with the top bar beside it so the horizon
 * runs unbroken across the application, search, the navigation, and the
 * account. Everything inside them sits on one 12px gutter.
 *
 * Only one of them scrolls. Every fixed point in the panel — the wordmark,
 * search, the two workspace rows, who you are — stays where it was put, and the
 * list of campaigns moves underneath them. A panel where everything scrolls is
 * a panel where nothing is anywhere.
 */

const ROW = cn(
  'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm no-underline',
  'outline-hidden transition-colors duration-150',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600',
)

const ROW_IDLE = cn(
  'font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900',
  'dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-white',
)

/*
 * Idle, hover and current used to be two states wearing three names: the
 * current row and a hovered row were the same grey, so the panel could not
 * answer "where am I" while the pointer was anywhere in it. Current is now a
 * step further up the ramp than hover, a half-step heavier, and carries the
 * rail below — three quiet signals rather than one loud one, which is what
 * keeps it legible in a list of nine without shouting.
 */
const ROW_ACTIVE = cn(
  'font-semibold text-gray-900 bg-gray-100',
  'dark:bg-gray-800 dark:text-white',
)

/* Split from its colour because `cn` concatenates rather than merges — an
   active row's brand tint has to replace the idle grey, not race it. */
const ROW_ICON = 'shrink-0 transition-colors'

const ROW_ICON_IDLE = cn(
  'text-gray-400 group-hover:text-gray-500',
  'dark:text-gray-500 dark:group-hover:text-gray-400',
)

/** The gutter every band shares, so nothing in the column is a pixel out. */
const BAND = 'px-3'

type SidebarProps = {
  /** Opens the command palette. The field below is a trigger, not an input. */
  onSearch: () => void
  /** Called after any navigation, so the mobile drawer can close itself. */
  onNavigate?: () => void
  /**
   * Dismisses the panel. Passed only by the mobile drawer, and the presence of
   * it is what draws the close button — the docked sidebar has nothing to close.
   */
  onClose?: () => void
}

export function Sidebar({ onSearch, onNavigate, onClose }: SidebarProps) {
  const { campaigns, loading: campaignsLoading } = useCampaignList()
  const navigate = useNavigate()
  // The lens should jump when the pointer reaches the field, not when it
  // finally reaches the 16 pixels of magnifier inside it.
  const searchIcon = useRef<AnimatedIconHandle>(null)

  // Whether the campaign list has anything scrolled up under the "Campaigns"
  // label. The label sits in the fixed part of the panel and the list in the
  // scrolling part below it, and with nothing marking the seam a scrolled list
  // reads as flush with its own heading rather than as passing beneath it. A
  // shadow that only appears once there is something to separate from is the
  // cheapest version of that: at the top of the list there is nothing under the
  // label to hide, so there is nothing to cast one.
  const [listScrolled, setListScrolled] = useState(false)

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-gray-900">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-1 border-b border-gray-200 dark:border-gray-800',
          BAND,
        )}
      >
        <Link
          to="/app"
          onClick={onNavigate}
          className={cn(
            // px-3, like every row below it, keeps the wordmark on the shared
            // left gutter without needing a decorative logo tile.
            'flex min-w-0 flex-1 items-center rounded-md px-3 py-1.5 no-underline',
            'outline-hidden transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60',
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600',
          )}
        >
          <span className="truncate text-base font-semibold tracking-tight text-gray-900 dark:text-white">
            {APP_NAME}
          </span>
        </Link>

        {/* Full size, not the dense one: this only ever appears in the drawer,
            and the drawer is only ever driven by a thumb. */}
        {onClose ? (
          <IconButton onClick={onClose} aria-label="Close navigation">
            <X className="size-5" aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>

      {/*
        A button, not a field dressed up as one: it opens a palette rather
        than accepting text itself, and looking like an input it can't act
        like was the part of the old design worth dropping. Same row
        treatment as everything below it in the nav, so it reads as one more
        thing you can do rather than as a second kind of control — set apart
        from navigation by twelve pixels of air rather than by a rule, because
        it is one item and a rule around one item is a box.
      */}
      <div
        className={cn(
          'shrink-0 border-b border-gray-200 pt-3 pb-3 dark:border-gray-800',
          BAND,
        )}
      >
        <button
          type="button"
          onClick={onSearch}
          onMouseEnter={() => searchIcon.current?.startAnimation()}
          onMouseLeave={() => searchIcon.current?.stopAnimation()}
          onFocus={() => searchIcon.current?.startAnimation()}
          onBlur={() => searchIcon.current?.stopAnimation()}
          className={cn(ROW, 'group w-full cursor-pointer', ROW_IDLE)}
        >
          <SearchIcon ref={searchIcon} size={20} className={cn(ROW_ICON, ROW_ICON_IDLE)} />
          <span className="flex-1 text-left">Search</span>
          <Kbd>{SEARCH_SHORTCUT_LABEL}</Kbd>
        </button>
      </div>

      {/*
        One nav, three parts, and only the last of them moves.

        The two workspace rows are fixed points — they are the same two rows in
        every campaign and on every route — so scrolling them away with a long
        list of campaigns took the panel's only constants out of reach exactly
        when the list was long enough to need them. They are pinned, and so is
        the word Campaigns, which is what the moving list underneath it is.

        They also lost their own heading. "Workspace" over two permanent rows
        was a label naming a category nobody navigates by; "Campaigns" stays
        because it names the boundary between the fixed part and the scrolling
        one, which is now a thing the reader can see happen.
      */}
      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            'flex shrink-0 flex-col gap-0.5 border-b border-gray-200 py-3 dark:border-gray-800',
            BAND,
          )}
        >
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
        </div>

        {/*
          `relative` plus the shadow element below it: the shadow is drawn
          under this band rather than as a CSS `box-shadow` on it, because a
          shadow on the band itself is clipped by nothing and would show
          through the band's own background on the side facing the list. Drawn
          as its own layer, it can sit right on the seam and fade into
          whatever is scrolling underneath.
        */}
        <div className={cn('relative shrink-0 pt-3', BAND)}>
          <p className="m-0 truncate px-3 pt-0.5 pb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            Campaigns
          </p>
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-x-0 top-full h-3 transition-opacity duration-150',
              'bg-gradient-to-b from-gray-900/10 to-transparent dark:from-black/30',
              listScrolled ? 'opacity-100' : 'opacity-0',
            )}
          />
        </div>

        {/* `min-h-0` is what lets this actually scroll rather than push the
            account band off the bottom of a short window. The gutter is padding
            on the scroller itself, so the scrollbar rides the panel's edge
            instead of floating twelve pixels inside it. */}
        <div
          onScroll={(event) => setListScrolled(event.currentTarget.scrollTop > 0)}
          className={cn(
            'min-h-0 flex-1 overflow-y-auto pb-4',
            '[scrollbar-color:var(--color-gray-300)_transparent] [scrollbar-width:thin]',
            'dark:[scrollbar-color:var(--color-gray-700)_transparent]',
            BAND,
          )}
        >
          <CampaignTree
            campaigns={campaigns}
            loading={campaignsLoading}
            onNavigate={(to) => {
              navigate(to)
              onNavigate?.()
            }}
          />
        </div>
      </nav>

      {/* Two, not three: the row inside is a nav row's height now, and the band
          should sit around it the way the search band sits around its own. */}
      <div
        className={cn(
          'mt-auto shrink-0 border-t border-gray-200 py-2 dark:border-gray-800',
          BAND,
        )}
      >
        <AccountMenu onNavigate={onNavigate} />
      </div>
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
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
      // Keyboard users get the same thing, on the same element, for free.
      onFocus={() => iconRef.current?.startAnimation()}
      onBlur={() => iconRef.current?.stopAnimation()}
      className={({ isActive }) => cn('icon-host group', ROW, isActive ? ROW_ACTIVE : ROW_IDLE)}
    >
      {({ isActive }) => (
        <>
          {isActive ? <ActiveRail /> : null}
          <NavIcon
            icon={icon}
            ref={iconRef}
            className={cn(
              ROW_ICON,
              isActive ? 'text-brand-600 dark:text-brand-400' : ROW_ICON_IDLE,
            )}
          />
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

/**
 * The mark on the current row.
 *
 * Absolutely positioned, so arriving and leaving move nothing: a rail that took
 * layout would shunt nine labels sideways every time you navigated. Three
 * pixels wide and sixteen tall, which is short enough to sit inside the row's
 * straight left edge rather than crossing its rounded corners.
 */
function ActiveRail() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600 dark:bg-brand-400"
    />
  )
}

/** The campaigns themselves, listed where the sections would be. */
