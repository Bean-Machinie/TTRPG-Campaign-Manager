import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { Plugin, TextSelection } from '@tiptap/pm/state'
import { cellDragTarget, finishCellDrag } from './cellDragMotion'

function topLevelRangeAt(
  editor: Editor,
  position: number,
): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null

  editor.state.doc.forEach((node, offset) => {
    if (position >= offset && position <= offset + node.nodeSize) {
      found = { from: offset, to: offset + node.nodeSize }
    }
  })

  return found
}

/** Keyboard behavior for notebook-like cells rather than a flowing document. */
export const CellBehavior = Extension.create({
  name: 'cellBehavior',
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      Space: () => {
        const { selection } = this.editor.state
        if (
          !selection.empty ||
          !selection.$from.parent.isTextblock ||
          selection.$from.parent.type.name === 'codeBlock'
        ) return false

        const lineStart = selection.$from.start()
        const before = this.editor.state.doc.textBetween(lineStart, selection.from, '\n', '\n')
        const currentLine = before.slice(before.lastIndexOf('\n') + 1)

        if (currentLine === '*' || currentLine === '-') {
          return this.editor
            .chain()
            .deleteRange({ from: selection.from - 1, to: selection.from })
            .insertContent('• ')
            .run()
        }

        // Consume the space ourselves so StarterKit can never reinterpret a
        // numbered marker as an ordered-list block.
        if (/^\d+\.$/.test(currentLine)) {
          return this.editor.commands.insertContent(' ')
        }

        return false
      },

      Enter: () => {
        if (this.editor.isActive('codeBlock')) return false

        const { selection } = this.editor.state
        if (
          selection.empty &&
          selection.$from.parent.isTextblock &&
          selection.$from.parent.type.name !== 'codeBlock'
        ) {
          const lineStart = selection.$from.start()
          const before = this.editor.state.doc.textBetween(lineStart, selection.from, '\n', '\n')
          const currentLine = before.slice(before.lastIndexOf('\n') + 1)
          const bullet = currentLine.match(/^•\s/)
          const numbered = currentLine.match(/^(\d+)\.\s/)

          if (bullet) {
            return this.editor.chain().setHardBreak().insertContent('• ').run()
          }

          if (numbered) {
            return this.editor
              .chain()
              .setHardBreak()
              .insertContent(`${Number(numbered[1]) + 1}. `)
              .run()
          }
        }

        return this.editor.commands.setHardBreak()
      },

      'Mod-a': () => {
        const range = topLevelRangeAt(this.editor, this.editor.state.selection.from)
        if (!range || range.to - range.from <= 2) return false

        const from = this.editor.state.doc.resolve(range.from + 1)
        const to = this.editor.state.doc.resolve(range.to - 1)
        const selection = TextSelection.between(from, to)
        this.editor.view.dispatch(this.editor.state.tr.setSelection(selection))
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDrop: (view, event, _slice, moved) => {
            if (!moved) return false

            const liveTarget = cellDragTarget(view)
            const sourcePosition = liveTarget?.sourcePos ?? view.state.selection.from
            const source = topLevelRangeAt(this.editor, sourcePosition)
            if (!source) return false

            const ranges: Array<{ from: number; to: number }> = []
            view.state.doc.forEach((node, from) => ranges.push({ from, to: from + node.nodeSize }))

            let boundary: number
            if (liveTarget) {
              const sourceIndex = ranges.findIndex((range) => range.from === source.from)
              const targetIndex = liveTarget.targetIndex
              if (targetIndex === sourceIndex) {
                finishCellDrag(view)
                return true
              }
              boundary = targetIndex < sourceIndex ? ranges[targetIndex].from : ranges[targetIndex].to
            } else {
              const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })
              if (!coordinates) return false
              const target = topLevelRangeAt(this.editor, coordinates.pos)
              if (!target) return false
              const targetDom = view.nodeDOM(target.from)
              const targetRect = targetDom instanceof Element ? targetDom.getBoundingClientRect() : null
              boundary = targetRect && event.clientY > targetRect.top + targetRect.height / 2
                ? target.to
                : target.from
            }

            if (boundary === source.from || boundary === source.to) {
              finishCellDrag(view)
              return true
            }

            event.preventDefault()
            const movingNode = view.state.doc.nodeAt(source.from)
            if (!movingNode) return false

            finishCellDrag(view)
            const transaction = view.state.tr.delete(source.from, source.to)
            const insertion = transaction.mapping.map(boundary)
            transaction.insert(insertion, movingNode).scrollIntoView()
            view.dispatch(transaction)
            return true
          },
        },
      }),
    ]
  },
})
