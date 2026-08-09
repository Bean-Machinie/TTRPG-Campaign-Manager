import { EditorContent, useEditor } from '@tiptap/react'
import { Placeholder } from '@tiptap/extension-placeholder'
import type { JSONContent } from '@tiptap/core'
import type { DocumentVisibility } from '../documents/visibility'
import { BlockGutter } from './BlockGutter'
import { SelectionMenu } from './SelectionMenu'
import { SCHEMA_EXTENSIONS } from './extensions'
import { SlashCommand } from './slashCommand'
import { normalizeDocumentContent } from './documentContent'
import './DocumentEditor.css'

/**
 * The document editor.
 *
 * There is no container and no toolbar. The document sits on the page, the
 * controls appear where they are relevant — in the left margin on hover, in a
 * bubble on selection, behind `/` while typing — and nothing else is on screen.
 *
 * Content is held as ProseMirror JSON rather than HTML, because everything
 * downstream reads the tree: the walker splits it into indexable blocks, and
 * the in-document search will overlay matches as decorations.
 *
 * The component is deliberately uncontrolled. `content` seeds the editor once;
 * afterwards ProseMirror owns the document and reports changes upward. Feeding
 * saved content back in on every render would fight the cursor. The page
 * remounts this component when the document id changes.
 */

type DocumentEditorProps = {
  content: JSONContent
  editable: boolean
  /**
   * Whether the writer may mark a passage GM-only. False for players: a secret
   * block they created would be a passage of their own document they could no
   * longer read.
   */
  canWriteSecrets: boolean
  /** The document's own tier, which tints the surface. Not an access check. */
  visibility: DocumentVisibility
  onChange: (content: JSONContent) => void
}

const EMPTY_DOCUMENT_PROMPT = 'Describe the place, the person, or what happened. Press / for blocks.'

const placeholder = Placeholder.configure({
  // False so that an empty document still prompts when it has not been clicked
  // into. Which *block* gets a placeholder is decided below, by hasAnchor.
  showOnlyCurrent: false,
  includeChildren: true,

  placeholder: ({ editor, node, hasAnchor }) => {
    if (editor.isEmpty) return EMPTY_DOCUMENT_PROMPT

    // An empty block the writer is not in stays blank. A column of "Type / for
    // commands" down an unfinished document is noise.
    if (!hasAnchor) return ''

    if (node.type.name === 'heading') return 'Heading'
    if (node.type.name === 'readAloud') return 'Text to read aloud'

    return 'Type / for commands'
  },
})

export function DocumentEditor({
  content,
  editable,
  canWriteSecrets,
  visibility,
  onChange,
}: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [
      ...SCHEMA_EXTENSIONS,
      placeholder,
      SlashCommand.configure({ canWriteSecrets }),
    ],
    content: normalizeDocumentContent(content),
    editable,
    onUpdate: ({ editor: updated }) => onChange(updated.getJSON()),
    editorProps: {
      attributes: {
        class: 'document-editor__surface',
        // The surface is the document, so it should read as one.
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Document body',
      },
    },
  })

  if (!editor) return null

  return (
    <div className={`document-editor document-editor--${visibility}`}>
      {editable ? (
        <>
          <BlockGutter editor={editor} canWriteSecrets={canWriteSecrets} />
          <SelectionMenu editor={editor} />
        </>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  )
}
