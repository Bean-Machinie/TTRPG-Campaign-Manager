import StarterKit from '@tiptap/starter-kit'
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'
import { TableKit } from '@tiptap/extension-table'
import type { AnyExtension } from '@tiptap/core'
import { BlockUid } from './blockUid'
import { ReadAloud } from './readAloudBlock'
import { Secret } from './secretBlock'

/**
 * Everything that defines the document's shape.
 *
 * Kept apart from the editor component because the schema is not a UI concern:
 * the walker tests build a headless ProseMirror schema from this exact list, so
 * a node added to the editor and forgotten in the tests is not possible.
 *
 * Extensions that only affect behaviour or chrome — the placeholder, the slash
 * command — are added by DocumentEditor instead. They cannot change what a
 * saved document contains, so tests do not need them.
 */
export const SCHEMA_EXTENSIONS: AnyExtension[] = [
  StarterKit,
  BlockUid,
  Secret,
  ReadAloud,
  // A toggle. `details` holds a `detailsSummary` and a `detailsContent`, so the
  // walker sees the summary as a text block and descends into the body.
  Details.configure({ persist: true, HTMLAttributes: { class: 'toggle-block' } }),
  DetailsSummary,
  DetailsContent,
  TableKit.configure({ table: { resizable: true } }),
]
