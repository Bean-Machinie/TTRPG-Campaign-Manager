import { Link, useNavigate } from 'react-router'
import { X } from 'lucide-react'
import { APP_NAME } from '../../constants'
import { useCampaignList } from '../../campaigns/useCampaignList'
import { cn } from '../../lib/cn'
import { IconButton } from '../ui/IconButton'
import { AccountMenu } from './AccountMenu'
import { CampaignTree } from './CampaignTree'
import { CampaignSwitcher } from './CampaignSwitcher'
import { useActiveCampaignId } from './useActiveCampaignId'

/**
 * The left panel: everything the product can do, in one column.
 *
 * The arrangement is Untitled UI's application shell, and each part of it earns
 * its place from the route table rather than from the reference design:
 *
 *   brand
 *   campaign switcher
 *   the active campaign, section by section
 *   who you are signed in as, opening onto profile, settings, theme and sign out
 *
 * The campaign switcher owns cross-campaign navigation. That leaves the tree
 * beneath it focused on one campaign instead of repeating every campaign in
 * both a switcher and a nested list.
 *
 * Only one of them scrolls. Every fixed point in the panel — the wordmark,
 * switcher and account — stays where it was put, and the campaign sections move
 * underneath them. A panel where everything scrolls is
 * a panel where nothing is anywhere.
 */

/** The gutter every band shares, so nothing in the column is a pixel out. */
const BAND = 'px-3'

type SidebarProps = {
  /** Called after any navigation, so the mobile drawer can close itself. */
  onNavigate?: () => void
  /**
   * Dismisses the panel. Passed only by the mobile drawer, and the presence of
   * it is what draws the close button — the docked sidebar has nothing to close.
   */
  onClose?: () => void
}

export function Sidebar({ onNavigate, onClose }: SidebarProps) {
  const { campaigns, loading: campaignsLoading } = useCampaignList()
  const navigate = useNavigate()
  const activeCampaignId = useActiveCampaignId()
  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId)

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

      <div className={cn('relative z-20 shrink-0 border-b border-gray-200 py-3 dark:border-gray-800', BAND)}>
        <CampaignSwitcher
          campaigns={campaigns}
          activeCampaignId={activeCampaignId}
          onNavigate={onNavigate}
        />
      </div>

      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col">
        {/* `min-h-0` is what lets this actually scroll rather than push the
            account band off the bottom of a short window. The gutter is padding
            on the scroller itself, so the scrollbar rides the panel's edge
            instead of floating twelve pixels inside it. */}
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto py-3',
            '[scrollbar-color:var(--color-gray-300)_transparent] [scrollbar-width:thin]',
            'dark:[scrollbar-color:var(--color-gray-700)_transparent]',
            BAND,
          )}
        >
          <CampaignTree
            campaigns={activeCampaign ? [activeCampaign] : []}
            loading={campaignsLoading}
            rootless
            emptyState={
              <p className="m-0 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                Choose a campaign above.
              </p>
            }
            onNavigate={(to) => {
              navigate(to)
              onNavigate?.()
            }}
          />
        </div>
      </nav>

      {/* The account stays fixed while the campaign sections scroll above it. */}
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
