import { useEffect, useMemo, useRef, useState } from 'react'
import type { Key } from 'react'
import {
  Autocomplete,
  Dialog,
  Header,
  Input,
  Menu,
  MenuItem,
  MenuSection,
  Modal,
  ModalOverlay,
  SearchField,
} from 'react-aria-components'
import { useNavigate } from 'react-router'
import { CornerDownLeft, Search, Settings, Swords, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  listCampaignCharacters,
  listCampaignDocuments,
  listCampaignLocations,
  listCampaignMaps,
  listCampaignNotes,
  listCampaignQuests,
  listCampaignSessions,
} from '../../campaigns/campaignsApi'
import { useCampaignList } from '../../campaigns/useCampaignList'
import { CAMPAIGN_SECTIONS, initialsOf, sectionHref } from './navigation'

/**
 * Search, as the one thing that reaches everything.
 *
 * The sidebar's field opens this rather than filtering in place, because what a
 * GM means by "search" mid-session is "get me to the tavern's page", and that
 * answer lives in seven different lists. Three sources are merged here:
 *
 *   1. where you can go        — the sections of the campaign you are in
 *   2. what you belong to      — your campaigns
 *   3. what is *in* a campaign — its sessions, characters, locations, quests,
 *                                notes, documents and maps
 *
 * The third is fetched the first time the palette is opened for a campaign and
 * then kept, so the second open is instant. It is a client-side match over
 * lists the product already loads a page at a time; the indexed, visibility-
 * filtered search in the plan replaces the matching here without changing what
 * this component is.
 *
 * Nothing is fetched until the palette opens. A GM who never presses ⌘K never
 * pays for it.
 */

type Command = {
  id: string
  label: string
  /** The line under the label. What kind of thing this is, mostly. */
  hint: string
  group: string
  icon: LucideIcon
  to: string
  /** Shown instead of an icon, for campaigns. */
  initials?: string
}

type CommandPaletteProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** The campaign whose contents are searchable, if you are inside one. */
  campaignId: string | null
  campaignName: string
}

