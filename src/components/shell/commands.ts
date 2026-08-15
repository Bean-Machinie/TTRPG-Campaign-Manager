import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CampaignSummary } from '../../campaigns/types'
import { ENTITY_KIND_LABELS } from '../../campaigns/types'
import {
  listCampaignDocuments,
  listCampaignEntities,
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
 *   1. where you can go        — every section of every campaign
 *   2. what you belong to      — your campaigns
 *   3. what is *in* a campaign — its sessions, characters, locations, quests,
 *                                notes, documents and maps
 *
 * Search is global. All three reach every campaign you can read, not the one
 * you happen to have navigated into — "where did I write that" is a question
 * you ask precisely when you are not already standing in the answer. Which
 * campaign you are in is a tie-break on the ordering, not a filter on what
 * exists; see groupMatches.
 *
 * What you cannot read is not filtered out here, because it never arrives:
 * every list this module calls is subject to row-level security, so a member
 * gets the campaigns they are in and a private note stays with its author. A
 * visibility check written in this file would be a second, weaker copy of a
 * rule the database already enforces.
 *
 * It is a client-side match over lists the product already loads a page at a
 * time; the indexed search in the plan replaces the matching here without
 * changing what this module is.
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
  /** Which campaign this belongs to, for ranking. Absent on global commands. */
  campaignId?: string
}

/**
 * Matching, and the order results come back in.
 *
 * A name that starts with what was typed beats a name that merely contains it,
 * which beats a match on the kind or the section. Without the ranking, typing
 * "no" puts every note-adjacent hint above the location actually called
 * "Northwatch".
 */
export function groupMatches(
  commands: Command[],
  query: string,
  /** Broken ties go to this campaign. Where you are, in practice. */
  preferCampaignId?: string | null,
): Array<[string, Command[]]> {
  const needle = query.trim().toLowerCase()

  const scored = commands
    .map((command) => ({ command, score: scoreOf(command, needle) }))
    .filter((entry) => entry.score < 3)
    .sort(
      (a, b) =>
        a.score - b.score ||
        localityOf(a.command, preferCampaignId) - localityOf(b.command, preferCampaignId),
    )

  const groups = new Map<string, Command[]>()
  for (const { command } of scored) {
    const bucket = groups.get(command.group)
    if (bucket) bucket.push(command)
    else groups.set(command.group, [command])
  }

  return [...groups]
}

/**
 * The tie-break between two equally good matches.
 *
 * Reaching every campaign is not the same as treating them alike: "the vault"
 * typed mid-session almost always means *this* table's vault, and eight other
 * campaigns' vaults should not be sitting between you and it. It only ever
 * separates rows that already matched equally well, so nothing is buried by
 * being somewhere else — a better match elsewhere still wins outright.
 *
 * Groups are emitted in the order their best row was found, so this is also
 * what floats the campaign you are in to the top of the results.
 */
