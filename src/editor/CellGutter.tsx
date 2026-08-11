import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Copy,
  EyeOff,
  Heading1,
  Heading2,
  Heading3,
  Speech,
  TextQuote,
  Trash2,
  Type,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, HTMLAttributes } from 'react'
import type { Editor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Fragment } from '@tiptap/pm/model'
import { positionPopup } from './popup'
import { findCell } from './cells'
import type { Cell } from './cells'

/**
 * The controls in the left margin of a cell.
 *
 * Three of them, each doing exactly one thing:
 *
 *   +   insert a cell below
 *   ⠿   grab to move
 *   ⋯   cell actions
 *
 * The grip is the only part of the cell that starts a drag. Everything inside
 * the cell stays plain editable text — clicking a word puts a caret in it, and
 * selecting a sentence selects a sentence. That separation is the whole reason
 * the handle lives out here rather than on the cell body.
 *
 * The grip carries dnd-kit's activator props; this component does not know what
 * dragging is, only where to put the handle that begins it.
 */

export type GripProps = HTMLAttributes<HTMLElement> & {
  ref: (element: HTMLElement | null) => void
}

type CellGutterProps = {
  editor: Editor
  cell: Cell
  canWriteSecrets: boolean
  /** Vertical displacement dnd-kit is applying to the cell, so the handle rides along. */
  offsetY: number
  dragging: boolean
  gripProps: GripProps
  /** Held open means hover must stop retargeting the gutter. */
  onMenuOpenChange: (open: boolean) => void
}

/**
 * Where the handle sits against its cell.
 *
 * Aligned to the cell's first line rather than centred on the cell, because a
 * cell can be a paragraph or six lines of read-aloud text, and a handle floating
 * in the middle of a long block stops reading as belonging to its top edge.
 */
function firstLineBox(element: HTMLElement) {
  const style = window.getComputedStyle(element)
  const lineHeight = Number.parseFloat(style.lineHeight)
  const paddingTop = Number.parseFloat(style.paddingTop)

  return {
    top: element.offsetTop + (Number.isFinite(paddingTop) ? paddingTop : 0),
    // `normal` line-height parses to NaN, and a horizontal rule has no line at
    // all. The button row's own height is the floor either way.
    height: Math.max(Number.isFinite(lineHeight) ? lineHeight : 0, 26),
  }
}

export function CellGutter({
  editor,
  cell,
  canWriteSecrets,
  offsetY,
  dragging,
  gripProps,
  onMenuOpenChange,
}: CellGutterProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  function setMenu(open: boolean) {
    setMenuOpen(open)
    onMenuOpenChange(open)
  }

  const box = firstLineBox(cell.element)
  const style: CSSProperties = {
    top: box.top,
    height: box.height,
    // The X half parks the row just left of the cell's edge; the Y half is
    // dnd-kit's, and is what keeps the handle attached to a cell in flight.
    transform: `translate3d(-100%, ${offsetY}px, 0)`,
  }

  /** Adds an empty cell below and opens the slash menu inside it. */
  function insertBelow() {
    const target = findCell(editor, cell.id)
    if (!target) return

    const end = target.pos + target.node.nodeSize

    editor
      .chain()
      .focus()
      .insertContentAt(end, { type: 'paragraph' })
      .setTextSelection(end + 1)
      // Typing the slash rather than opening a menu directly: one code path into
      // the command list, so filtering and Escape behave identically however it
      // was reached.
      .insertContent('/')
      .run()
  }

  return (
    <>
      <div
        className={`cell-gutter${dragging ? ' cell-gutter--dragging' : ''}`}
        style={style}
        // Sweeping the pointer through the margin should not drop a caret into
        // whatever text happens to be underneath.
        onMouseDown={(event) => event.preventDefault()}
      >
        <button
          type="button"
          className="cell-gutter__button"
          aria-label="Insert a cell below"
          onClick={insertBelow}
        >
          <PlusIcon />
        </button>

        {/* No click handler: this one is the grip and nothing else. */}
        <button
          {...gripProps}
          type="button"
          className="cell-gutter__button cell-gutter__grip"
          aria-label="Drag to move this cell"
        >
          <GripIcon />
        </button>

        <button
          type="button"
          className="cell-gutter__button"
          aria-label="Cell actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          ref={menuButtonRef}
          onClick={() => setMenu(!menuOpen)}
        >
          <DotsIcon />
        </button>
      </div>

      {menuOpen ? (
        <CellMenu
          editor={editor}
          cellId={cell.id}
          canWriteSecrets={canWriteSecrets}
          anchor={menuButtonRef.current}
          onClose={() => setMenu(false)}
        />
      ) : null}
    </>
  )
}

