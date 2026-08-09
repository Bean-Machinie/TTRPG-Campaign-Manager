import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import type { Editor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { positionPopup } from './popup'

/**
 * The controls that live in the left margin.
 *
 * They sit outside the text column so that appearing on hover never nudges a
 * word, and there are three of them, each doing one thing:
 *
 *   +   insert a block below
 *   ⠿   drag to move
 *   ⋯   block actions
 *
 * Dragging and opening a menu are different intentions and get different
 * controls. Sharing one would mean every click on the handle is a guess about
 * which the writer meant.
 *
 * Tiptap's DragHandle owns tracking which block the pointer is over and the
 * dragging itself, and hands back the node and its position.
 */

type BlockGutterProps = {
  editor: Editor
  /** Whether to offer the GM-only action. Players do not get it. */
  canWriteSecrets: boolean
}

type HoveredBlock = { node: ProseMirrorNode; pos: number }

export function BlockGutter({ editor, canWriteSecrets }: BlockGutterProps) {
  const [block, setBlock] = useState<HoveredBlock | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  /*
   * While the menu is open it owns the block, and hover stops mattering.
   *
   * Without this the menu is unusable: DragHandle reports a node on pointer
   * movement, so reaching for a menu item — which means moving the pointer —
   * would retarget the gutter and close the menu before the click landed.
   * Read through a ref because the callback below is created once.
   */
  const menuOpenRef = useRef(false)

  const setMenu = useCallback((open: boolean) => {
    menuOpenRef.current = open
    setMenuOpen(open)
  }, [])

  const handleNodeChange = useCallback(
    (data: { node: ProseMirrorNode | null; pos: number }) => {
      if (menuOpenRef.current) return
      setBlock(data.node ? { node: data.node, pos: data.pos } : null)
    },
    [],
  )

  /** Adds an empty block below and opens the slash menu inside it. */
  function insertBelow() {
    if (!block) return

    const end = block.pos + block.node.nodeSize

    editor
      .chain()
      .focus()
      .insertContentAt(end, { type: 'paragraph' })
      .setTextSelection(end + 1)
      // Typing the slash rather than opening a menu directly: one code path
      // into the command list, so filtering and Escape behave identically
      // however it was reached.
      .insertContent('/')
      .run()
  }

  return (
    <>
      <DragHandle editor={editor} onNodeChange={handleNodeChange} className="block-gutter">
        <div className="block-gutter__controls">
          <button
            type="button"
            className="block-gutter__button"
            aria-label="Insert a block below"
            draggable={false}
            onClick={insertBelow}
          >
            <PlusIcon />
          </button>

          {/* No click handler: this one is the drag grip and nothing else. */}
          <span className="block-gutter__button block-gutter__grip" aria-hidden="true">
            <GripIcon />
          </span>

          <button
            type="button"
            className="block-gutter__button"
            aria-label="Block actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            draggable={false}
            ref={menuButtonRef}
            onClick={() => setMenu(!menuOpenRef.current)}
          >
            <DotsIcon />
          </button>
        </div>
      </DragHandle>

      {menuOpen && block ? (
        <BlockMenu
          editor={editor}
          block={block}
          canWriteSecrets={canWriteSecrets}
          anchor={menuButtonRef.current}
          onClose={() => setMenu(false)}
        />
      ) : null}
    </>
  )
}

type BlockMenuProps = {
  editor: Editor
  block: HoveredBlock
  canWriteSecrets: boolean
  anchor: HTMLElement | null
  onClose: () => void
}

type MenuAction = { label: string; run: () => void }

function BlockMenu({ editor, block, canWriteSecrets, anchor, onClose }: BlockMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = menuRef.current
    if (!element) return

    positionPopup(element, anchor?.getBoundingClientRect() ?? null)
    element.querySelector<HTMLButtonElement>('button')?.focus()
  }, [anchor])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        editor.commands.focus()
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as globalThis.Node)) onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [editor, onClose])

  /** Puts the cursor inside the block, which is what the node commands act on. */
  const inside = () => editor.chain().focus().setTextSelection(block.pos + 1)

  const turnInto: MenuAction[] = [
    { label: 'Text', run: () => inside().setNode('paragraph').run() },
    { label: 'Heading 1', run: () => inside().setNode('heading', { level: 1 }).run() },
    { label: 'Heading 2', run: () => inside().setNode('heading', { level: 2 }).run() },
    { label: 'Heading 3', run: () => inside().setNode('heading', { level: 3 }).run() },
    { label: 'Bullet list', run: () => inside().toggleBulletList().run() },
    { label: 'Quote', run: () => inside().toggleBlockquote().run() },
    { label: 'Read-aloud', run: () => inside().toggleReadAloud().run() },
  ]

  const actions: MenuAction[] = [
    {
      label: 'Duplicate',
      run: () => {
        // The copy carries the original's uid, and the blockUid plugin replaces
        // it on the next transaction — the same path a paste takes.
        const end = block.pos + block.node.nodeSize
        editor.chain().focus().insertContentAt(end, block.node.toJSON()).run()
      },
    },
    {
      label: 'Delete',
      run: () =>
        editor
          .chain()
          .focus()
          .deleteRange({ from: block.pos, to: block.pos + block.node.nodeSize })
          .run(),
    },
  ]

  if (canWriteSecrets) {
    actions.unshift({
      label: editor.isActive('secret') ? 'Remove GM only' : 'Make GM only',
      run: () => inside().toggleSecret().run(),
    })
  }

  function choose(action: MenuAction) {
    action.run()
    onClose()
  }

  // Rendered on document.body, not in the editor. In the flow it would be a
  // block of its own and shove every paragraph below it down the page.
  return createPortal(
    <div className="editor-popup block-menu" ref={menuRef} role="menu" aria-label="Block actions">
      <div className="block-menu__group">
        <p className="block-menu__group-name">Turn into</p>
        {turnInto.map((action) => (
          <button
            type="button"
            className="block-menu__item"
            role="menuitem"
            key={action.label}
            onClick={() => choose(action)}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="block-menu__group">
        {actions.map((action) => (
          <button
            type="button"
            className="block-menu__item"
            role="menuitem"
            key={action.label}
            onClick={() => choose(action)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M8 3.5v9M3.5 8h9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      {[4, 8, 12].map((y) =>
        [6, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.15" fill="currentColor" />),
      )}
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      {[3.5, 8, 12.5].map((x) => (
        <circle key={x} cx={x} cy="8" r="1.3" fill="currentColor" />
      ))}
    </svg>
  )
}
