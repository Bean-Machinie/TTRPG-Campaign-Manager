import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'

/**
 * The document, read as a list of cells.
 *
 * ProseMirror thinks in positions: a cell is "the top-level node covering
 * offset 412". dnd-kit thinks in identified items: a cell is "the item with id
 * `k3f9…`, currently third". This module is the translation between the two, and
 * it is the only place that knows both vocabularies — the sorter below never
 * touches a document position, and the editor never hears about an item id.
 *
 * Cells are top-level nodes and nothing else. Nesting is deliberately not a
 * thing here: a list is lines inside a cell, a secret is a cell, and there is no
 * container that becomes a second kind of draggable. One flat list is what makes
 * the reorder a single `delete` + `insert` instead of a tree operation.
 */

export type Cell = {
  /**
   * Stable while the cell exists, which is what dnd-kit needs to track an item
   * across the re-renders of a drag.
   */
  id: string
  /** Index among the document's top-level children. */
  index: number
  /** Document position of the node's start. Valid only for the current state. */
  pos: number
  node: ProseMirrorNode
  /** The DOM ProseMirror rendered for it. dnd-kit measures and moves this. */
  element: HTMLElement
}

/**
 * Most cells already carry a `uid` for search anchors, and reusing it means a
 * cell keeps its identity across an edit rather than being torn down and
 * remounted on every keystroke.
 *
 * Containers — blockquotes, tables, rules — have no uid, because links target
 * the text cells inside them. They fall back to their position, which is unique
 * within a state and stable for the length of a drag, since the document cannot
 * change while a pointer is holding a handle.
 */
export function cellId(node: ProseMirrorNode, pos: number): string {
  const uid: unknown = node.attrs.uid
  return typeof uid === 'string' && uid.length > 0 ? uid : `cell@${pos}`
}

/** Snapshots the current cells, in document order. */
export function readCells(editor: Editor): Cell[] {
  const cells: Cell[] = []

  editor.state.doc.forEach((node, pos, index) => {
    const element = editor.view.nodeDOM(pos)
    // A node ProseMirror has not rendered yet cannot be measured or moved, so
    // it is not a cell as far as sorting is concerned.
    if (element instanceof HTMLElement) {
      cells.push({ id: cellId(node, pos), index, pos, node, element })
    }
  })

  return cells
}

/**
 * Whether two snapshots describe the same cells.
 *
 * Every transaction produces a fresh snapshot, including the ones that only
 * moved the caret. Without this the whole sorter would re-render on each
 * keystroke, and dnd-kit would remeasure a list that had not changed.
 */
export function sameCells(a: Cell[], b: Cell[]): boolean {
  return (
    a.length === b.length &&
    a.every((cell, index) => cell.id === b[index].id && cell.element === b[index].element)
  )
}

/**
 * Looks a cell up again by id.
 *
 * The menu actions go through this rather than closing over the position they
 * were rendered with. A position is a fact about one editor state; by the time
 * a menu item is clicked, autosave, uid assignment, or the writer's own typing
 * may have produced several more.
 */
export function findCell(editor: Editor, id: string): Omit<Cell, 'element'> | null {
  let found: Omit<Cell, 'element'> | null = null

  editor.state.doc.forEach((node, pos, index) => {
    if (found) return
    if (cellId(node, pos) === id) found = { id, index, pos, node }
  })

  return found
}

/** The cell holding the caret, so it can be marked as the one being written in. */
export function currentCellId(editor: Editor): string | null {
  const { $from } = editor.state.selection
  if ($from.depth === 0) return null

  const pos = $from.before(1)
  const node = editor.state.doc.nodeAt(pos)
  return node ? cellId(node, pos) : null
}

/**
 * The transaction that moves a cell to another index, or null if there is
 * nothing to move.
 *
 * Cut then paste, in that order, with the destination mapped through the cut.
 * Doing it as one transaction is what keeps a reorder one step in the undo
 * history — two would take two Ctrl-Z presses to put back, and the writer would
 * watch the cell land somewhere it had never been on the way.
 *
 * Separated from the dispatch below so it can be tested against a headless
 * state: which cell ends up where is a fact about a document, not a browser.
 */
export function cellMoveTransaction(
  state: EditorState,
  fromIndex: number,
  toIndex: number,
): Transaction | null {
  const { doc } = state
  if (fromIndex === toIndex) return null
  if (fromIndex < 0 || toIndex < 0) return null
  if (fromIndex >= doc.childCount || toIndex >= doc.childCount) return null

  const ranges: Array<{ from: number; to: number }> = []
  doc.forEach((node, pos, index) => {
    ranges[index] = { from: pos, to: pos + node.nodeSize }
  })

  const source = ranges[fromIndex]
  const target = ranges[toIndex]
  const node = doc.child(fromIndex)

  // Dragged down, the cell lands after the cell it passed; dragged up, before
  // it. This is the rule the sorting animation was showing during the gesture,
  // so the drop confirms what was already on screen.
  const boundary = toIndex > fromIndex ? target.to : target.from

  const tr = state.tr.delete(source.from, source.to)
  tr.insert(tr.mapping.map(boundary), node)
  return tr.scrollIntoView()
}

/** Moves a cell to another index. */
export function moveCell(editor: Editor, fromIndex: number, toIndex: number): void {
  const tr = cellMoveTransaction(editor.state, fromIndex, toIndex)
  if (tr) editor.view.dispatch(tr)
}
