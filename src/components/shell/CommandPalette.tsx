import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Autocomplete,
  Collection,
  Dialog,
  Header,
  Input,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Modal,
  ModalOverlay,
  SearchField,
} from 'react-aria-components'
import type { Key } from 'react-aria-components'
import { useNavigate } from 'react-router'
import { Settings, Plus, X } from 'lucide-react'
import type { CampaignSummary } from '../../campaigns/types'
import { useCampaignList } from '../../campaigns/useCampaignList'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'
import { Kbd } from '../ui/Kbd'
import { Avatar } from './Avatar'
import { CampaignTree } from './CampaignTree'
import { NavIcon } from './NavIcon'
import { SearchIcon } from './icons/SearchIcon'
import { groupMatches, useCampaignContents } from './commands'
import type { Command } from './commands'
import {
  ALL_CAMPAIGNS_ICON,
  CAMPAIGN_SECTIONS,
  cssIcon,
  initialsOf,
  sectionHref,
} from './navigation'
import type { SectionIcon } from './navigation'
import './palette.css'

/**
 * Search, as the one thing that reaches everything.
 *
 * The sidebar's field opens this rather than filtering in place, because what a
 * GM means by "search" mid-session is "get me to the tavern's page", and that
 * answer lives in seven different lists. What can be found, and in what order,
 * is in commands.ts; this is the surface.
 *
 * The palette has two resting states, not one. With nothing typed, there is
 * nothing to filter, so it shows what the product *is*: quick actions for the
 * three things you can always do, and the same campaign tree the sidebar
 * navigates by — global here, not scoped to wherever you happen to be. The
 * moment you type, the tree gives way to the flat, ranked results a query
 * actually needs.
 *
 * Browsing and searching therefore reach the same ground by the same shapes:
 * open a campaign, open a section, and its records are listed under it exactly
 * as they are in the sidebar. See CampaignTree, which is that one component.
 *
 * The field and the flat results are one control, not two. React Aria's
 * Autocomplete keeps the caret in the input while the arrow keys move a
 * virtual focus through the results and Enter opens whichever row that focus
 * is on. The tree is deliberately not part of that wiring — it is a real,
 * independent treegrid with its own roving focus and Left/Right-to-collapse
 * keyboard model, which is what a tree is supposed to have.
 *
 * Filtering is done in commands.ts rather than by Autocomplete's `filter` prop
 * because a match on a kind should still rank below a match on a name.
 */

type CommandPaletteProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /**
   * The campaign you are in, if any. Not a scope — everything is searchable
   * either way — but it opens in the tree and it wins ties in the ranking.
   */
  campaignId: string | null
}

/** One empty list, so a closed palette asks the loader for the same nothing. */
const NOTHING: CampaignSummary[] = []

