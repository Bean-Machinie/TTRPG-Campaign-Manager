import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { EditorState } from '@tiptap/pm/state'
import { UID_ATTRIBUTE, assignUids, BlockUid } from './blockUid'
import { Secret } from './secretBlock'

/**
 * Driven headlessly. A ProseMirror schema and state need no DOM, and the three
 * rules worth pinning down — keep, create, replace-duplicate — are all
 * decisions about a document tree rather than about a browser.
 */

const schema = getSchema([StarterKit, BlockUid, Secret])

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
    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
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
