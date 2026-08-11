import { useEffect, useRef, useState } from 'react'
import {
  listCampaignCharacters,
  listCampaignDocuments,
  listCampaignLocations,
  listCampaignMaps,
  listCampaignNotes,
  listCampaignQuests,
  listCampaignSessions,
} from '../../campaigns/campaignsApi'
import { ALL_CAMPAIGNS_ICON, CAMPAIGN_SECTIONS, sectionHref } from './navigation'
import type { SectionIcon } from './navigation'

/**
 * What search can find, and how it is ranked.
 *
 * The palette's data, kept apart from the palette's chrome: one file decides
 * what a result *is*, the other decides what a result looks like. Three sources
 * are merged by the component that renders them:
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
 * this module is.
 *
 * Nothing is fetched until the palette opens. A GM who never presses ⌘K never
 * pays for it.
 */
export type Command = {
  id: string
  label: string
  /** The muted half of the row. What kind of thing this is, mostly. */
  hint: string
  group: string
  icon: SectionIcon
  to: string
  /** Shown instead of an icon, for campaigns. */
  initials?: string
}

/**
 * Matching, and the order results come back in.
 *
 * A name that starts with what was typed beats a name that merely contains it,
 * which beats a match on the kind or the section. Without the ranking, typing
 * "no" puts every note-adjacent hint above the location actually called
 * "Northwatch".
 */
export function groupMatches(commands: Command[], query: string): Array<[string, Command[]]> {
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
export function useCampaignContents(campaignId: string | null, campaignName: string) {
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
        icon: section?.icon ?? ALL_CAMPAIGNS_ICON,
        to: described.to ?? sectionHref(campaignId, path),
      }
    })
  }
}
