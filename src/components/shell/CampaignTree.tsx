import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
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
import { Avatar } from './Avatar'
import { useCampaignContents } from './commands'
import { NavIcon } from './NavIcon'
import {
  CAMPAIGN_SECTIONS,
  campaignKey,
  entryKey,
  expansionAfterSectionActivation,
  initialsOf,
  isEntryRoute,
  revealedKeys,
  sectionHref,
  sectionKey,
} from './navigation'
import { useActiveCampaignId } from './useActiveCampaignId'

/**
 * Everywhere you can go, laid out as what it actually is: your campaigns, the
 * nine sections inside each, and the real records inside those.
 *
 * One tree, two homes. The sidebar has it as the permanent navigator and the
 * command palette has it as the resting view behind an empty query, and they
 * are the same component on purpose — a GM who learns that quests live two
 * rows under a campaign should not have to learn it twice, and the two had
 * drifted into disagreeing about depth, about guides, and about whether a
 * section could be opened at all.
 *
 * Adobe's React Aria Tree owns expansion, arrow-key navigation, focus and tree
 * semantics. This component supplies the routes, real data and visual guides.
 *
 * Opening a campaign is the fetch boundary: sections are static and cost
 * nothing to expand, and only a campaign that someone actually opens pulls its
 * contents. Typed search is a separate path — see commands.ts, which ranks
 * across every campaign rather than only the opened ones.
 */

type CampaignTreeProps = {
  campaigns: CampaignSummary[]
  loading: boolean
  /** Where a row goes. The caller decides what else happens on the way. */
  onNavigate: (to: string) => void
  /**
   * Expansion, when the caller needs to outlive the tree. The palette keeps it
   * because typing a query unmounts the tree in favour of ranked results, and
   * throwing away what you had opened is not what clearing a query means.
   * Omit both and the tree keeps its own.
   */
  expandedKeys?: Set<Key>
  onExpandedChange?: (keys: Set<Key>) => void
  /** Shows sections directly, for a campaign already named by the switcher above it. */
  rootless?: boolean
  className?: string
  /** What stands in for the tree when there is nothing to put in it. */
  emptyState?: ReactNode
}

const CONTAINER = 'flex flex-col gap-0.5 outline-hidden'

