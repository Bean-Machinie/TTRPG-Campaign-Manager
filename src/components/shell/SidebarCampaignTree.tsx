import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
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
import { loadCampaignContents } from './commands'
import type { Command } from './commands'
import { NavIcon } from './NavIcon'
import { CAMPAIGN_SECTIONS, initialsOf, sectionHref } from './navigation'

type SidebarCampaignTreeProps = {
  campaigns: CampaignSummary[]
  loading: boolean
  activeCampaignId: string | null
  onNavigate?: () => void
}

const campaignKey = (campaignId: string) => `campaign:${campaignId}`
const sectionKey = (campaignId: string, path: string) =>
  `section:${campaignId}:${path || 'overview'}`

/**
 * The persistent campaign navigator in the sidebar.
 *
 * Adobe's React Aria Tree owns expansion, arrow-key navigation, focus and tree
 * semantics. This component supplies the routes, real data and visual guides.
 */
export function SidebarCampaignTree({
  campaigns,
  loading,
  activeCampaignId,
  onNavigate,
}: SidebarCampaignTreeProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [expandedKeys, setExpandedKeys] = useState<Set<Key>>(
    () => new Set(activeCampaignId ? [campaignKey(activeCampaignId)] : []),
  )
  const [contents, setContents] = useState<Record<string, Command[]>>({})
  const [loadingCampaigns, setLoadingCampaigns] = useState<Set<string>>(new Set())
  const requestedCampaigns = useRef(new Set<string>())

  useEffect(() => {
    if (!activeCampaignId) return
    setExpandedKeys((current) => {
      const next = new Set(current)
      next.add(campaignKey(activeCampaignId))
      return next
    })
  }, [activeCampaignId])

  // Opening a campaign is the fetch boundary. Each lightweight list is loaded
  // once, and section branches appear only where real records exist.
  useEffect(() => {
    for (const campaign of campaigns) {
      if (
        !expandedKeys.has(campaignKey(campaign.id)) ||
        requestedCampaigns.current.has(campaign.id)
      ) {
        continue
      }

      requestedCampaigns.current.add(campaign.id)
      setLoadingCampaigns((current) => new Set(current).add(campaign.id))

      void loadCampaignContents(campaign.id, campaign.name)
        .then((items) => {
          setContents((current) => ({ ...current, [campaign.id]: items }))
        })
        .catch(() => {
          setContents((current) => ({ ...current, [campaign.id]: [] }))
        })
        .finally(() => {
          setLoadingCampaigns((current) => {
            const next = new Set(current)
            next.delete(campaign.id)
            return next
          })
        })
    }
  }, [campaigns, expandedKeys])

  function go(to: string) {
    navigate(to)
    onNavigate?.()
  }

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex flex-col gap-2 px-1 py-1.5" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-2 px-2 py-1.5">
            <span className="size-6 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
            <span className="h-2.5 flex-1 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    )
  }

  if (campaigns.length === 0) {
    return (
      <p className="m-0 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
        No campaigns yet.
      </p>
    )
  }

  return (
    <Tree
      aria-label="Campaigns"
      selectionMode="none"
      expandedKeys={expandedKeys}
      onExpandedChange={setExpandedKeys}
      className="flex flex-col gap-0.5 outline-hidden"
    >
      {campaigns.map((campaign) => {
        const campaignContents = contents[campaign.id] ?? []
        const isCampaignActive = location.pathname.startsWith(`/app/campaigns/${campaign.id}`)

        return (
          <TreeItem
            key={campaign.id}
            id={campaignKey(campaign.id)}
            textValue={campaign.name}
            onAction={() => go(`/app/campaigns/${campaign.id}`)}
            className="group outline-hidden"
          >
            <TreeItemContent>
              {({ isExpanded }) => (
                <TreeRow active={isCampaignActive} level={0} strong>
                  <TreeChevron isExpanded={isExpanded} label={`${campaign.name} sections`} />
                  <Avatar initials={initialsOf(campaign.name)} />
                  <span className="min-w-0 flex-1 truncate">{campaign.name}</span>
                  {loadingCampaigns.has(campaign.id) ? <LoadingDot /> : null}
                </TreeRow>
              )}
            </TreeItemContent>

            {CAMPAIGN_SECTIONS.map((section, sectionIndex) => {
              const sectionItems = campaignContents.filter((item) =>
                item.id.startsWith(`${section.path}:`),
              )
              const hasChildren = sectionItems.length > 0
              const to = sectionHref(campaign.id, section.path)
              const isSectionActive = section.path
                ? location.pathname === to || location.pathname.startsWith(`${to}/`)
                : location.pathname === to

              return (
                <TreeItem
                  key={section.path || 'overview'}
                  id={sectionKey(campaign.id, section.path)}
                  textValue={section.label}
                  onAction={() => go(to)}
                  className="group outline-hidden"
                >
                  <TreeItemContent>
                    {({ isExpanded }) => (
                      <TreeRow active={isSectionActive} level={1}>
                        <IndentGuides
                          level={1}
                          isLast={sectionIndex === CAMPAIGN_SECTIONS.length - 1}
                        />
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
                      id={`entry:${campaign.id}:${item.id}`}
                      textValue={item.label}
                      onAction={() => go(item.to)}
                      className="group outline-hidden"
                    >
                      <TreeItemContent>
                        <TreeRow active={location.pathname === item.to && item.to !== to} level={2}>
                          <IndentGuides
                            level={2}
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
            })}
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
      className="grid size-5 shrink-0 cursor-pointer place-items-center rounded text-gray-400 outline-hidden dark:text-gray-500"
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
 * its own control and turns into the row it belongs to on a 4px corner. The
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
          'absolute -top-0.5 bottom-1/2 w-3.5 rounded-bl-[0.25rem]',
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
