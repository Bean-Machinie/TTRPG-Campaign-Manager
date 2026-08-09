import { describe, expect, it } from 'vitest'
import { walkDocument } from './walker'
import type { ProseMirrorNode } from './walker'

/** A paragraph with one uid and one run of text. The common case, shortened. */
function paragraph(uid: string, text: string): ProseMirrorNode {
  return { type: 'paragraph', attrs: { uid }, content: [{ type: 'text', text }] }
}

function heading(uid: string, level: number, text: string): ProseMirrorNode {
  return { type: 'heading', attrs: { uid, level }, content: [{ type: 'text', text }] }
}

function doc(...content: ProseMirrorNode[]): ProseMirrorNode {
  return { type: 'doc', content }
}

describe('walkDocument · text', () => {
  it('rejoins text split by marks', () => {
    // "Blackthorn" with "thorn" italicised is two text nodes. A search for the
    // whole name has to find it, so the block's text must not be split either.
    const { blocks } = walkDocument(
      doc({
        type: 'paragraph',
        attrs: { uid: 'a' },
        content: [
          { type: 'text', text: 'Black' },
          { type: 'text', text: 'thorn', marks: [{ type: 'italic' }] } as ProseMirrorNode,
        ],
      }),
    )

    expect(blocks).toHaveLength(1)
    expect(blocks[0].text).toBe('Blackthorn')
  })

  it('renders a hard break as a space rather than joining words', () => {
    const { blocks } = walkDocument(
      doc({
        type: 'paragraph',
        attrs: { uid: 'a' },
        content: [
          { type: 'text', text: 'Ravenhold' },
          { type: 'hardBreak' },
          { type: 'text', text: 'Keep' },
        ],
      }),
    )

    expect(blocks[0].text).toBe('Ravenhold Keep')
  })

  it('skips blocks with nothing to search', () => {
    const { blocks } = walkDocument(
      doc(
        { type: 'paragraph' },
        { type: 'horizontalRule' },
        { type: 'paragraph', attrs: { uid: 'b' }, content: [{ type: 'text', text: '   ' }] },
        paragraph('c', 'Real text'),
      ),
    )

    expect(blocks.map((block) => block.text)).toEqual(['Real text'])
  })

  it('numbers blocks in document order from zero', () => {
    const { blocks } = walkDocument(doc(paragraph('a', 'One'), paragraph('b', 'Two')))
    expect(blocks.map((block) => block.ordinal)).toEqual([0, 1])
  })

  it('descends into containers to reach the blocks inside', () => {
    const { blocks } = walkDocument(
      doc({
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [paragraph('a', 'A silver key')] },
          { type: 'listItem', content: [paragraph('b', 'A torn map')] },
        ],
      }),
    )

    expect(blocks.map((block) => block.text)).toEqual(['A silver key', 'A torn map'])
    expect(blocks.map((block) => block.nodeType)).toEqual(['paragraph', 'paragraph'])
  })
})

describe('walkDocument · heading paths', () => {
  it('breadcrumbs a block with the headings above it', () => {
    const { blocks } = walkDocument(
      doc(heading('h1', 1, 'Session 12'), heading('h2', 2, 'The Vault'), paragraph('p', 'Inside')),
    )

    expect(blocks[2].headingPath).toBe('Session 12 > The Vault')
  })

  it('breadcrumbs a heading by its ancestors, not by itself', () => {
    const { blocks } = walkDocument(doc(heading('h1', 1, 'Session 12'), heading('h2', 2, 'The Vault')))

    expect(blocks[0].headingPath).toBeNull()
    expect(blocks[1].headingPath).toBe('Session 12')
  })

  it('pops back out when a heading level rises again', () => {
    const { blocks } = walkDocument(
      doc(
        heading('h1', 1, 'Session 12'),
        heading('h2', 2, 'The Vault'),
        heading('h2b', 2, 'The Escape'),
        paragraph('p', 'Running'),
      ),
    )

    expect(blocks[3].headingPath).toBe('Session 12 > The Escape')
  })

  it('leaves no empty segment when a heading level is skipped', () => {
    const { blocks } = walkDocument(
      doc(heading('h1', 1, 'Session 12'), heading('h3', 3, 'A side room'), paragraph('p', 'Dusty')),
    )

    expect(blocks[2].headingPath).toBe('Session 12 > A side room')
  })
})

describe('walkDocument · visibility', () => {
  it('defaults to shared', () => {
    const { blocks } = walkDocument(doc(paragraph('a', 'Common knowledge')))
    expect(blocks[0].visibility).toBe('shared')
  })

  it('marks everything inside a secret node gm_only', () => {
    const { blocks } = walkDocument(
      doc(
        paragraph('a', 'The party sees this'),
        {
          type: 'secret',
          content: [paragraph('b', 'The villain is the innkeeper'), paragraph('c', 'Also this')],
        },
        paragraph('d', 'And this is shared again'),
      ),
    )

    expect(blocks.map((block) => block.visibility)).toEqual([
      'shared',
      'gm_only',
      'gm_only',
      'shared',
    ])
  })

  it('inherits through nested containers inside a secret', () => {
    const { blocks } = walkDocument(
      doc({
        type: 'secret',
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'bulletList',
                content: [{ type: 'listItem', content: [paragraph('deep', 'Buried secret')] }],
              },
            ],
          },
        ],
      }),
    )

    expect(blocks[0].visibility).toBe('gm_only')
  })

  it('keeps a secret inside a private document author_only, not gm_only', () => {
    // The case the resolver exists for. A GM opening the block index must not
    // find somebody's private note because it happened to be wrapped in a
    // secret — narrowing composes, it does not reassign.
    const { blocks } = walkDocument(
      doc(paragraph('a', 'Mine'), { type: 'secret', content: [paragraph('b', 'Also mine')] }),
      'author_only',
    )

    expect(blocks.map((block) => block.visibility)).toEqual(['author_only', 'author_only'])
  })

  it('applies the document tier to blocks outside any secret', () => {
    const { blocks } = walkDocument(doc(paragraph('a', 'GM planning')), 'gm_only')
    expect(blocks[0].visibility).toBe('gm_only')
  })
})

describe('walkDocument · anchors', () => {
  it('uses the uid stored on the node', () => {
    const { blocks } = walkDocument(doc(paragraph('abc123', 'Anchored')))
    expect(blocks[0].blockUid).toBe('abc123')
  })

  it('falls back to a positional uid when a node has none', () => {
    const { blocks } = walkDocument(
      doc({ type: 'paragraph', content: [{ type: 'text', text: 'Legacy content' }] }),
    )

    expect(blocks[0].blockUid).toBe('ord-0')
  })

  it('never emits the same uid twice', () => {
    // `unique (document_id, block_uid)` on the index would reject the whole
    // reindex, so a duplicate that escaped the editor has to be survivable.
    const { blocks } = walkDocument(doc(paragraph('same', 'First'), paragraph('same', 'Second')))

    expect(blocks[0].blockUid).toBe('same')
    expect(blocks[1].blockUid).not.toBe('same')
    expect(new Set(blocks.map((block) => block.blockUid)).size).toBe(2)
  })
})

describe('walkDocument · degenerate input', () => {
  it('returns nothing for an empty document', () => {
    expect(walkDocument({ type: 'doc' }).blocks).toEqual([])
    expect(walkDocument({ type: 'doc', content: [] }).blocks).toEqual([])
  })
})