export function CommandPalette({ isOpen, onOpenChange, campaignId }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { campaigns, loading: campaignsLoading } = useCampaignList()
  const [query, setQuery] = useState('')
  // Which campaigns are open in the browse tree. Lifted up here rather than
  // owned by the tree itself so that typing a query — which unmounts the
  // tree in favour of the flat results — doesn't throw away what you had
  // expanded the moment you clear the query again.
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<Key>>(() => new Set())
  // Clearing the search from the empty state removes the button that was
  // clicked, so the caret has to be sent back to the field by hand.
  const field = useRef<HTMLInputElement>(null)
  // Every campaign, not the one you are standing in: opening the palette is
  // the moment "what can be found" stops meaning "what is on screen". Still
  // nothing before that — closed, this asks for nothing.
  const { byCampaign, loadingIds } = useCampaignContents(isOpen ? campaigns : NOTHING)
  const contents = useMemo(() => Object.values(byCampaign).flat(), [byCampaign])
  const loading = loadingIds.size > 0
  const hasQuery = query.trim().length > 0

  // A palette that reopens holding the last search is a palette you have to
  // clear before you can use it. Opening the campaign you are currently in is
  // the tree's own business — it takes `activeCampaignId` for that.
  useEffect(() => {
    if (!isOpen) setQuery('')
  }, [isOpen])

  const commands = useMemo<Command[]>(() => {
    const navigation: Command[] = [
      {
        id: 'nav:campaigns',
        label: 'All campaigns',
        hint: 'Everything you play in',
        group: 'Go to',
        icon: ALL_CAMPAIGNS_ICON,
        to: '/app',
      },
      {
        id: 'nav:new-campaign',
        label: 'New campaign',
        hint: 'Start a new one',
        group: 'Go to',
        icon: cssIcon(Plus, 'spin'),
        to: '/app/campaigns/new',
      },
      {
        id: 'nav:settings',
        label: 'Settings',
        hint: 'Your account',
        group: 'Go to',
        icon: cssIcon(Settings, 'spin'),
        to: '/app/settings',
      },
    ]

    const campaignCommands: Command[] = campaigns.map((campaign) => ({
      id: `campaign:${campaign.id}`,
      label: campaign.name,
      hint: 'Campaign',
      group: 'Campaigns',
      // Never drawn — a campaign shows its initials instead — but every command
      // carries one, so this is the one it carries.
      icon: ALL_CAMPAIGNS_ICON,
      to: `/app/campaigns/${campaign.id}`,
      initials: initialsOf(campaign.name),
      campaignId: campaign.id,
    }))

    // Every campaign's sections, not only the one you are standing in — the
    // browse tree shows all of them un-opened, so a typed query has to find
    // the same ground the tree does.
    const sectionCommands: Command[] = campaigns.flatMap((campaign) =>
      CAMPAIGN_SECTIONS.map((section) => ({
        id: `nav:${campaign.id}:${section.path || 'overview'}`,
        label: section.label,
        hint: section.hint,
        group: campaign.name,
        icon: section.icon,
        to: sectionHref(campaign.id, section.path),
        campaignId: campaign.id,
      })),
    )

    return [...navigation, ...campaignCommands, ...sectionCommands, ...contents]
  }, [campaigns, contents])

  const groups = useMemo(
    () => groupMatches(commands, query, campaignId),
    [commands, query, campaignId],
  )

  function handleNavigate(to: string) {
    onOpenChange(false)
    navigate(to)
  }

  function handleAction(key: Key) {
    const command = commands.find((item) => item.id === key)
    if (!command) return
    handleNavigate(command.to)
  }

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="palette-scrim fixed inset-0 z-50 flex min-h-full items-start justify-center overflow-y-auto bg-gray-950/70 p-4 backdrop-blur-[8px] md:pt-16 xl:pt-[clamp(64px,10vh,243px)]"
    >
      {/* 640px, and narrower only when the viewport is: the panel is a flex
          item, so it gives up width to the scrim's padding rather than needing
          a breakpoint of its own. */}
      <Modal className="palette-panel flex max-h-full w-160 flex-col overflow-hidden rounded-xl bg-white text-left shadow-xl dark:bg-gray-900 dark:ring-1 dark:ring-gray-800">
        <Dialog aria-label="Search" className="relative flex min-h-0 flex-1 flex-col outline-hidden">
          <Autocomplete inputValue={query} onInputChange={setQuery}>
            {/*
              The field is chrome, not a control to be found: no box, no fill,
              no ring — the panel it sits at the top of is the box, and the
              caret is already in it before you have looked. It is given height
              and a rule instead, which is what makes it read as a header.
              (`.palette-field` is why the ring is gone; see palette.css.)

              The rule is a pseudo-element rather than a border so it sits
              flush inside the panel's rounded corners instead of being
              clipped by them.
            */}
            <SearchField
              aria-label="Search"
              autoFocus
              className={cn(
                'relative flex h-16 shrink-0 items-center gap-3 px-4',
                'after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-gray-200',
                'dark:after:bg-gray-800',
              )}
            >
              <SearchIcon
                size={20}
                className="pointer-events-none shrink-0 text-gray-400 dark:text-gray-500"
              />
              {/* No Preflight in this project, so the reset a bare input needs
                  — its 2px UA border, its padding, its Arial — is spelled out
                  here rather than assumed. */}
              <Input
                ref={field}
                placeholder="Search campaigns, sections and entries…"
                className={cn(
                  'palette-field m-0 min-w-0 flex-1 border-0 bg-transparent p-0',
                  'font-sans text-base text-gray-900 outline-hidden placeholder:text-gray-400',
                  'dark:text-white dark:placeholder:text-gray-500',
                  '[&::-webkit-search-cancel-button]:hidden',
                )}
              />

              {/* Reaching for the mouse to empty a field you are already
                  typing in would be absurd, so this is not the way to clear a
                  search — it is the acknowledgement that there *is* one, which
                  an unringed field would otherwise be missing. */}
              {hasQuery ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery('')
                    field.current?.focus()
                  }}
                  className={cn(
                    'grid size-6 shrink-0 cursor-pointer place-items-center rounded-full',
                    'text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600',
                    'dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300',
                  )}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}

              {/* Esc, not the shortcut that opened this: the palette is
                  already open, so the only key worth naming is the way out. */}
              <Kbd>Esc</Kbd>
            </SearchField>

            <QuickActions onNavigate={handleNavigate} />

            {/* Only one collection is ever mounted here: the flat, ranked
                results once there is something to rank, nothing otherwise —
                the tree below is what fills an empty query, and it is
                deliberately not part of this Autocomplete at all. */}
            {hasQuery ? (
              <ListBox
                aria-label="Search results"
                selectionMode="single"
                onAction={handleAction}
                // scroll-py-10 keeps a row from arriving flush against the edge
                // when the keyboard scrolls it into view.
                className="flex max-h-106 flex-1 scroll-py-10 flex-col gap-2 overflow-auto pt-2 outline-hidden"
                renderEmptyState={() => (
                  <NoResults
                    query={query}
                    loading={loading}
                    onClear={() => {
                      setQuery('')
                      field.current?.focus()
                    }}
                  />
                )}
              >
                {groups.map(([group, items]) => (
                  <ListBoxSection
                    key={group}
                    className="border-b border-gray-200 pb-2 last:border-transparent dark:border-gray-800 dark:last:border-transparent"
                  >
                    <Header className="flex px-4.5 pt-2 pb-1 text-xs leading-[18px] font-semibold text-gray-600 dark:text-gray-400">
                      {group}
                    </Header>

                    <Collection items={items}>
                      {(command: Command) => <CommandRow command={command} />}
                    </Collection>
                  </ListBoxSection>
                ))}
              </ListBox>
            ) : null}
          </Autocomplete>

          {/*
            A real tree, not a virtual-focus one: Left/Right to collapse and
            expand is a tree convention Autocomplete doesn't know, so this
            keeps its own roving focus rather than borrowing the field's.
            Reached by Tab from the quick actions, same as any other control.
          */}
          {!hasQuery ? (
            <CampaignTree
              campaigns={campaigns}
              loading={campaignsLoading}
              expandedKeys={expandedCampaigns}
              onExpandedChange={setExpandedCampaigns}
              onNavigate={handleNavigate}
              className="max-h-106 flex-1 scroll-py-2 overflow-auto p-2"
              emptyState={<NoCampaigns onNavigate={handleNavigate} />}
            />
          ) : null}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

