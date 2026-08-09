import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/core'
import { EditorState } from '@tiptap/pm/state'
import { SCHEMA_EXTENSIONS } from './extensions'
import { cellId, cellMoveTransaction } from './cells'

/**
 * Driven headlessly. Where a dragged cell lands is a fact about a document, and
 * proving it through a browser would mostly be testing dnd-kit's pointer maths —
 * which dnd-kit already tests. What has to hold here is narrower and easier to
 * get wrong: dragged down, a cell lands *after* the cell it passed; dragged up,
 * *before* it. Off by one in either direction and the drop contradicts the
 * animation the writer just watched.
 */

const schema = getSchema(SCHEMA_EXTENSIONS)

type Json = Parameters<typeof schema.nodeFromJSON>[0]

function docOf(...texts: string[]): Json {
  return {
    type: 'doc',
    content: texts.map((text) => ({
      type: 'paragraph',
      attrs: { uid: text.toLowerCase() },
      content: [{ type: 'text', text }],
    })),
  }
}

function order(state: EditorState): string[] {
  const texts: string[] = []
  state.doc.forEach((node) => texts.push(node.textContent))
  return texts
}

function moved(json: Json, fromIndex: number, toIndex: number): EditorState {
  const state = EditorState.create({ doc: schema.nodeFromJSON(json) })
  const tr = cellMoveTransaction(state, fromIndex, toIndex)
  return tr ? state.apply(tr) : state
}

describe('cellMoveTransaction', () => {
  it('drops a cell dragged down after the cell it passed', () => {
    expect(order(moved(docOf('A', 'B', 'C', 'D'), 0, 2))).toEqual(['B', 'C', 'A', 'D'])
  })

  it('drops a cell dragged up before the cell it passed', () => {
    expect(order(moved(docOf('A', 'B', 'C', 'D'), 3, 1))).toEqual(['A', 'D', 'B', 'C'])
  })

  it('moves neighbours past one another', () => {
    expect(order(moved(docOf('A', 'B'), 1, 0))).toEqual(['B', 'A'])
    expect(order(moved(docOf('A', 'B'), 0, 1))).toEqual(['B', 'A'])
  })

  it('reaches the ends of the document', () => {
    expect(order(moved(docOf('A', 'B', 'C'), 1, 0))).toEqual(['B', 'A', 'C'])
    expect(order(moved(docOf('A', 'B', 'C'), 1, 2))).toEqual(['A', 'C', 'B'])
  })

  it('carries the cell whole, not just its text', () => {
    const json = {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { uid: 'a' }, content: [{ type: 'text', text: 'A' }] },
        { type: 'secret', attrs: { uid: 's' }, content: [{ type: 'text', text: 'Hidden' }] },
      ],
    }

    const state = moved(json, 1, 0)

    // A move that quietly turned a GM-only cell into a paragraph would publish
    // it to the party, so this is worth pinning down separately.
    expect(state.doc.child(0).type.name).toBe('secret')
    expect(state.doc.child(0).attrs.uid).toBe('s')
  })

  it('does nothing when the cell is dropped where it started', () => {
    const state = EditorState.create({ doc: schema.nodeFromJSON(docOf('A', 'B')) })
    expect(cellMoveTransaction(state, 1, 1)).toBeNull()
  })

  it('does nothing when an index is not in the document', () => {
    const state = EditorState.create({ doc: schema.nodeFromJSON(docOf('A', 'B')) })
    expect(cellMoveTransaction(state, 0, 5)).toBeNull()
    expect(cellMoveTransaction(state, -1, 0)).toBeNull()
  })
})

describe('cellId', () => {
  it('uses the block uid, so a cell keeps its identity across an edit', () => {
    const state = EditorState.create({ doc: schema.nodeFromJSON(docOf('Alpha')) })
    expect(cellId(state.doc.child(0), 0)).toBe('alpha')
  })

  it('falls back to the position for a cell with no uid of its own', () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted' }] }],
        },
      ],
    }

    const state = EditorState.create({ doc: schema.nodeFromJSON(json) })
    expect(cellId(state.doc.child(0), 0)).toBe('cell@0')
  })
})
