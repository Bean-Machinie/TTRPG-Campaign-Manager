import type { Editor, Range } from '@tiptap/core'
import {
  Code,
  EyeOff,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Speech,
  Table,
  TextQuote,
  Type,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * What `/` can insert.
 *
 * Two groups. The ordinary blocks are the ones any editor has; the campaign
 * group is the reason this is not a Notion clone. Entity mentions, stat blocks
 * and dice belong to the entities phase and are deliberately absent — they need
 * campaign_entities to exist before they can mean anything.
 *
 * Each item carries its glyph. A list of ten titles in the same weight at the
 * same indent is read word by word every time it opens; a column of pictures is
 * read once and then recognised, which is what a menu you use fifty times an
 * hour has to be. The same glyph names the same block in the cell menu, so
 * "turn this into read-aloud" and "insert read-aloud" look like the same thing,
 * because they are.
 */

export type SlashItem = {
  title: string
  description: string
  /** Drawn at 16px in the menu, and again in the cell menu's "Turn into". */
  icon: LucideIcon
  /** Extra words that should match this item, beyond its title. */
  keywords: string[]
  run: (editor: Editor, range: Range) => void
}

export type SlashGroup = {
  name: string
  items: SlashItem[]
}

/** Everything runs through one chain so the `/query` text is always replaced. */
const at = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range)

const BASIC: SlashItem[] = [
  {
    title: 'Text',
    description: 'Plain paragraph',
    icon: Type,
    keywords: ['paragraph', 'body', 'p'],
    run: (editor, range) => at(editor, range).setNode('paragraph').run(),
  },
  {
    title: 'Heading 1',
    description: 'Top-level section',
    icon: Heading1,
    keywords: ['h1', 'title', 'large'],
    run: (editor, range) => at(editor, range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Section',
    icon: Heading2,
    keywords: ['h2', 'subtitle'],
    run: (editor, range) => at(editor, range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Subsection',
    icon: Heading3,
    keywords: ['h3'],
    run: (editor, range) => at(editor, range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Quote',
    description: 'Set a passage apart',
    icon: TextQuote,
    keywords: ['blockquote', 'citation'],
    run: (editor, range) => at(editor, range).toggleBlockquote().run(),
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: Minus,
    keywords: ['hr', 'separator', 'line', 'break'],
    run: (editor, range) => at(editor, range).setHorizontalRule().run(),
  },
  {
    title: 'Code',
    description: 'Monospaced block',
    icon: Code,
    keywords: ['pre', 'snippet'],
    run: (editor, range) => at(editor, range).toggleCodeBlock().run(),
  },
  {
    title: 'Table',
    description: 'Three by three, with a header row',
    icon: Table,
    keywords: ['grid', 'rows', 'columns'],
    run: (editor, range) =>
      at(editor, range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
]

const CAMPAIGN: SlashItem[] = [
  {
    title: 'GM secret',
    description: 'Hidden from the players',
    icon: EyeOff,
    keywords: ['gm', 'hidden', 'private', 'spoiler', 'dm'],
    // Produces exactly the node the walker already resolves to gm_only. The
    // command lives on the secret extension, so there is one definition of what
    // a secret is and this is only a way of reaching it.
    run: (editor, range) => at(editor, range).toggleSecret().run(),
  },
  {
    title: 'Read-aloud',
    description: 'Boxed text to read to the party',
    icon: Speech,
    keywords: ['boxed', 'description', 'narration', 'flavour', 'flavor'],
    run: (editor, range) => at(editor, range).toggleReadAloud().run(),
  },
]

export const SLASH_GROUPS: SlashGroup[] = [
  { name: 'Blocks', items: BASIC },
  { name: 'Campaign', items: CAMPAIGN },
]

function matches(item: SlashItem, query: string): boolean {
  if (query.length === 0) return true

  const needle = query.toLowerCase()
  if (item.title.toLowerCase().includes(needle)) return true
  return item.keywords.some((keyword) => keyword.includes(needle))
}

/** Filters the groups, dropping any that end up empty. */
export function filterSlashGroups(query: string, canWriteSecrets = true): SlashGroup[] {
  return SLASH_GROUPS.map((group) => ({
    name: group.name,
    items: group.items.filter(
      (item) => (canWriteSecrets || item.title !== 'GM secret') && matches(item, query),
    ),
  })).filter((group) => group.items.length > 0)
}

/** The filtered items as one list, which is what arrow keys move through. */
export function flattenGroups(groups: SlashGroup[]): SlashItem[] {
  return groups.flatMap((group) => group.items)
}