/**
 * The three things you can always do, regardless of what — if anything — is
 * typed. A campaign you are searching *within* is still a command away from
 * "start a new one" or "go somewhere else entirely", so this sits above the
 * fold rather than being one more row to scroll past.
 */
function QuickActions({ onNavigate }: { onNavigate: (to: string) => void }) {
  const actions: Array<{ key: string; label: string; icon: SectionIcon; to: string }> = [
    { key: 'all', label: 'All campaigns', icon: ALL_CAMPAIGNS_ICON, to: '/app' },
    { key: 'new', label: 'New campaign', icon: cssIcon(Plus, 'spin'), to: '/app/campaigns/new' },
    { key: 'settings', label: 'Settings', icon: cssIcon(Settings, 'spin'), to: '/app/settings' },
  ]

  return (
    <div className="grid shrink-0 grid-cols-3 gap-2 border-b border-gray-200 px-4 pt-3 pb-4 dark:border-gray-800">
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={() => onNavigate(action.to)}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-2.5 text-center',
            'transition-colors hover:border-gray-300 hover:bg-gray-50',
            'dark:border-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-800/60',
          )}
        >
          <span
            className="grid size-8 shrink-0 place-items-center rounded-md bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            aria-hidden="true"
          >
            <NavIcon icon={action.icon} size={18} />
          </span>
          <span className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * The tree with no campaigns in it.
 *
 * The sidebar answers this with one grey sentence, which is right for a
 * narrow column you are already living in. A 640px panel opened on purpose is
 * a question, and this is the one place in the product where "you have not
 * started anything yet" can be answered with the thing that starts one.
 */
