import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'

/**
 * Formatting, on selection and nowhere else.
 *
 * A permanent toolbar is what made the previous build read as a form field: it
 * announced "this is a control" before anything had been written. Marks only
 * matter once there is text to apply them to, so the controls only exist then.
 *
 * Block-level actions are not here — they live in the gutter's block menu,
 * because they act on a block rather than on a run of characters.
 */

type SelectionMenuProps = {
  editor: Editor
}

export function SelectionMenu({ editor }: SelectionMenuProps) {
  function toggleLink() {
    const existing = editor.getAttributes('link').href as string | undefined

    // Consistent with the delete confirmations elsewhere in the app: a native
    // prompt rather than a modal this feature would have to own.
    const href = window.prompt('Link to', existing ?? 'https://')

    if (href === null) return

    if (href.trim().length === 0) {
      editor.chain().focus().unsetLink().run()
      return
    }

    editor.chain().focus().setLink({ href: href.trim() }).run()
  }

  return (
    <BubbleMenu
      editor={editor}
      className="editor-popup selection-menu"
      options={{ placement: 'top', offset: 8 }}
    >
      <MarkButton
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>B</strong>
      </MarkButton>

      <MarkButton
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>I</em>
      </MarkButton>

      <MarkButton
        label="Underline"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="selection-menu__underline">U</span>
      </MarkButton>

      <MarkButton
        label="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <s>S</s>
      </MarkButton>

      <MarkButton
        label="Inline code"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <code>{'<>'}</code>
      </MarkButton>

      <span className="selection-menu__divider" aria-hidden="true" />

      <MarkButton label="Link" active={editor.isActive('link')} onClick={toggleLink}>
        Link
      </MarkButton>
    </BubbleMenu>
  )
}

type MarkButtonProps = {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function MarkButton({ label, active, onClick, children }: MarkButtonProps) {
  return (
    <button
      type="button"
      className="selection-menu__button"
      aria-label={label}
      aria-pressed={active}
      data-active={active}
      // Keeps the selection the mark is about to be applied to.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
