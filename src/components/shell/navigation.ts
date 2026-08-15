import { FileText, MapPin, NotebookPen, ScrollText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ComponentType, Ref } from 'react'
import { CalendarRangeIcon } from './icons/CalendarRangeIcon'
import { CompassIcon } from './icons/CompassIcon'
import { OrbitIcon } from './icons/OrbitIcon'
import { TelescopeIcon } from './icons/TelescopeIcon'
import { UserRoundPenIcon } from './icons/UserRoundPenIcon'
import { UsersIcon } from './icons/UsersIcon'
import type { AnimatedIconHandle } from './icons/types'

/**
 * What a campaign is made of, as one list.
 *
 * This is the single description of the campaign workspace's sections, and both
 * things that navigate read from it: the sidebar draws them as links, the
 * command palette offers them as commands. They used to be a hand-written row
 * of nine NavLinks inside the workspace layout, which is why moving them into
 * the sidebar meant deleting that row rather than keeping two lists in step.
 *
 * `path` is relative to /app/campaigns/:campaignId — empty for the overview,
 * which is the index route.
 */

/** Which CSS hover animation a plain Lucide glyph plays. Defined in icons.css. */
export type IconMotion = 'lift' | 'drop' | 'spin' | 'flip' | 'wiggle' | 'slide' | 'pulse'

/** A lucide-animated component: a drawing that plays a sequence on command. */
export type AnimatedIcon = ComponentType<{
  ref?: Ref<AnimatedIconHandle>
  size?: number
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

/**
 * Two kinds of icon, named apart rather than blurred together.
 *
 * The sections that carry a real gesture — a telescope that scans, a compass
 * needle that swings, layers that fan out — are Motion components, and they are
 * told when to play by the row they sit in. The rest are Lucide glyphs with a
 * CSS keyframe. Keeping the distinction in the type is what lets one renderer
 * handle both without guessing which it was handed.
 */
export type SectionIcon =
  | { kind: 'motion'; component: AnimatedIcon }
  | { kind: 'css'; component: LucideIcon; motion: IconMotion }

export const motionIcon = (component: AnimatedIcon): SectionIcon => ({
  kind: 'motion',
  component,
})

export const cssIcon = (component: LucideIcon, motion: IconMotion): SectionIcon => ({
  kind: 'css',
  component,
  motion,
})

/** Every campaign is reached through this one. */
export const ALL_CAMPAIGNS_ICON = motionIcon(OrbitIcon)

export type CampaignSection = {
  label: string
  path: string
  icon: SectionIcon
  /** Shown under the label in the command palette, where there is room to explain. */
  hint: string
}

export const CAMPAIGN_SECTIONS: CampaignSection[] = [
  {
    label: 'Overview',
    path: '',
    icon: motionIcon(TelescopeIcon),
    hint: 'The campaign at a glance',
  },
  {
    label: 'Sessions',
    path: 'sessions',
    icon: motionIcon(CalendarRangeIcon),
    hint: 'What you played, and what is scheduled',
  },
  {
    label: 'Characters',
    path: 'entities',
    icon: motionIcon(UserRoundPenIcon),
    hint: 'Player characters, NPCs and creatures',
  },
  {
    label: 'Locations',
    path: 'locations',
    icon: cssIcon(MapPin, 'drop'),
    hint: 'Places in the world',
  },
  {
    label: 'Quests',
    path: 'quests',
    icon: cssIcon(ScrollText, 'wiggle'),
    hint: 'Active, completed and abandoned threads',
  },
  {
    label: 'Notes',
    path: 'notes',
    icon: cssIcon(NotebookPen, 'wiggle'),
    hint: 'Shared and private notes',
  },
  {
    label: 'Documents',
    path: 'documents',
    icon: cssIcon(FileText, 'flip'),
    hint: 'Pages, session logs, handouts and lore',
  },
  {
    label: 'Maps',
    path: 'maps',
    icon: motionIcon(CompassIcon),
    hint: 'Uploaded maps, by location',
  },
  {
    label: 'Members',
    path: 'members',
    icon: motionIcon(UsersIcon),
    hint: 'Who is in this campaign, and as what',
  },
]

/** The href for a section of a given campaign. */
export function sectionHref(campaignId: string, path: string) {
  return path ? `/app/campaigns/${campaignId}/${path}` : `/app/campaigns/${campaignId}`
}

/* The tree's row keys. One scheme, so that a key can be built from a route as
   easily as from the row that renders it. */
export const campaignKey = (campaignId: string) => `campaign:${campaignId}`

export const sectionKey = (campaignId: string, path: string) =>
  `section:${campaignId}:${path || 'overview'}`

export const entryKey = (campaignId: string, entryId: string) =>
  `entry:${campaignId}:${entryId}`

/**
 * Expansion policy for activating a section label rather than its chevron.
 * Navigation from elsewhere — including from a record inside that section —
 * opens the destination. Only activating the exact section overview toggles
 * it. Leaf sections have nothing to disclose.
 */
export function expansionAfterSectionActivation<T>(
  expanded: ReadonlySet<T>,
  key: T,
  isOverviewActive: boolean,
  hasChildren: boolean,
): Set<T> {
  const next = new Set(expanded)
  if (!hasChildren) return next

  if (isOverviewActive && next.has(key)) next.delete(key)
  else next.add(key)

  return next
}

/**
 * Whether a route is an entry's own page, or a page inside it.
 *
 * An entry used to be one URL, and this was an equality test. A character is
 * four — `/entities/:id/sheet`, `/features`, `/description`, `/notes` — because
 * reading a character is random access and each section is a place you can link
 * to. Under an equality test the tree stopped marking a character the moment
 * you were actually looking at one, which is the only time it matters.
 *
 * The trailing slash is what keeps it honest: `/documents/doc-12` must not
 * count as being inside `/documents/doc-1`.
 */
export function isEntryRoute(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`)
}

/**
 * What has to be open for a path to be a row somebody can see.
 *
 * The campaign, always. Plus the section holding the entry, when the page you
 * are on belongs to an entry with a page of its own — a document or a character
 * — because arriving there from search or from a link should leave the tree
 * standing open at what you opened rather than one level above it.
 *
 * `to` is what distinguishes the two kinds of entry: a session's row points at
 * the sessions list, so the list *is* the page and nothing needs opening,
 * while a document points at itself. Deliberately the same test the tree uses
 * to decide whether an entry row can be the current one — a row is revealed
 * exactly when it is a row that can be marked.
 */
export function revealedKeys(
  campaignId: string | null,
  entries: Array<{ id: string; to: string }>,
  pathname: string,
): string[] {
  if (!campaignId) return []

  const keys = [campaignKey(campaignId)]

  const entry = entries.find((item) => {
    if (!isEntryRoute(pathname, item.to)) return false
    // `documents:8f2c…` — the section's path is the half in front of the colon.
    return item.to !== sectionHref(campaignId, item.id.split(':')[0])
  })

  if (entry) keys.push(sectionKey(campaignId, entry.id.split(':')[0]))

  return keys
}

/**
 * Initials for a campaign's avatar tile.
 *
 * Two letters from two words, two from one. Campaign names are things like
 * "Curse of Strahd" and "The Sunless Citadel", where the first letters of the
 * first two words are what a reader recognises from across the sidebar.
 */
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