function NoCampaigns({ onNavigate }: { onNavigate: (to: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <span
        className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-white text-gray-600 shadow-xs ring-1 ring-gray-200 ring-inset dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-700"
        aria-hidden="true"
      >
        <NavIcon icon={ALL_CAMPAIGNS_ICON} size={22} />
      </span>
      <div>
        <p className="m-0 text-sm font-semibold text-gray-900 dark:text-white">No campaigns yet</p>
        <p className="m-0 text-sm text-gray-600 dark:text-gray-400">Start one to see it here.</p>
      </div>
      <Button variant="secondary" onClick={() => onNavigate('/app/campaigns/new')}>
        New campaign
      </Button>
    </div>
  )
}

/**
 * One result.
 *
 * The row you can point at is the outer element and the row that lights up is
 * the inner one, inset by 8px — which is what keeps the hover highlight and the
 * focus ring clear of the panel's edges without the list having to be padded.
 * Hover tints; the keyboard's row takes a ring instead, so that pointing at one
 * row while the keyboard is on another can never look like two selections.
 */
function CommandRow({ command }: { command: Command }) {
  return (
    <ListBoxItem
      id={command.id}
      textValue={command.label}
      className="group block cursor-pointer px-2 py-0.5 outline-hidden"
    >
      {/* rounded-md, not rounded-lg: this product's radius scale puts 8px on
          `md`, and 8px is the row radius. */}
      <div
        className={cn(
          'relative flex min-h-10 items-center justify-between rounded-md px-2.5 py-2',
          'transition duration-100 ease-linear group-data-[hovered]:bg-gray-50',
          'group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand-600',
          'dark:group-data-[hovered]:bg-gray-800/60',
        )}
      >
        {/* The same circle the tree gives a campaign, for the same campaign. */}
        {command.initials ? (
          <span className="mr-2 flex shrink-0">
            <Avatar initials={command.initials} />
          </span>
        ) : (
          <NavIcon
            icon={command.icon}
            size={20}
            className="mr-2 text-gray-400 dark:text-gray-500"
          />
        )}

        <div className="flex flex-1 gap-x-1.5">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{command.label}</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">{command.hint}</span>
        </div>
      </div>
    </ListBoxItem>
  )
}

/**
 * The list with nothing in it.
 *
 * A palette that answers "no" should say so at the size of the question: the
 * rings and the raised glyph are there because an empty 640px panel with one
 * grey sentence in it reads as a component that failed rather than as an answer.
 */
function NoResults({
  query,
  loading,
  onClear,
}: {
  query: string
  loading: boolean
  onClear: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center overflow-hidden p-6 pb-10">
      <header className="relative mb-4">
        <Rings />
        <div className="relative grid size-12 shrink-0 place-items-center rounded-[10px] bg-white text-gray-600 shadow-xs ring-1 ring-gray-200 ring-inset dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-700">
          <SearchIcon size={24} />
        </div>
      </header>

      <main className="z-10 mb-6 flex w-full max-w-88 flex-col items-center justify-center gap-1">
        <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-white">
          {loading ? 'Still looking' : 'No results found'}
        </h2>
        <p className="m-0 text-center text-sm text-gray-600 dark:text-gray-400">
          {loading
            ? 'Your campaigns are still loading.'
            : `Your search “${query}” did not match anything. Please try again.`}
        </p>
      </main>

      {query ? (
        <footer className="z-10 flex gap-3">
          <Button variant="secondary" onClick={onClear}>
            Clear search
          </Button>
        </footer>
      ) : null}
    </div>
  )
}

/**
 * The rings behind the empty state's glyph.
 *
 * Seven concentric circles, 64px apart, faded out towards the edge by a radial
 * mask so they end rather than stop.
 */
function Rings() {
  return (
    <svg
      width="480"
      height="480"
      viewBox="0 0 480 480"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 text-gray-200 dark:text-gray-800"
    >
      <mask id="palette-rings-mask" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="480" height="480">
        <rect width="480" height="480" fill="url(#palette-rings-fade)" />
      </mask>
      <g mask="url(#palette-rings-mask)" stroke="currentColor">
        {[48, 80, 112, 144, 176, 208, 240].map((radius) => (
          <circle key={radius} cx="240" cy="240" r={radius - 0.5} />
        ))}
      </g>
      <defs>
        <radialGradient
          id="palette-rings-fade"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(240 240) rotate(90) scale(240)"
        >
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  )
}