function localityOf(command: Command, preferCampaignId?: string | null) {
  if (!preferCampaignId) return 0
  return command.campaignId === preferCampaignId ? 0 : 1
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
 * The contents of the campaigns you pass, keyed by campaign.
 *
 * The caller decides *which* campaigns, and the two callers want different
 * sets: a tree loads only what somebody has actually opened, while search
 * loads everything, because a search that reaches one campaign is not a
 * search. Both go through the cache below, so the two of them asking for the
 * same campaign is still one request.
 *
 * Per campaign rather than all-or-nothing, in both directions: a campaign's
 * results appear the moment it lands instead of waiting on the slowest, and
 * one campaign failing to load costs you that campaign rather than the search.
 */
export function useCampaignContents(campaigns: CampaignSummary[]) {
  const [byCampaign, setByCampaign] = useState<Record<string, Command[]>>({})
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  // Which generation of each campaign this hook is holding, rather than merely
  // which ones it has asked for. A set could only say "already fetched", and
  // the thing an invalidation needs to say is "what you fetched is old".
  const loaded = useRef(new Map<string, number>())

  // Re-runs the effect when anything invalidates. The value itself is only a
  // counter; which campaign went stale is answered per campaign below.
  const revision = useSyncExternalStore(subscribeToContents, contentsRevision)

  useEffect(() => {
    for (const campaign of campaigns) {
      const generation = generationOf(campaign.id)
      if (loaded.current.get(campaign.id) === generation) continue

      loaded.current.set(campaign.id, generation)
      setLoadingIds((current) => new Set(current).add(campaign.id))

      void loadCampaignContents(campaign.id, campaign.name)
        .then((items) => {
          setByCampaign((current) => ({ ...current, [campaign.id]: items }))
        })
        .catch(() => {
          setByCampaign((current) => ({ ...current, [campaign.id]: [] }))
        })
        .finally(() => {
          setLoadingIds((current) => {
            const next = new Set(current)
            next.delete(campaign.id)
            return next
          })
        })
    }
  }, [campaigns, revision])

  return { byCampaign, loadingIds }
}

const sectionByPath = new Map(CAMPAIGN_SECTIONS.map((section) => [section.path, section]))

function settledValue<T>(result: PromiseSettledResult<T[]>): T[] {
  return result.status === 'fulfilled' ? result.value : []
}

/**
 * One request per campaign, however many things ask.
 *
 * Three callers want a campaign's contents now — the sidebar's tree, the
 * palette's tree, and the palette's ranked search — and the palette's tree is
 * unmounted and remounted every time the dialog is closed and reopened. Each
 * of those asking on its own meant seven list requests per open. The promise
 * is cached rather than its result, so callers that arrive while one is still
 * in flight join it instead of starting a second.
 *
 * Held for the life of the tab, like the caches it replaces, and dropped on
 * failure so a dropped connection is retried rather than remembered.
 */
const contentsByCampaign = new Map<string, Promise<Command[]>>()

/**
 * How many times each campaign's contents have been thrown away.
 *
 * The cache above is what makes seven callers cost one request; this is what
 * stops it also meaning "and never notices anything changed". Creating a
 * character used to leave the sidebar showing the campaign as it stood when the
 * tab was opened, and the only way to see it was a reload — which reads as the
 * new character not being in the tree at all rather than as a stale cache.
 *
 * A generation per campaign rather than one flag, because a mounted tree has to
 * be able to tell which of the campaigns it is holding is the old one, and a
 * revision counter beside it, because a hook needs something to subscribe to.
 */
const generations = new Map<string, number>()
const contentsListeners = new Set<() => void>()
let revision = 0

/**
 * Forget what this campaign contained, and tell anything showing it.
 *
 * Called after a write that changes what is *in* a campaign — a character
 * created, renamed or deleted — and not after one that only changes what is
 * inside a record, which no row in the tree is showing.
 */
export function invalidateCampaignContents(campaignId: string) {
  contentsByCampaign.delete(campaignId)
  generations.set(campaignId, generationOf(campaignId) + 1)
  revision += 1

  for (const listener of contentsListeners) listener()
}

function generationOf(campaignId: string): number {
  return generations.get(campaignId) ?? 0
}

function subscribeToContents(listener: () => void): () => void {
  contentsListeners.add(listener)
  return () => {
    contentsListeners.delete(listener)
  }
}

function contentsRevision(): number {
  return revision
}

export function loadCampaignContents(
  campaignId: string,
  campaignName: string,
): Promise<Command[]> {
  const pending = contentsByCampaign.get(campaignId)
  if (pending) return pending

  const request = fetchCampaignContents(campaignId, campaignName).catch((error: unknown) => {
    contentsByCampaign.delete(campaignId)
    throw error
  })

  contentsByCampaign.set(campaignId, request)
  return request
}

async function fetchCampaignContents(
  campaignId: string,
  campaignName: string,
): Promise<Command[]> {
  const settled = await Promise.allSettled([
    listCampaignSessions(campaignId),
    listCampaignEntities(campaignId),
    listCampaignLocations(campaignId),
    listCampaignQuests(campaignId),
    listCampaignNotes(campaignId),
    listCampaignDocuments(campaignId),
    listCampaignMaps(campaignId),
  ])

  // Indexed rather than mapped over: allSettled types a tuple, and mapping it
  // would collapse seven element types into one union.
  const sessions = settledValue(settled[0])
  const entities = settledValue(settled[1])
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
    // Entities have pages of their own, so — like documents — the command opens
    // the thing rather than the list it is in.
    ...toCommands(entities, 'entities', group, (item) => ({
      id: item.id,
      label: item.name,
      hint: ENTITY_KIND_LABELS[item.kind],
      to: `${sectionHref(campaignId, 'entities')}/${item.id}`,
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
        campaignId,
      }
    })
  }
}
