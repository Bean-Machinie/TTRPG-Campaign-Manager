import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorView } from '@tiptap/pm/view'
import { cellId } from './cells'

/**
 * How anything outside ProseMirror is allowed to style a cell.
 *
 * ProseMirror owns the DOM it rendered, and it means it: its mutation observer
 * treats a class or a style written onto a node from outside as corruption and
 * rebuilds that node from the document, throwing the change away and replacing
 * the element. Anything holding a reference to it is then holding a detached
 * node. Sorting cannot work that way — a drag is a hundred style writes.
 *
 * Decorations are the sanctioned channel: presentation ProseMirror applies
 * itself, patched onto the existing element rather than through a rebuild, and
 * derived from state so a redraw cannot lose it. So the sorter does not write to
 * the cells at all. It says what each cell should look like, and this plugin is
 * what puts it there.
 *
 * Cells are addressed by id rather than by position, because a decoration set
 * outlives the state it was set in.
 */

/** The presentation of one cell. Both fields are raw HTML attribute values. */
export type CellDecoration = {
  class?: string
  /** A declaration list, e.g. `transform: translate3d(0, 12px, 0);`. */
  style?: string
}

/** Cells to change, by id. A null entry clears the cell's decoration. */
type CellDecorationPatch = Record<string, CellDecoration | null>

const cellDecorationsKey = new PluginKey<Record<string, CellDecoration>>('cellDecorations')

type Outbox = {
  /** What each cell was last told to look like, so unchanged cells cost nothing. */
  sent: Map<string, string>
  patch: Map<string, CellDecoration | null>
  scheduled: boolean
}

const outboxes = new WeakMap<EditorView, Outbox>()

function signature(decoration: CellDecoration | null): string {
  return decoration ? `${decoration.class ?? ''}|${decoration.style ?? ''}` : ''
}

function flush(view: EditorView) {
  const outbox = outboxes.get(view)
  if (!outbox) return

  outbox.scheduled = false
  if (outbox.patch.size === 0 || view.isDestroyed) return

  const patch = Object.fromEntries(outbox.patch) as CellDecorationPatch
  outbox.patch.clear()

  // Not an edit, so it is not undoable and not worth saving. A reorder is; that
  // one goes through moveCell() as a real transaction.
  view.dispatch(
    view.state.tr.setMeta(cellDecorationsKey, patch).setMeta('addToHistory', false),
  )
}

/**
 * Queues a change to how one cell looks.
 *
 * Coalesced into a single transaction per frame. A drag touches the cell being
 * moved on every pointer event and its neighbours whenever the pointer crosses
 * one, and the components deciding those two things do not know about each
 * other — batching here is what keeps that from becoming a transaction each.
 */
export function setCellDecoration(
  view: EditorView,
  id: string,
  decoration: CellDecoration | null,
): void {
  let outbox = outboxes.get(view)
  if (!outbox) {
    outbox = { sent: new Map(), patch: new Map(), scheduled: false }
    outboxes.set(view, outbox)
  }

  const next = signature(decoration)
  if ((outbox.sent.get(id) ?? '') === next) return

  if (decoration) outbox.sent.set(id, next)
  else outbox.sent.delete(id)
  outbox.patch.set(id, decoration)

  if (outbox.scheduled) return
  outbox.scheduled = true
  // A microtask, not a frame: this runs after React has committed and before
  // the browser paints, so a cell and the handle dragging it move together.
  queueMicrotask(() => flush(view))
}

/** Whether a transaction is only this plugin talking to itself. */
export function isCellDecorationTransaction(transaction: { getMeta: (key: PluginKey) => unknown }) {
  return transaction.getMeta(cellDecorationsKey) !== undefined
}

export const CellDecorations = Extension.create({
  name: 'cellDecorations',

  addProseMirrorPlugins() {
    return [
      new Plugin<Record<string, CellDecoration>>({
        key: cellDecorationsKey,

        state: {
          init: () => ({}),
          apply: (transaction, decorations) => {
            const patch = transaction.getMeta(cellDecorationsKey) as CellDecorationPatch | undefined
            if (!patch) return decorations

            const next = { ...decorations }
            for (const [id, decoration] of Object.entries(patch)) {
              if (decoration) next[id] = decoration
              else delete next[id]
            }

            return next
          },
        },

        props: {
          decorations(state) {
            const decorations = cellDecorationsKey.getState(state)
            if (!decorations || Object.keys(decorations).length === 0) return null

            const applied: Decoration[] = []

            state.doc.forEach((node, pos) => {
              const decoration = decorations[cellId(node, pos)]
              if (!decoration) return

              const attributes: Record<string, string> = {}
              if (decoration.class) attributes.class = decoration.class
              if (decoration.style) attributes.style = decoration.style
              if (Object.keys(attributes).length === 0) return

              applied.push(Decoration.node(pos, pos + node.nodeSize, attributes))
            })

            return DecorationSet.create(state.doc, applied)
          },
        },
      }),
    ]
  },
})
