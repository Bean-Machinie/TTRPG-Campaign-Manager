import type { JSONContent } from '@tiptap/core'

const INLINE_TYPES = new Set(['text', 'hardBreak'])

function inlineLines(node: JSONContent): JSONContent[][] {
  const children = node.content ?? []

  if (children.length > 0 && children.every((child) => INLINE_TYPES.has(child.type ?? ''))) {
    return [children]
  }

  return children.flatMap(inlineLines)
}

function flattenInline(node: JSONContent): JSONContent[] {
  const lines = inlineLines(node).filter((line) => line.length > 0)
  return lines.flatMap((line, index) =>
    index === 0 ? line : [{ type: 'hardBreak' }, ...line],
  )
}

function flattenLegacyList(node: JSONContent, ordered: boolean): JSONContent {
  const start = typeof node.attrs?.start === 'number' ? node.attrs.start : 1
  const items = node.content ?? []
  const content = items.flatMap((item, index) => {
    const prefix = ordered ? `${start + index}. ` : '• '
    const line = [{ type: 'text', text: prefix }, ...flattenInline(item)]
    return index === 0 ? line : [{ type: 'hardBreak' }, ...line]
  })

  return { type: 'paragraph', content }
}

/** Upgrades the old nested secret/toggle shapes before TipTap parses them. */
export function normalizeDocumentContent(content: JSONContent): JSONContent {
  function normalizeNode(node: JSONContent): JSONContent[] {
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      return [flattenLegacyList(node, node.type === 'orderedList')]
    }

    if (node.type === 'details' || node.type === 'detailsContent') {
      return (node.content ?? []).flatMap(normalizeNode)
    }

    if (node.type === 'detailsSummary') {
      return [{ type: 'paragraph', attrs: node.attrs, content: flattenInline(node) }]
    }

    if (node.type === 'secret' || node.type === 'readAloud') {
      return [{ ...node, content: flattenInline(node) }]
    }

    if (!node.content) return [node]

    return [{ ...node, content: node.content.flatMap(normalizeNode) }]
  }

  return {
    ...content,
    type: 'doc',
    content: (content.content ?? []).flatMap(normalizeNode),
  }
}

/** Removes GM-only cells before a player's document is mounted or rendered. */
export function withoutGmOnlyCells(content: JSONContent): JSONContent {
  function visibleNode(node: JSONContent): JSONContent | null {
    if (node.type === 'secret') return null
    if (!node.content) return node

    return {
      ...node,
      content: node.content.map(visibleNode).filter((child): child is JSONContent => child !== null),
    }
  }

  return visibleNode(content) ?? { type: 'doc', content: [] }
}