export function CommandPalette({
  isOpen,
  onOpenChange,
  campaignId,
  campaignName,
}: CommandPaletteProps) {
  const navigate = useNavigate()
  const { campaigns } = useCampaignList()
  const [query, setQuery] = useState('')
  const { contents, loading } = useCampaignContents(isOpen ? campaignId : null, campaignName)

  // A palette that reopens holding the last search is a palette you have to
  // clear before you can use it.
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
        icon: Swords,
        to: '/app',
      },
      {
        id: 'nav:new-campaign',
        label: 'New campaign',
        hint: 'Start a new one',
        group: 'Go to',
        icon: Plus,
        to: '/app/campaigns/new',
      },
      {
        id: 'nav:settings',
        label: 'Settings',
        hint: 'Your account',
        group: 'Go to',
        icon: Settings,
        to: '/app/settings',
      },
    ]

    if (campaignId) {
      navigation.unshift(
        ...CAMPAIGN_SECTIONS.map((section) => ({
          id: `nav:${section.path || 'overview'}`,
          label: section.label,
          hint: section.hint,
          group: campaignName,
          icon: section.icon,
          to: sectionHref(campaignId, section.path),
        })),
      )
    }

    const campaignCommands: Command[] = campaigns.map((campaign) => ({
      id: `campaign:${campaign.id}`,
      label: campaign.name,
      hint: 'Campaign',
      group: 'Campaigns',
      icon: Swords,
      to: `/app/campaigns/${campaign.id}`,
      initials: initialsOf(campaign.name),
    }))

    return [...navigation, ...campaignCommands, ...contents]
  }, [campaignId, campaignName, campaigns, contents])

  const groups = useMemo(() => groupMatches(commands, query), [commands, query])

  function handleAction(key: Key) {
    const command = commands.find((item) => item.id === key)
    if (!command) return

    onOpenChange(false)
    navigate(command.to)
  }

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex items-start justify-center bg-gray-950/40 p-4 pt-[10vh] backdrop-blur-[2px]"
    >
      <Modal className="w-full max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
        <Dialog aria-label="Search" className="outline-hidden">
          {/*
            Autocomplete is what makes the field and the list one control: the
            caret stays in the input while the arrow keys move a virtual focus
            through the results, and Enter activates whatever that focus is on.
            Filtering is done here rather than by its `filter` prop because a
            match on a hint should still rank below a match on a name.
          */}
          <Autocomplete inputValue={query} onInputChange={setQuery}>
            <SearchField
              aria-label="Search"
              autoFocus
              className="flex items-center gap-3 border-b border-gray-200 px-4"
            >
              <Search className="size-5 shrink-0 text-gray-400" aria-hidden="true" />
              <Input
                placeholder="Search sections, campaigns and entries…"
                className="w-full bg-transparent py-4 text-sm text-gray-900 outline-hidden placeholder:text-gray-400 [&::-webkit-search-cancel-button]:hidden"
              />
            </SearchField>

            <Menu
              onAction={handleAction}
              className="max-h-[22rem] overflow-y-auto p-2 outline-hidden"
              renderEmptyState={() => (
                <p className="px-3 py-8 text-center text-sm text-gray-500">
                  {loading ? 'Looking…' : `Nothing matches “${query}”.`}
                </p>
              )}
            >
              {groups.map(([group, items]) => (
                <MenuSection key={group} className="mb-1 last:mb-0">
                  <Header className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {group}
                  </Header>

                  {items.map((command) => (
                    <MenuItem
                      key={command.id}
                      id={command.id}
                      textValue={command.label}
                      className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 outline-hidden focus:bg-gray-50"
                    >
                      {command.initials ? (
                        <span
                          className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-50 text-[0.625rem] font-semibold text-brand-700"
                          aria-hidden="true"
                        >
                          {command.initials}
                        </span>
                      ) : (
                        <span
                          className="grid size-8 shrink-0 place-items-center rounded-md border border-gray-200 bg-white text-gray-500 group-focus:border-brand-200 group-focus:bg-brand-50 group-focus:text-brand-600"
                          aria-hidden="true"
                        >
                          <command.icon className="size-4" />
                        </span>
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">
                          {command.label}
                        </span>
                        <span className="block truncate text-xs text-gray-500">{command.hint}</span>
                      </span>

                      {/* Only on the row the keyboard is on, where it is a hint
                          about what Enter will do rather than decoration. */}
                      <CornerDownLeft
                        className="size-4 shrink-0 text-gray-300 opacity-0 group-focus:opacity-100"
                        aria-hidden="true"
                      />
                    </MenuItem>
                  ))}
                </MenuSection>
              ))}
            </Menu>
          </Autocomplete>

          <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-500">
            <span>
              <Shortcut>↑</Shortcut> <Shortcut>↓</Shortcut> to move ·{' '}
              <Shortcut>Enter</Shortcut> to open · <Shortcut>Esc</Shortcut> to close
            </span>
            {loading ? <span>Loading this campaign…</span> : null}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

function Shortcut({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-gray-200 bg-white px-1.5 py-px font-sans text-[0.6875rem] text-gray-500">
      {children}
    </kbd>
  )
}

/**
 * Matching, and the order results come back in.
 *
 * A name that starts with what was typed beats a name that merely contains it,
 * which beats a match on the kind or the section. Without the ranking, typing
 * "no" puts every note-adjacent hint above the location actually called
 * "Northwatch".
 */
function groupMatches(commands: Command[], query: string): Array<[string, Command[]]> {
  const needle = query.trim().toLowerCase()

  const scored = commands
    .map((command) => ({ command, score: scoreOf(command, needle) }))
    .filter((entry) => entry.score < 3)
    .sort((a, b) => a.score - b.score)

  const groups = new Map<string, Command[]>()
  for (const { command } of scored) {
    const bucket = groups.get(command.group)
    if (bucket) bucket.push(command)
    else groups.set(command.group, [command])
  }

  return [...groups]
}

function scoreOf(command: Command, needle: string) {
  if (!needle) return 1

  const label = command.label.toLowerCase()
  if (label.startsWith(needle)) return 0
  if (label.includes(needle)) return 1
  if (`${command.hint} ${command.group}`.toLowerCase().includes(needle)) return 2
  return 3
}

/**
 * Everything inside one campaign, as commands.
 *
 * Fetched with allSettled rather than all: a campaign whose maps fail to load —
 * an expired signed URL, a dropped connection — should still be searchable by
 * character name. Kept in a ref keyed by campaign so reopening the palette
 * costs nothing, and dropped when the campaign changes.
 */
function useCampaignContents(campaignId: string | null, campaignName: string) {
  const [contents, setContents] = useState<Command[]>([])
  const [loading, setLoading] = useState(false)
  const cache = useRef(new Map<string, Command[]>())

  useEffect(() => {
    if (!campaignId) {
      setContents([])
      return
    }

    const cached = cache.current.get(campaignId)
    if (cached) {
      setContents(cached)
      return
    }

    let active = true
    setLoading(true)

    loadCampaignContents(campaignId, campaignName)
      .then((loaded) => {
        cache.current.set(campaignId, loaded)
        if (active) setContents(loaded)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [campaignId, campaignName])

  return { contents, loading }
}

const sectionByPath = new Map(CAMPAIGN_SECTIONS.map((section) => [section.path, section]))

function settledValue<T>(result: PromiseSettledResult<T[]>): T[] {
  return result.status === 'fulfilled' ? result.value : []
}

async function loadCampaignContents(campaignId: string, campaignName: string): Promise<Command[]> {
  const settled = await Promise.allSettled([
    listCampaignSessions(campaignId),
    listCampaignCharacters(campaignId),
    listCampaignLocations(campaignId),
    listCampaignQuests(campaignId),
    listCampaignNotes(campaignId),
    listCampaignDocuments(campaignId),
    listCampaignMaps(campaignId),
  ])

  // Indexed rather than mapped over: allSettled types a tuple, and mapping it
  // would collapse seven element types into one union.
  const sessions = settledValue(settled[0])
  const characters = settledValue(settled[1])
  const locations = settledValue(settled[2])
  const quests = settledValue(settled[3])
  const notes = settledValue(settled[4])
  const documents = settledValue(settled[5])
  const maps = settledValue(settled[6])

  const group = `In ${campaignName}`

  const entries: Command[] = [
    ...toCommands(sessions, 'sessions', group, (item) => ({
      id: item.id,
      label: item.title,
      hint: item.scheduledFor ? `Session · ${item.scheduledFor}` : 'Session',
    })),
    ...toCommands(characters, 'characters', group, (item) => ({
      id: item.id,
      label: item.name,
      hint: item.kind === 'pc' ? 'Player character' : 'NPC',
    })),
    ...toCommands(locations, 'locations', group, (item) => ({
      id: item.id,
      label: item.name,
      hint: 'Location',
    })),
    ...toCommands(quests, 'quests', group, (item) => ({
      id: item.id,
      label: item.title,
      hint: `Quest · ${item.status}`,
    })),
    ...toCommands(notes, 'notes', group, (item) => ({
      id: item.id,
      label: item.title,
      hint: item.isPrivate ? 'Note · private' : 'Note',
    })),
    // The only kind with a page of its own, so the only one whose command opens
    // the thing itself rather than the list it is in.
    ...toCommands(documents, 'documents', group, (item) => ({
      id: item.id,
      label: item.title,
      hint: 'Document',
      to: `${sectionHref(campaignId, 'documents')}/${item.id}`,
    })),
    ...toCommands(maps, 'maps', group, (item) => ({
      id: item.id,
      label: item.name,
      hint: 'Map',
    })),
  ]

  return entries

  function toCommands<T>(
    items: T[],
    path: string,
    groupName: string,
    describe: (item: T) => { id: string; label: string; hint: string; to?: string },
  ): Command[] {
    const section = sectionByPath.get(path)

    return items.map((item) => {
      const described = describe(item)
      return {
        id: `${path}:${described.id}`,
        label: described.label,
        hint: described.hint,
        group: groupName,
        icon: section?.icon ?? Search,
        to: described.to ?? sectionHref(campaignId, path),
      }
    })
  }
}
