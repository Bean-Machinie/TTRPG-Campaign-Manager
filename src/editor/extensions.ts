import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import type { AnyExtension } from '@tiptap/core'
import { BlockUid } from './blockUid'
import { ReadAloud } from './readAloudBlock'
import { Secret } from './secretBlock'
import { CellBehavior } from './cellBehavior'

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
  StarterKit.configure({
    // Lists are lines inside a cell in this editor, never container nodes that
    // become a second kind of draggable cell.
    bulletList: false,
    orderedList: false,
    listItem: false,
    listKeymap: false,
  }),
  BlockUid,
  Secret,
  ReadAloud,
  CellBehavior,
  TableKit.configure({ table: { resizable: true } }),
]
