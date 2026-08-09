import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import { createPopupContainer, positionPopup, removePopupContainer } from './popup'
import { SlashMenu } from './SlashMenu'
import type { SlashMenuHandle, SlashMenuProps } from './SlashMenu'
import { filterSlashGroups, flattenGroups } from './slashItems'
import type { SlashItem } from './slashItems'

/**
 * Wires `/` to the command menu.
 *
 * Restricted to the start of a block on purpose. A slash in the middle of a
 * sentence is a fraction, a path, or an "and/or" — opening a menu there would
 * interrupt writing far more often than it helped. At the start of a block it
 * is unambiguous.
 */

export const SlashCommand = Extension.create<{ canWriteSecrets: boolean }>({
  name: 'slashCommand',

  addOptions() {
    return { canWriteSecrets: false }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        startOfLine: true,

        allow: ({ state, range }) => {
          const parent = state.doc.resolve(range.from).parent
          // A slash inside code is code.
          return parent.type.isTextblock && parent.type.name !== 'codeBlock'
        },

        items: ({ query }) =>
          flattenGroups(filterSlashGroups(query, this.options.canWriteSecrets)),

        command: ({ editor, range, props }) => props.run(editor, range),

        render: () => {
          let renderer: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null = null
          let container: HTMLDivElement | null = null

          return {
            onStart: (props) => {
              container = createPopupContainer('editor-popup')

              renderer = new ReactRenderer(SlashMenu, {
                editor: props.editor,
                props: {
                  groups: filterSlashGroups(props.query, this.options.canWriteSecrets),
                  query: props.query,
                  onSelect: (item: SlashItem) => props.command(item),
                },
              })

              container.append(renderer.element)
              positionPopup(container, props.clientRect?.() ?? null)
            },

            onUpdate: (props) => {
              renderer?.updateProps({
                groups: filterSlashGroups(props.query, this.options.canWriteSecrets),
                query: props.query,
                onSelect: (item: SlashItem) => props.command(item),
              })

              if (container) positionPopup(container, props.clientRect?.() ?? null)
            },

            // Escape and the rest of the lifecycle belong to the suggestion
            // plugin; only the keys that move through the list are ours.
            onKeyDown: (props) => renderer?.ref?.onKeyDown(props.event) ?? false,

            onExit: () => {
              renderer?.destroy()
              removePopupContainer(container)
              renderer = null
              container = null
            },
          }
        },
      }),
    ]
  },
})
