import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { newBlockUid } from './ids'

/**
 * Gives every anchorable block a stable identifier.
 *
 * Search results deep-link to a block, and a character offset rots the moment
 * somebody edits a paragraph above it. A uid stored on the node itself moves
 * with the block instead, so `#block-<uid>` still points at the right place
 * after the document is rewritten around it.
 *
 * Three rules, in order of how easy they are to get wrong:
 *
 *   1. An existing uid is never changed. Editing a paragraph must not break
 *      every link to it.
 *   2. A new block gets a new uid.
 *   3. A duplicate uid is replaced. Pasting a block copies its `data-uid`
 *      along with everything else, and two blocks answering to one anchor
 *      would fight over it — the index has `unique (document_id, block_uid)`,
 *      and a link would land on whichever came first.
 */

export const UID_ATTRIBUTE = 'uid'

/**
 * The nodes that carry an anchor.
 *
 * These are the block types with inline content — the ones the walker turns
 * into index rows. Containers such as blockquotes and tables are not anchored
 * because links target their text cells instead.
 *
 * This list is the one thing that has to be maintained by hand when a block
 * node is added. `walkDocument()` decides what to index structurally, so it
 * needs no such list — but a node it indexes that is missing from here quietly
 * falls back to a positional uid, and positional anchors rot on edit.
 */
const ANCHORED_TYPES = [
  'paragraph',
  'heading',
  'codeBlock',
  'readAloud',
  'secret',
]

/**
 * Builds a transaction giving every anchored node a unique uid, or returns null
 * when they all already have one — which is the usual case, so this walk stays
 * cheap on ordinary keystrokes.
 *
 * Exported so the tests can drive it against a headless editor state. The
 * three rules above are the ones worth pinning down, and doing it through a
 * real browser would test the browser.
 */
export function assignUids(state: EditorState): Transaction | null {
  const anchored = new Set(ANCHORED_TYPES)
  const seen = new Set<string>()
  const tr = state.tr
  let changed = false

  state.doc.descendants((node, pos) => {
    if (!anchored.has(node.type.name)) return

    const uid: unknown = node.attrs[UID_ATTRIBUTE]

    if (typeof uid === 'string' && uid.length > 0 && !seen.has(uid)) {
      seen.add(uid)
      return
    }

    const fresh = newBlockUid()
    seen.add(fresh)

    // Changing an attribute does not change a node's size, so the positions
    // this walk is handing out stay valid as the transaction accumulates steps.
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, [UID_ATTRIBUTE]: fresh })
    changed = true
  })

  if (!changed) return null

  // Bookkeeping, not something the writer did. Undo should step back over the
  // edit that created the block, not over the block being given a name.
  return tr.setMeta('addToHistory', false)
}

export const BlockUid = Extension.create({
  name: 'blockUid',

  addGlobalAttributes() {
    return [
      {
        types: ANCHORED_TYPES,
        attributes: {
          [UID_ATTRIBUTE]: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-uid'),
            renderHTML: (attributes) =>
              attributes[UID_ATTRIBUTE]
                ? { 'data-uid': attributes[UID_ATTRIBUTE] as string }
                : {},
            // Splitting a paragraph with Enter produces a second block, and a
            // second block is a new block. Without this both halves would
            // answer to the original anchor until the duplicate check below
            // caught it.
            keepOnSplit: false,
          },
        },
      },
    ]
  },

  onCreate() {
    // Content loaded straight into the editor arrives without a transaction, so
    // the plugin below never sees it. Documents written before this extension
    // existed get their uids here, on first open.
    const tr = assignUids(this.editor.state)
    if (tr) this.editor.view.dispatch(tr)
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockUid'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) return null
          return assignUids(newState)
        },
      }),
    ]
  },
})
