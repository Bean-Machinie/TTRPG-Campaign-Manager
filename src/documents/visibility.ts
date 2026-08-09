/**
 * The one place content visibility is defined.
 *
 * Three tiers, ordered by how much they restrict:
 *
 *   shared       every member of the campaign
 *   gm_only      owners and GMs
 *   author_only  the person who wrote it, and nobody else — not the GM, not
 *                the owner of the campaign
 *
 * `author_only` is the old `campaign_notes.is_private` under a new name, with
 * its meaning intact. A GM keeping secret plot notes and a player keeping their
 * own are the same feature, so neither can read the other's.
 *
 * Note what is *not* here: a `canRead()`. Deciding whether the signed-in user
 * may see something happens in SQL — `public.can_read_visibility()` in the
 * documents migration — so that hidden rows are never fetched in the first
 * place. A client-side equivalent would invite exactly the "load everything,
 * then filter" mistake this design exists to prevent, and would leak through
 * result counts even if the text were stripped.
 */

/** Mirrors the `visibility` check constraint on public.campaign_documents. */
export const VISIBILITY_TIERS = ['shared', 'gm_only', 'author_only'] as const

export type DocumentVisibility = (typeof VISIBILITY_TIERS)[number]

/** Higher restricts more. Used only by mostRestrictive(). */
const RESTRICTION: Record<DocumentVisibility, number> = {
  shared: 0,
  gm_only: 1,
  author_only: 2,
}

/**
 * Combines two visibilities into the one that restricts more.
 *
 * This is the resolver every indexed block goes through: a block inside a
 * `secret` node in an `author_only` document is `author_only`, not `gm_only`.
 * Nesting can only ever narrow the audience, never widen it, so a document's
 * own tier is a floor that its contents cannot rise above.
 */
export function mostRestrictive(
  a: DocumentVisibility,
  b: DocumentVisibility,
): DocumentVisibility {
  return RESTRICTION[a] >= RESTRICTION[b] ? a : b
}

/**
 * The node type that narrows its subtree to `gm_only`.
 *
 * Shared between the walker and the editor extension that renders it, because
 * a disagreement about this string would silently index secrets as shared.
 */
export const SECRET_NODE_TYPE = 'secret'

export const VISIBILITY_LABELS: Record<DocumentVisibility, string> = {
  shared: 'Shared with the party',
  gm_only: 'GMs only',
  author_only: 'Only me',
}

/** The short form, for badges next to a title. */
export const VISIBILITY_BADGES: Record<DocumentVisibility, string | null> = {
  shared: null,
  gm_only: 'GM only',
  author_only: 'Private',
}
