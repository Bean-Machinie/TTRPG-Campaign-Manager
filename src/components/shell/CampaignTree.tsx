import {
  Button as ChevronButton,
  Tree,
  TreeItem,
  TreeItemContent,
} from 'react-aria-components'
import type { Key } from 'react-aria-components'
import { ChevronRight } from 'lucide-react'
import type { CampaignSummary } from '../../campaigns/types'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { NavIcon } from './NavIcon'
import { ALL_CAMPAIGNS_ICON, CAMPAIGN_SECTIONS, initialsOf, sectionHref } from './navigation'

/**
 * Everywhere you can go, laid out as what it actually is: a list of
 * campaigns, each holding the same nine sections.
 *
 * This replaces a flat, unfiltered dump of every command as the palette's
 * resting view. A tree says the thing directly — "here are your campaigns,
 * here is what's inside each one" — and it says it without requiring you to
 * be inside a campaign first: expanding "Curse of Strahd" here costs nothing
 * and switches nothing, unlike the sidebar, which can only ever show the
 * campaign you have already navigated into.
 *
 * Sections are static, so expanding a campaign never fetches anything. Only
 * a typed query reaches into a campaign's actual contents (its sessions,
 * documents and so on) — that stays in commands.ts, unchanged.
 */

type CampaignTreeProps = {
  campaigns: CampaignSummary[]
  loading: boolean
  expandedKeys: Set<Key>
  onExpandedChange: (keys: Set<Key>) => void
  onNavigate: (to: string) => void
}

export function CampaignTree({
  campaigns,
  loading,
  expandedKeys,
  onExpandedChange,
  onNavigate,
}: CampaignTreeProps) {
  if (loading && campaigns.length === 0) {
    return (
      <div className="flex max-h-106 flex-1 flex-col gap-2 overflow-auto p-3" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <span className="size-6 shrink-0 animate-pulse rounded-md bg-gray-100" />
            <span className="h-2.5 flex-1 animate-pulse rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
    )
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-white text-gray-600 shadow-xs ring-1 ring-gray-200 ring-inset"
          aria-hidden="true"
        >
          <NavIcon icon={ALL_CAMPAIGNS_ICON} size={22} />
        </span>
        <div>
          <p className="m-0 text-sm font-semibold text-gray-900">No campaigns yet</p>
          <p className="m-0 text-sm text-gray-600">Start one to see it here.</p>
        </div>
        <Button variant="secondary" onClick={() => onNavigate('/app/campaigns/new')}>
          New campaign
        </Button>
      </div>
    )
  }

  return (
    <Tree
      aria-label="Campaigns"
      items={campaigns}
      selectionMode="none"
      expandedKeys={expandedKeys}
      onExpandedChange={onExpandedChange}
      className="flex max-h-106 flex-1 flex-col gap-0.5 overflow-auto p-2 outline-hidden"
    >
      {(campaign) => (
        <TreeItem
          id={campaign.id}
          textValue={campaign.name}
          onAction={() => onNavigate(`/app/campaigns/${campaign.id}`)}
          className="group outline-hidden"
        >
          <TreeItemContent>
            {({ isExpanded }) => (
              <div className="relative flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 pl-2 transition-colors duration-100 ease-linear group-data-[hovered]:bg-gray-50 group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600">
                {/* A slotted button, not a plain one: this is how the tree
                    tells the row underneath it "toggle, don't activate" — the
                    same press that would otherwise navigate. */}
                <ChevronButton
                  slot="chevron"
                  className="grid size-5 shrink-0 place-items-center rounded text-gray-400 outline-hidden transition-colors hover:text-gray-600"
                >
                  <ChevronRight
                    aria-hidden="true"
                    className={cn(
                      'size-4 shrink-0 transition-transform duration-150',
                      isExpanded && 'rotate-90',
                    )}
                  />
                </ChevronButton>

                <span
                  className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-50 text-[0.625rem] font-semibold text-brand-700"
                  aria-hidden="true"
                >
                  {initialsOf(campaign.name)}
                </span>

                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                  {campaign.name}
                </span>
              </div>
            )}
          </TreeItemContent>

          {CAMPAIGN_SECTIONS.map((section, index) => (
            <TreeItem
              key={section.path}
              id={`${campaign.id}:${section.path || 'overview'}`}
              textValue={section.label}
              onAction={() => onNavigate(sectionHref(campaign.id, section.path))}
              className="group outline-hidden"
            >
              <TreeItemContent>
                {() => (
                  <div className="relative flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 pl-8 transition-colors duration-100 ease-linear group-data-[hovered]:bg-gray-50 group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600">
                    <TreeGuide isLast={index === CAMPAIGN_SECTIONS.length - 1} />
                    <NavIcon icon={section.icon} size={18} className="shrink-0 text-gray-400" />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                      {section.label}
                    </span>
                  </div>
                )}
              </TreeItemContent>
            </TreeItem>
          ))}
        </TreeItem>
      )}
    </Tree>
  )
}

/**
 * The elbow connecting a section to its campaign.
 *
 * Three bars, not one clever border: a run from the top of the row down to
 * its middle (every section has one — it is what continues the line down
 * from the campaign, or from the section above), a run from the middle to
 * the bottom (every section but the last — it is what carries the line on to
 * the *next* section), and the short stub that turns the corner into the
 * icon. Dropping the middle-to-bottom run on the last child is what makes
 * the line stop with its branch instead of overshooting past it.
 */
function TreeGuide({ isLast }: { isLast: boolean }) {
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute top-0 left-5 h-1/2 w-px bg-gray-200" />
      {!isLast ? (
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 bottom-0 left-5 w-px bg-gray-200" />
      ) : null}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-5 h-px w-3 -translate-y-1/2 bg-gray-200"
      />
    </>
  )
}
