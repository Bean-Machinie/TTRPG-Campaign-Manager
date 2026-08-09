import { describe, expect, it } from 'vitest'
import { normalizeDocumentContent, withoutGmOnlyCells } from './documentContent'

describe('normalizeDocumentContent', () => {
  it('turns a legacy nested secret into one multiline cell', () => {
    const normalized = normalizeDocumentContent({
      type: 'doc',
      content: [
        {
          type: 'secret',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
            { type: 'readAloud', content: [{ type: 'text', text: 'Second' }] },
          ],
        },
      ],
    })

    expect(normalized.content).toEqual([
      {
        type: 'secret',
        content: [
          { type: 'text', text: 'First' },
          { type: 'hardBreak' },
          { type: 'text', text: 'Second' },
        ],
      },
    ])
  })

  it('expands an old toggle into ordinary cells', () => {
    const normalized = normalizeDocumentContent({
      type: 'doc',
      content: [
        {
          type: 'details',
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 'Title' }] },
            {
              type: 'detailsContent',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }],
            },
          ],
        },
      ],
    })

    expect(normalized.content?.map((node) => node.type)).toEqual(['paragraph', 'paragraph'])
  })

  it('turns legacy list nodes into lines inside a text cell', () => {
    const normalized = normalizeDocumentContent({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Torch' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rope' }] }],
            },
          ],
        },
      ],
    })

    expect(normalized.content).toEqual([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '• ' },
          { type: 'text', text: 'Torch' },
          { type: 'hardBreak' },
          { type: 'text', text: '• ' },
          { type: 'text', text: 'Rope' },
        ],
      },
    ])
  })
})

describe('withoutGmOnlyCells', () => {
  it('removes secret content while retaining shared cells', () => {
    const visible = withoutGmOnlyCells({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Shared' }] },
        { type: 'secret', content: [{ type: 'text', text: 'Hidden' }] },
      ],
    })

    expect(visible.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Shared' }] },
    ])
  })
})
