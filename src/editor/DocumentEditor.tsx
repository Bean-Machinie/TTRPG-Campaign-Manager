import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { JSONContent } from '@tiptap/core'
import { Button } from '../components/ui/Button'
import { BlockUid } from './blockUid'
import { Secret } from './secretBlock'
import './DocumentEditor.css'

/**
 * The document editor.
 *
 * Content is held as ProseMirror JSON rather than HTML, because everything
 * downstream reads the tree: the walker splits it into indexable blocks, and
 * the in-document search will overlay matches as decorations. HTML would mean
 * parsing it back before either could happen.
 *
 * The component is deliberately uncontrolled. `content` seeds the editor once;
 * afterwards ProseMirror owns the document and reports changes upward. Feeding
 * saved content back in on every render would fight the cursor. The page
 * remounts this component when the document id changes, which is what switches
 * documents.
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
  onChange: (content: JSONContent) => void
}

export function DocumentEditor({
  content,
  editable,
  canWriteSecrets,
  onChange,
}: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, BlockUid, Secret],
    content,
    editable,
    onUpdate: ({ editor: updated }) => onChange(updated.getJSON()),
    editorProps: {
      attributes: { class: 'document-editor__surface' },
    },
  })

  if (!editor) return null

  return (
    <div className="document-editor">
      {editable ? (
        <div className="document-editor__toolbar" role="toolbar" aria-label="Formatting">
          <ToolbarButton
            label="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label="Italic"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            label="Heading"
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarButton
            label="Subheading"
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          />
          <ToolbarButton
            label="List"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="Quote"
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />

          {canWriteSecrets ? (
            <ToolbarButton
              label="GM only"
              active={editor.isActive('secret')}
              onClick={() => editor.chain().focus().toggleSecret().run()}
            />
          ) : null}
        </div>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  )
}

type ToolbarButtonProps = {
  label: string
  active: boolean
  onClick: () => void
}

function ToolbarButton({ label, active, onClick }: ToolbarButtonProps) {
  return (
    <Button
      variant="secondary"
      className={active ? 'document-editor__tool is-active' : 'document-editor__tool'}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </Button>
  )
}
