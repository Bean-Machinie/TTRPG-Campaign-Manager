import { SECRET_NODE_TYPE, mostRestrictive } from './visibility'
import type { DocumentVisibility } from './visibility'

/**
 * Turns a ProseMirror document into the rows the block index is built from.
 *
 * A pure function on purpose: no database, no Supabase client, no clock. It is
 * the piece the whole search feature rests on — anchors, snippets and secret
 * isolation are all decided here — so it has to be testable with nothing but a
 * literal and an expectation.
 *
 * Indexing per block rather than per document is the central choice. It makes
 * a result point at a paragraph instead of a four-thousand-word session log,
 * and it means GM-only text lives in rows a player's query never selects, so
 * snippet generation physically cannot reach it.
 */

/** The subset of the ProseMirror JSON shape this walker reads. */
export type ProseMirrorNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: ProseMirrorNode[]
  text?: string
}

/** One row of the block index. Mirrors public.document_blocks. */
export type IndexedBlock = {
  blockUid: string
  /** Position in the document, from 0. Orders results within a document. */
  ordinal: number
  nodeType: string
  /** Breadcrumb of the headings above this block, e.g. 'Session 12 > The Vault'. */
  headingPath: string | null
  /** Flattened plain text. What gets searched and excerpted. */
  text: string
  visibility: DocumentVisibility
}

export type WalkResult = {
  blocks: IndexedBlock[]
  // `references` joins this shape once entities exist. The mention nodes it
  // reads do not exist yet, so returning an empty list would be a promise the
  // walker cannot keep; the field is added with the feature.
}

/**
 * Nodes that live *inside* a block rather than being one.
 *
 * A node whose children are all inline is a block to index; a node with a
 * block child is a container to descend into. Deciding it this way rather than
 * listing every block type means a new custom node — a stat block, a table —
 * is indexed correctly without the walker knowing it exists.
 */
const INLINE_TYPES = new Set(['text', 'hardBreak'])

/** Separates heading levels in `headingPath`. */
const HEADING_SEPARATOR = ' > '

function isInline(node: ProseMirrorNode): boolean {
  return INLINE_TYPES.has(node.type)
}

/** Flattens a block's inline children into one searchable string. */
function flattenText(node: ProseMirrorNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return ' '

  // Marks split text: "Blackthorn" with "thorn" italicised is two text nodes.
  // Joining without a separator is what puts it back together, and is why the
  // in-document search has to match against a flattened string too.
  return (node.content ?? []).map(flattenText).join('')
}

/**
 * A block's stable anchor, for nodes the uid extension has not reached yet —
 * content written before that extension existed, or JSON assembled by hand.
 *
 * Derived from the ordinal rather than generated, because a pure function
 * cannot invent randomness and a fresh id on every save would break every
 * saved link. It is a degraded anchor: it survives edits below it and not
 * edits above it. Normal documents never use it.
 */
function fallbackUid(ordinal: number): string {
  return `ord-${ordinal}`
}

type WalkState = {
  blocks: IndexedBlock[]
  /** The heading texts above the cursor, outermost first. */
  headings: string[]
  /** Uids already used in this document, so a duplicate cannot be emitted. */
  seenUids: Set<string>
}

function headingPath(state: WalkState): string | null {
  // Skipped levels leave gaps in the stack — an h3 under an h1 with no h2. They
  // hold the shape of the stack together but have no place in a breadcrumb.
  const path = state.headings.filter((heading) => heading.length > 0)
  return path.length > 0 ? path.join(HEADING_SEPARATOR) : null
}

/**
 * The uid to index this block under.
 *
 * Duplicates should not reach here — the editor extension regenerates a uid on
 * paste — but `unique (document_id, block_uid)` on the index means a duplicate
 * that slipped through would fail the whole reindex rather than one block. The
 * last block to claim a uid yields it instead.
 */
function claimUid(node: ProseMirrorNode, ordinal: number, state: WalkState): string {
  const attr = node.attrs?.uid
  const uid = typeof attr === 'string' && attr.length > 0 ? attr : fallbackUid(ordinal)

  if (!state.seenUids.has(uid)) {
    state.seenUids.add(uid)
    return uid
  }

  const deduped = `${uid}-${ordinal}`
  state.seenUids.add(deduped)
  return deduped
}

function visit(node: ProseMirrorNode, inherited: DocumentVisibility, state: WalkState): void {
  // Visibility is resolved on the way down, so a block never has to work out
  // where it sits. Nesting narrows: a `secret` inside an `author_only`
  // document stays `author_only`, because mostRestrictive() says so.
  const visibility =
    node.type === SECRET_NODE_TYPE ? mostRestrictive(inherited, 'gm_only') : inherited

  const children = node.content ?? []

  // No children: an empty paragraph, or a leaf like a horizontal rule. Nothing
  // to search, so nothing to index — an empty row would be a result that can
  // never match and a snippet that is always blank.
  if (children.length === 0) return

  if (!children.every(isInline)) {
    for (const child of children) visit(child, visibility, state)
    return
  }

  const text = flattenText(node)
  if (text.trim().length === 0) return

  const ordinal = state.blocks.length

  state.blocks.push({
    blockUid: claimUid(node, ordinal, state),
    ordinal,
    nodeType: node.type,
    // The path is read before the heading is pushed, so a heading is
    // breadcrumbed by its ancestors and not by itself.
    headingPath: headingPath(state),
    text,
    visibility,
  })

  if (node.type === 'heading') {
    // A level-2 heading replaces everything from level 2 down. Levels can be
    // skipped, so the stack is padded rather than indexed into blindly.
    const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1
    state.headings.length = Math.min(state.headings.length, level - 1)
    while (state.headings.length < level - 1) state.headings.push('')
    state.headings.push(text)
  }
}

/**
 * Walks a document and returns its blocks.
 *
 * `documentVisibility` is the row's own flag, and acts as a floor: no block can
 * end up more widely visible than the document containing it.
 */
export function walkDocument(
  doc: ProseMirrorNode,
  documentVisibility: DocumentVisibility = 'shared',
): WalkResult {
  const state: WalkState = { blocks: [], headings: [], seenUids: new Set() }

  for (const child of doc.content ?? []) {
    visit(child, documentVisibility, state)
  }

  return { blocks: state.blocks }
}
