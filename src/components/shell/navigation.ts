import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  Map,
  MapPin,
  NotebookPen,
  ScrollText,
  UserRoundCog,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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

/** Which hover animation the icon plays. Defined in icons.css. */
export type IconMotion = 'lift' | 'drop' | 'spin' | 'flip' | 'wiggle' | 'slide' | 'pulse'

export type CampaignSection = {
  label: string
  path: string
  icon: LucideIcon
  motion: IconMotion
  /** Shown under the label in the command palette, where there is room to explain. */
  hint: string
}

export const CAMPAIGN_SECTIONS: CampaignSection[] = [
  {
    label: 'Overview',
    path: '',
    icon: LayoutDashboard,
    motion: 'pulse',
    hint: 'The campaign at a glance',
  },
  {
    label: 'Sessions',
    path: 'sessions',
    icon: CalendarDays,
    motion: 'flip',
    hint: 'What you played, and what is scheduled',
  },
  {
    label: 'Characters',
    path: 'characters',
    icon: Users,
    motion: 'lift',
    hint: 'Player characters and NPCs',
  },
  {
    label: 'Locations',
    path: 'locations',
    icon: MapPin,
    motion: 'drop',
    hint: 'Places in the world',
  },
  {
    label: 'Quests',
    path: 'quests',
    icon: ScrollText,
    motion: 'wiggle',
    hint: 'Active, completed and abandoned threads',
  },
  {
    label: 'Notes',
    path: 'notes',
    icon: NotebookPen,
    motion: 'wiggle',
    hint: 'Shared and private notes',
  },
  {
    label: 'Documents',
    path: 'documents',
    icon: FileText,
    motion: 'flip',
    hint: 'Pages, session logs, handouts and lore',
  },
  {
    label: 'Maps',
    path: 'maps',
    icon: Map,
    motion: 'lift',
    hint: 'Uploaded maps, by location',
  },
  {
    label: 'Members',
    path: 'members',
    icon: UserRoundCog,
    motion: 'spin',
    hint: 'Who is in this campaign, and as what',
  },
]

/** The href for a section of a given campaign. */
export function sectionHref(campaignId: string, path: string) {
  return path ? `/app/campaigns/${campaignId}/${path}` : `/app/campaigns/${campaignId}`
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