export function CampaignTree({
  campaigns,
  loading,
  onNavigate,
  expandedKeys,
  onExpandedChange,
  rootless = false,
  className,
  emptyState,
}: CampaignTreeProps) {
  const location = useLocation()
  const activeCampaignId = useActiveCampaignId()
  const [ownExpandedKeys, setOwnExpandedKeys] = useState<Set<Key>>(
    () => new Set(activeCampaignId ? [campaignKey(activeCampaignId)] : []),
  )

  const expanded = expandedKeys ?? ownExpandedKeys

  // Opening a campaign is the fetch boundary: sections cost nothing to expand,
  // and only a campaign somebody has actually opened pulls its contents.
  const { byCampaign, loadingIds } = useCampaignContents(
    campaigns.filter((campaign) => expanded.has(campaignKey(campaign.id))),
  )

  function changeExpanded(keys: Set<Key>) {
    if (!expandedKeys) setOwnExpandedKeys(keys)
    onExpandedChange?.(keys)
  }

  /**
   * Section labels navigate first and disclose second.
   *
   * Arriving from another section always leaves the destination open so its
   * records remain visible. Once the section is already active, pressing its
   * label again becomes a convenient toggle. The dedicated chevron continues
   * to toggle independently without navigating.
   */
  function activateSection(key: Key, to: string, isOverviewActive: boolean, hasChildren: boolean) {
    if (hasChildren) {
      changeExpanded(
        expansionAfterSectionActivation(expanded, key, isOverviewActive, hasChildren),
      )
    }

    onNavigate(to)
  }

  // Resolved in two passes rather than one, and that is fine: expanding the
  // campaign is what loads its contents, and the contents are what identify
  // the section to open.
  const revealKeys = useMemo(
    () => revealedKeys(activeCampaignId, byCampaign[activeCampaignId ?? ''] ?? [], location.pathname),
    [activeCampaignId, byCampaign, location.pathname],
  )

  /**
   * Opening the tree onto where you are — once per arrival, not for as long as
   * you stay.
   *
   * The difference matters because this only ever adds keys. Re-running it
   * whenever expansion changes would mean a section you collapsed while
   * reading a document in it sprang back open under your hand, forever. So
   * each distinct destination is revealed exactly once, and after that the
   * tree is yours: collapse what you like, and it stays collapsed until you
   * navigate somewhere that needs it open again.
   */
  const revealed = useRef<string | null>(null)

  useEffect(() => {
    if (revealKeys.length === 0) return

    const arrival = `${location.pathname}::${revealKeys.join('|')}`
    if (revealed.current === arrival) return
    revealed.current = arrival

    if (expandedKeys) {
      if (revealKeys.every((key) => expandedKeys.has(key))) return
      const next = new Set<Key>(expandedKeys)
      for (const key of revealKeys) next.add(key)
      onExpandedChange?.(next)
      return
    }

    setOwnExpandedKeys((current) => {
      if (revealKeys.every((key) => current.has(key))) return current
      const next = new Set(current)
      for (const key of revealKeys) next.add(key)
      return next
    })
  }, [revealKeys, location.pathname, expandedKeys, onExpandedChange])

  if (loading && campaigns.length === 0) {
    return (
      <div className={cn(CONTAINER, className)} aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex min-h-9 items-center gap-2 px-2 py-1.5">
            <span className="size-6 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
            <span className="h-2.5 flex-1 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    )
  }

  if (campaigns.length === 0) {
    return (
      emptyState ?? (
        <p className="m-0 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
          No campaigns yet.
        </p>
      )
    )
  }

  function sectionsFor(campaign: CampaignSummary) {
    const campaignContents = byCampaign[campaign.id] ?? []

    return CAMPAIGN_SECTIONS.map((section, sectionIndex) => {
      const sectionItems = campaignContents.filter((item) =>
        item.id.startsWith(`${section.path}:`),
      )
      const hasChildren = sectionItems.length > 0
      const to = sectionHref(campaign.id, section.path)
      const isSectionOverview = location.pathname === to
      const isSectionActive = section.path
        ? isSectionOverview || location.pathname.startsWith(`${to}/`)
        : isSectionOverview

      return (
        <TreeItem
          key={section.path || 'overview'}
          id={sectionKey(campaign.id, section.path)}
          textValue={section.label}
          onAction={() =>
            activateSection(
              sectionKey(campaign.id, section.path),
              to,
              isSectionOverview,
              hasChildren,
            )
          }
          className="group outline-hidden"
        >
          <TreeItemContent>
            {({ isExpanded }) => (
              <TreeRow active={isSectionActive} level={rootless ? 0 : 1}>
                {!rootless ? (
                  <IndentGuides
                    level={1}
                    isLast={sectionIndex === CAMPAIGN_SECTIONS.length - 1}
                  />
                ) : null}
                {hasChildren ? (
                  <TreeChevron isExpanded={isExpanded} label={`${section.label} items`} />
                ) : (
                  <span className="size-5 shrink-0" aria-hidden="true" />
                )}
                <NavIcon
                  icon={section.icon}
                  size={18}
                  className={cn(
                    'shrink-0',
                    isSectionActive
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-gray-400 dark:text-gray-500',
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{section.label}</span>
                {hasChildren ? (
                  <span className="text-[0.6875rem] tabular-nums text-gray-400 dark:text-gray-500">
                    {sectionItems.length}
                  </span>
                ) : null}
              </TreeRow>
            )}
          </TreeItemContent>

          {sectionItems.map((item, itemIndex) => (
            <TreeItem
              key={item.id}
              id={entryKey(campaign.id, item.id)}
              textValue={item.label}
              onAction={() => onNavigate(item.to)}
              className="group outline-hidden"
            >
              <TreeItemContent>
                <TreeRow
                  active={item.to !== to && isEntryRoute(location.pathname, item.to)}
                  level={rootless ? 1 : 2}
                >
                  <IndentGuides
                    level={rootless ? 1 : 2}
                    isLast={itemIndex === sectionItems.length - 1}
                    parentIsLast={sectionIndex === CAMPAIGN_SECTIONS.length - 1}
                  />
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </TreeRow>
              </TreeItemContent>
            </TreeItem>
          ))}
        </TreeItem>
      )
    })
  }

  return (
    <Tree
      aria-label="Campaigns"
      selectionMode="none"
      // React Aria otherwise installs an implicit row action that toggles any
      // branch, then composes it with the TreeItem's navigation action. A
      // tree-level action suppresses that fallback. Each item still runs its
      // own action below, and the chevron keeps its dedicated expand/collapse
      // behavior.
      onAction={() => undefined}
      expandedKeys={expanded}
      onExpandedChange={changeExpanded}
      className={cn(CONTAINER, className)}
    >
      {rootless
        ? campaigns.flatMap((campaign) => sectionsFor(campaign))
        : campaigns.map((campaign) => {
            const isCampaignActive = location.pathname.startsWith(
              `/app/campaigns/${campaign.id}`,
            )

            return (
              <TreeItem
                key={campaign.id}
                id={campaignKey(campaign.id)}
                textValue={campaign.name}
                onAction={() => onNavigate(`/app/campaigns/${campaign.id}`)}
                className="group outline-hidden"
              >
                <TreeItemContent>
                  {({ isExpanded }) => (
                    <TreeRow active={isCampaignActive} level={0} strong>
                      <TreeChevron isExpanded={isExpanded} label={`${campaign.name} sections`} />
                      <Avatar initials={initialsOf(campaign.name)} />
                      <span className="min-w-0 flex-1 truncate">{campaign.name}</span>
                      {loadingIds.has(campaign.id) ? <LoadingDot /> : null}
                    </TreeRow>
                  )}
                </TreeItemContent>

                {sectionsFor(campaign)}
              </TreeItem>
            )
          })}
    </Tree>
  )
}

function TreeRow({
  active,
  level,
  strong = false,
  children,
}: {
  active: boolean
  level: 0 | 1 | 2
  strong?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'relative flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 text-sm',
        'transition-colors duration-100 outline-hidden',
        'group-data-[hovered]:bg-gray-50 group-data-[focus-visible]:outline-2 group-data-[focus-visible]:-outline-offset-2 group-data-[focus-visible]:outline-brand-600',
        'dark:group-data-[hovered]:bg-gray-800/60',
        level === 0 && 'pl-1',
        level === 1 && 'pl-8',
        level === 2 && 'pl-15 text-[0.8125rem]',
        strong ? 'font-semibold' : 'font-medium',
        active
          ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
          : 'text-gray-700 dark:text-gray-300',
      )}
    >
      {active ? (
        <span
          className="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600 dark:bg-brand-400"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </div>
  )
}

function TreeChevron({ isExpanded, label }: { isExpanded: boolean; label: string }) {
  return (
    <ChevronButton
      slot="chevron"
      aria-label={label}
      className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-xs text-gray-400 outline-hidden dark:text-gray-500"
    >
      <ChevronRight
        className={cn('size-3.5 transition-transform duration-150', isExpanded && 'rotate-90')}
        aria-hidden="true"
      />
    </ChevronButton>
  )
}

/**
 * The vertical guides that mark how deep a row sits.
 *
 * Each column is centred on the chevron of the row that opened it — 0.875rem
 * for a campaign, 2.625rem for a section — so a branch drops straight out of
 * its own control and turns into the row it belongs to on the smallest optical
 * corner tier. The
 * column stops at the elbow of the last row in a group, and a deeper row only
 * carries its grandparent's column through when that group is still open
 * below it. Rows sit 2px apart, so segments bleed into the gap to read as one
 * line.
 */
function IndentGuides({
  level,
  isLast,
  parentIsLast = true,
}: {
  level: 1 | 2
  isLast: boolean
  parentIsLast?: boolean
}) {
  const stroke = 'bg-gray-200 dark:bg-gray-700'
  const column = level === 1 ? 'left-3.5' : 'left-[2.625rem]'

  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {level === 2 && !parentIsLast ? (
        <span className={cn('absolute -inset-y-0.5 left-3.5 w-px', stroke)} />
      ) : null}
      <span
        className={cn(
          'absolute -top-0.5 bottom-1/2 w-3.5 rounded-bl-xs',
          'border-b border-l border-gray-200 dark:border-gray-700',
          column,
        )}
      />
      {!isLast ? (
        <span className={cn('absolute top-1/2 -bottom-0.5 w-px', column, stroke)} />
      ) : null}
    </span>
  )
}

function LoadingDot() {
  return (
    <span
      className="size-1.5 animate-pulse rounded-full bg-brand-500"
      aria-label="Loading campaign items"
    />
  )
}
