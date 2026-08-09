import { Node, mergeAttributes } from '@tiptap/core'

/**
 * Boxed text: the passage a GM reads out to the table verbatim.
 *
 * Every published adventure has these, and they are the one kind of prose in a
 * session document that is performed rather than referred to. A GM skimming
 * mid-session needs to find them by shape, without reading them.
 *
 * Unlike `secret` this is a presentation block, not a visibility one. It holds
 * inline content rather than blocks, so the walker treats it as a text block
 * and indexes it directly — no change to walkDocument() was needed to support
 * it, which is what the structural "all children inline" rule buys.
 */

export const READ_ALOUD_NODE_TYPE = 'readAloud'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    readAloud: {
      /** Turns the current block into read-aloud text, or back into a paragraph. */
      toggleReadAloud: () => ReturnType
    }
  }
}

export const ReadAloud = Node.create({
  name: READ_ALOUD_NODE_TYPE,

  group: 'block',
  content: 'inline*',

  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-read-aloud]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-read-aloud': '', class: 'read-aloud-block' }),
      0,
    ]
  },

  addCommands() {
    return {
      toggleReadAloud:
        () =>
        ({ commands }) =>
          commands.toggleNode(this.name, 'paragraph'),
    }
  },
})