type CellMenuProps = {
  editor: Editor
  cellId: string
  canWriteSecrets: boolean
  anchor: HTMLElement | null
  onClose: () => void
}

/**
 * `tone` exists for exactly one row. Delete is the only thing in here that
 * cannot be undone by pressing the button next to it, and a menu where every
 * row looks identical is a menu where that row is one slip away.
 */
type MenuAction = { label: string; icon: LucideIcon; tone?: 'danger'; run: () => void }

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

/** Replaces the cell itself; it never wraps its contents in a new container. */
function turnCellInto(editor: Editor, cellId: string, cellType: CellType) {
  const cell = findCell(editor, cellId)
  if (!cell) return

  const { schema, tr } = editor.state
  const inline = inlineContent(cell.node)
  const uid = cell.node.attrs.uid ?? null
  let replacement: ProseMirrorNode

  if (cellType === 'blockquote') {
    const paragraph = schema.nodes.paragraph.create({ uid }, inline)
    replacement = schema.nodes.blockquote.create(null, paragraph)
  } else {
    const nodeName = cellType.startsWith('heading') ? 'heading' : cellType
    const attrs = nodeName === 'heading' ? { level: Number(cellType.at(-1)), uid } : { uid }
    replacement = schema.nodes[nodeName].create(attrs, inline)
  }

  tr.replaceWith(cell.pos, cell.pos + cell.node.nodeSize, replacement)
  editor.view.dispatch(tr.scrollIntoView())
  editor.commands.focus(cell.pos + 1)
}

function CellMenu({ editor, cellId, canWriteSecrets, anchor, onClose }: CellMenuProps) {
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

  // The glyphs are the slash menu's, deliberately: inserting a read-aloud and
  // turning a paragraph into one are the same block arrived at two ways, and
  // they should look it.
  const turnInto: MenuAction[] = [
    { label: 'Text', icon: Type, run: () => turnCellInto(editor, cellId, 'paragraph') },
    { label: 'Heading 1', icon: Heading1, run: () => turnCellInto(editor, cellId, 'heading1') },
    { label: 'Heading 2', icon: Heading2, run: () => turnCellInto(editor, cellId, 'heading2') },
    { label: 'Heading 3', icon: Heading3, run: () => turnCellInto(editor, cellId, 'heading3') },
    { label: 'Quote', icon: TextQuote, run: () => turnCellInto(editor, cellId, 'blockquote') },
    { label: 'Read-aloud', icon: Speech, run: () => turnCellInto(editor, cellId, 'readAloud') },
  ]

  if (canWriteSecrets) {
    turnInto.push({
      label: 'GM only',
      icon: EyeOff,
      run: () => turnCellInto(editor, cellId, 'secret'),
    })
  }

  const actions: MenuAction[] = [
    {
      label: 'Duplicate',
      icon: Copy,
      run: () => {
        const cell = findCell(editor, cellId)
        if (!cell) return

        // The copy carries the original's uid, and the blockUid plugin replaces
        // it on the next transaction — the same path a paste takes.
        const end = cell.pos + cell.node.nodeSize
        editor.chain().focus().insertContentAt(end, cell.node.toJSON()).run()
      },
    },
    {
      label: 'Delete',
      icon: Trash2,
      tone: 'danger',
      run: () => {
        const cell = findCell(editor, cellId)
        if (!cell) return

        editor
          .chain()
          .focus()
          .deleteRange({ from: cell.pos, to: cell.pos + cell.node.nodeSize })
          .run()
      },
    },
  ]

  function choose(action: MenuAction) {
    action.run()
    onClose()
  }

  // Rendered on document.body, not in the editor. In the flow it would be a
  // block of its own and shove every paragraph below it down the page.
  return createPortal(
    <div className="editor-popup cell-menu" ref={menuRef} role="menu" aria-label="Cell actions">
      <div className="cell-menu__group">
        <p className="cell-menu__group-name">Turn into</p>
        {turnInto.map((action) => (
          <MenuRow key={action.label} action={action} onChoose={choose} />
        ))}
      </div>

      <div className="cell-menu__group">
        {actions.map((action) => (
          <MenuRow key={action.label} action={action} onChoose={choose} />
        ))}
      </div>
    </div>,
    document.body,
  )
}

function MenuRow({
  action,
  onChoose,
}: {
  action: MenuAction
  onChoose: (action: MenuAction) => void
}) {
  const Icon = action.icon

  return (
    <button
      type="button"
      className={`cell-menu__item${action.tone === 'danger' ? ' cell-menu__item--danger' : ''}`}
      role="menuitem"
      onClick={() => onChoose(action)}
    >
      <span className="menu-icon" aria-hidden="true">
        <Icon size={16} strokeWidth={2} />
      </span>
      {action.label}
    </button>
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
