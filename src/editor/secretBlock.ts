import { Node, mergeAttributes } from '@tiptap/core'
import { SECRET_NODE_TYPE } from '../documents/visibility'

/**
 * A passage of a shared document that only owners and GMs may read.
 *
 * This is what makes a document worth searching per block rather than per
 * document. A session log is shared with the party; the paragraph describing
 * what the villain is actually doing is not. Without a node like this the
 * whole log would have to be one or the other, and GMs would keep their real
 * notes somewhere else.
 *
 * The node only marks the passage. Nothing here decides who may read it — the
 * walker resolves the visibility of the blocks inside, and SQL does the
 * filtering. See src/documents/visibility.ts.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    secret: {
      /** Wraps the selection in a secret block, or unwraps it. */
      toggleSecret: () => ReturnType
    }
  }
}

export const Secret = Node.create({
  name: SECRET_NODE_TYPE,

  group: 'block',
  content: 'block+',

  // Keeps the wrapper intact when the writer edits inside it: backspacing at
  // the start of the first paragraph should not silently unwrap the secret and
  // publish it to the party.
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-secret]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-secret': '', class: 'secret-block' }),
      0,
    ]
  },

  addCommands() {
    return {
      toggleSecret:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    }
  },
})
