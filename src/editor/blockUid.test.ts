import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/core'
import { EditorState } from '@tiptap/pm/state'
import { UID_ATTRIBUTE, assignUids } from './blockUid'
import { SCHEMA_EXTENSIONS } from './extensions'

/**
 * Driven headlessly. A ProseMirror schema and state need no DOM, and the three
 * rules worth pinning down — keep, create, replace-duplicate — are all
 * decisions about a document tree rather than about a browser.
 *
 * Built from the editor's own extension list rather than a list of its own, so
 * a node type added to the editor is a node type these tests already see.
 */

const schema = getSchema(SCHEMA_EXTENSIONS)

const ANCHORED = new Set(['paragraph', 'heading', 'codeBlock', 'readAloud', 'detailsSummary'])

type Json = Parameters<typeof schema.nodeFromJSON>[0]

function stateFrom(json: Json): EditorState {
  return EditorState.create({ doc: schema.nodeFromJSON(json) })
}

function paragraph(text: string, uid?: string) {
  return {
    type: 'paragraph',
    attrs: uid ? { [UID_ATTRIBUTE]: uid } : {},
    content: [{ type: 'text', text }],
  }
}

/** Runs one assignment pass and returns the resulting state. */
function assigned(state: EditorState): EditorState {
  const transaction = assignUids(state)
  return transaction ? state.apply(transaction) : state
}

function uids(state: EditorState): (string | null)[] {
  const found: (string | null)[] = []

  state.doc.descendants((node) => {
    if (ANCHORED.has(node.type.name)) {
      found.push(node.attrs[UID_ATTRIBUTE] as string | null)
    }
  })

  return found
}

describe('assignUids', () => {
  it('gives a new block a uid', () => {
    const state = assigned(stateFrom({ type: 'doc', content: [paragraph('Fresh')] }))

    expect(uids(state)[0]).toMatch(/^[0-9a-z]{12}$/)
  })

  it('leaves an existing uid alone', () => {
    // Every saved search result points at this string. Changing it on edit
    // would break the link without anything appearing to go wrong.
    const state = assigned(
      stateFrom({ type: 'doc', content: [paragraph('Anchored', 'keepme12345a')] }),
    )

    expect(uids(state)[0]).toBe('keepme12345a')
  })

  it('does nothing when every block already has a distinct uid', () => {
    const state = stateFrom({
      type: 'doc',
      content: [paragraph('One', 'aaaaaaaaaaaa'), paragraph('Two', 'bbbbbbbbbbbb')],
    })

    expect(assignUids(state)).toBeNull()
  })

  it('replaces the duplicate when a block is pasted', () => {
    // Pasting carries `data-uid` along with the content, so two blocks arrive
    // claiming the same anchor. The first keeps it; the copy gets a new one.
    const state = assigned(
      stateFrom({
        type: 'doc',
        content: [paragraph('Original', 'shared123456'), paragraph('Pasted copy', 'shared123456')],
      }),
    )

    const [first, second] = uids(state)
    expect(first).toBe('shared123456')
    expect(second).not.toBe('shared123456')
    expect(second).toMatch(/^[0-9a-z]{12}$/)
  })

  it('keeps a uid across an edit to the text', () => {
    const before = assigned(stateFrom({ type: 'doc', content: [paragraph('Ravenhold')] }))
    const original = uids(before)[0]

    const edited = before.apply(before.tr.insertText(' Keep', before.doc.content.size - 1))

    expect(assignUids(edited)).toBeNull()
    expect(uids(edited)[0]).toBe(original)
  })

  // Three new ways into the document arrived with the block editor. Each is a
  // path that could quietly break every saved anchor in a document.

  it('preserves uids when a block is dragged to a new position', () => {
    const state = assigned(
      stateFrom({
        type: 'doc',
        content: [paragraph('One'), paragraph('Two'), paragraph('Three')],
      }),
    )

    const [first, second, third] = uids(state)

    // What a drag-reorder does: lift the node out, put it back elsewhere.
    const moving = state.doc.child(0)
    const transaction = state.tr.delete(0, moving.nodeSize)
    const reordered = state.apply(transaction.insert(transaction.doc.content.size, moving))

    // Reordering is not a new block, so nothing should be reassigned.
    expect(assignUids(reordered)).toBeNull()
    expect(uids(reordered)).toEqual([second, third, first])
  })

  it('gives a duplicated block a fresh uid', () => {
    const state = stateFrom({ type: 'doc', content: [paragraph('Original', 'dupe12345678')] })

    // What the block menu's Duplicate does: insert the node's own JSON after it.
    const node = state.doc.child(0)
    const duplicated = state.apply(state.tr.insert(node.nodeSize, node))

    const [first, second] = uids(assigned(duplicated))
    expect(first).toBe('dupe12345678')
    expect(second).not.toBe('dupe12345678')
  })

  it('anchors read-aloud text and toggle summaries', () => {
    const state = assigned(
      stateFrom({
        type: 'doc',
        content: [
          { type: 'readAloud', content: [{ type: 'text', text: 'Cold air.' }] },
          {
            type: 'details',
            content: [
              { type: 'detailsSummary', content: [{ type: 'text', text: 'Rumours' }] },
              { type: 'detailsContent', content: [paragraph('The well is cursed.')] },
            ],
          },
        ],
      }),
    )

    const found = uids(state)
    expect(found).toHaveLength(3)
    for (const uid of found) expect(uid).toMatch(/^[0-9a-z]{12}$/)
  })

  it('anchors blocks inside a secret as well as outside it', () => {
    const state = assigned(
      stateFrom({
        type: 'doc',
        content: [
          paragraph('Shared'),
          { type: 'secret', content: [paragraph('Hidden')] },
        ],
      }),
    )

    const found = uids(state)
    expect(found).toHaveLength(2)
    expect(new Set(found).size).toBe(2)
    for (const uid of found) expect(uid).toMatch(/^[0-9a-z]{12}$/)
  })
})
