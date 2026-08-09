import type { Editor, Range } from '@tiptap/core'

/**
 * What `/` can insert.
 *
 * Two groups. The ordinary blocks are the ones any editor has; the campaign
 * group is the reason this is not a Notion clone. Entity mentions, stat blocks
 * and dice belong to the entities phase and are deliberately absent — they need
 * campaign_entities to exist before they can mean anything.
 */

export type SlashItem = {
  title: string
  description: string
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
    keywords: ['paragraph', 'body', 'p'],
    run: (editor, range) => at(editor, range).setNode('paragraph').run(),
  },
  {
    title: 'Heading 1',
    description: 'Top-level section',
    keywords: ['h1', 'title', 'large'],
    run: (editor, range) => at(editor, range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Section',
    keywords: ['h2', 'subtitle'],
    run: (editor, range) => at(editor, range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Subsection',
    keywords: ['h3'],
    run: (editor, range) => at(editor, range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Quote',
    description: 'Set a passage apart',
    keywords: ['blockquote', 'citation'],
    run: (editor, range) => at(editor, range).toggleBlockquote().run(),
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    keywords: ['hr', 'separator', 'line', 'break'],
    run: (editor, range) => at(editor, range).setHorizontalRule().run(),
  },
  {
    title: 'Code',
    description: 'Monospaced block',
    keywords: ['pre', 'snippet'],
    run: (editor, range) => at(editor, range).toggleCodeBlock().run(),
  },
  {
    title: 'Table',
    description: 'Three by three, with a header row',
    keywords: ['grid', 'rows', 'columns'],
    run: (editor, range) =>
      at(editor, range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
]

const CAMPAIGN: SlashItem[] = [
  {
    title: 'GM secret',
    description: 'Hidden from the players',
    keywords: ['gm', 'hidden', 'private', 'spoiler', 'dm'],
    // Produces exactly the node the walker already resolves to gm_only. The
    // command lives on the secret extension, so there is one definition of what
    // a secret is and this is only a way of reaching it.
    run: (editor, range) => at(editor, range).toggleSecret().run(),
  },
  {
    title: 'Read-aloud',
    description: 'Boxed text to read to the party',
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
