import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'
import { Bold, Code, Italic, Link, Strikethrough, Underline } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Formatting, on selection and nowhere else.
 *
 * A permanent toolbar is what made the previous build read as a form field: it
 * announced "this is a control" before anything had been written. Marks only
 * matter once there is text to apply them to, so the controls only exist then.
 *
 * Block-level actions are not here — they live in the gutter's block menu,
 * because they act on a block rather than on a run of characters.
 *
 * The buttons were letters — a bold B, an italic I, a struck-through S — which
 * is a nice idea that does not survive contact with the rest of the product.
 * Six differently-shaped glyphs at six different optical weights sitting in one
 * 32px row never lined up, and none of them matched the icons in the two menus
 * that open a centimetre away. These are the same 16px Lucide strokes as
 * everything else.
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
        icon={Bold}
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />

      <MarkButton
        label="Italic"
        icon={Italic}
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />

      <MarkButton
        label="Underline"
        icon={Underline}
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />

      <MarkButton
        label="Strikethrough"
        icon={Strikethrough}
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <MarkButton
        label="Inline code"
        icon={Code}
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />

      <span className="selection-menu__divider" aria-hidden="true" />

      <MarkButton label="Link" icon={Link} active={editor.isActive('link')} onClick={toggleLink} />
    </BubbleMenu>
  )
}

type MarkButtonProps = {
  label: string
  icon: LucideIcon
  active: boolean
  onClick: () => void
}

function MarkButton({ label, icon: Icon, active, onClick }: MarkButtonProps) {
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
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}
