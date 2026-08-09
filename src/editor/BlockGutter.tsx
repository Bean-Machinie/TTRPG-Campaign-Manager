import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import type { Editor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Fragment } from '@tiptap/pm/model'
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

// This object must remain stable. DragHandle registers a ProseMirror plugin
// from it; recreating the object on every hover render tears that plugin down
// while the pointer is travelling toward a button, causing flicker and lost
// clicks.
const GUTTER_POSITION = { placement: 'left' as const }

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
      <DragHandle
        editor={editor}
        onNodeChange={handleNodeChange}
        className="block-gutter"
        computePositionConfig={GUTTER_POSITION}
      >
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

type CellType = 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'blockquote' | 'readAloud' | 'secret'

function inlineContent(node: ProseMirrorNode): Fragment {
  const inline: ProseMirrorNode[] = []

  function collect(current: ProseMirrorNode) {
    if (current.isInline) {
      inline.push(current)
      return
    }

    const before = inline.length
    current.forEach(collect)
    if (before < inline.length && inline.at(-1)?.type.name !== 'hardBreak') {
      const hardBreak = current.type.schema.nodes.hardBreak
      if (hardBreak) inline.push(hardBreak.create())
    }
  }

  node.forEach(collect)
  if (inline.at(-1)?.type.name === 'hardBreak') inline.pop()
  return Fragment.fromArray(inline)
}

/** Replaces the hovered top-level cell itself; it never wraps its contents. */
function turnCellInto(editor: Editor, block: HoveredBlock, cellType: CellType) {
  const { schema, tr } = editor.state
  const inline = inlineContent(block.node)
  const uid = block.node.attrs.uid ?? null
  let replacement: ProseMirrorNode

  if (cellType === 'blockquote') {
    const paragraph = schema.nodes.paragraph.create({ uid }, inline)
    replacement = schema.nodes.blockquote.create(null, paragraph)
  } else {
    const nodeName = cellType.startsWith('heading') ? 'heading' : cellType
    const attrs = nodeName === 'heading' ? { level: Number(cellType.at(-1)), uid } : { uid }
    replacement = schema.nodes[nodeName].create(attrs, inline)
  }

  tr.replaceWith(block.pos, block.pos + block.node.nodeSize, replacement)
  editor.view.dispatch(tr.scrollIntoView())
  editor.commands.focus(block.pos + 1)
}

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

  const turnInto: MenuAction[] = [
    { label: 'Text', run: () => turnCellInto(editor, block, 'paragraph') },
    { label: 'Heading 1', run: () => turnCellInto(editor, block, 'heading1') },
    { label: 'Heading 2', run: () => turnCellInto(editor, block, 'heading2') },
    { label: 'Heading 3', run: () => turnCellInto(editor, block, 'heading3') },
    { label: 'Quote', run: () => turnCellInto(editor, block, 'blockquote') },
    { label: 'Read-aloud', run: () => turnCellInto(editor, block, 'readAloud') },
  ]

  if (canWriteSecrets) {
    turnInto.push({ label: 'GM only', run: () => turnCellInto(editor, block, 'secret') })
  }

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
