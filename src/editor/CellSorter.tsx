import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { Announcements, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Editor } from '@tiptap/react'
import type { Transaction } from '@tiptap/pm/state'
import { CellGutter } from './CellGutter'
import type { GripProps } from './CellGutter'
import { isCellDecorationTransaction, setCellDecoration } from './cellDecorations'
import { currentCellId, moveCell, readCells, sameCells } from './cells'
import type { Cell } from './cells'

/**
 * Sorting, laid over the editor without being inside it.
 *
 * The document stays one ProseMirror instance — one selection, one undo stack,
 * one clipboard — and this component hands each top-level element ProseMirror
 * rendered to dnd-kit as a sortable item. That is the whole trick: dnd-kit never
 * owns a cell, it only measures one, works out where it should sit while a drag
 * is in flight, and reports where it was dropped. The commit is a ProseMirror
 * transaction like any other edit.
 *
 * The alternative — one editor per cell, which is how a notebook usually does
 * this — would have made every cell a sorting island and cost cross-cell
 * selection, cross-cell undo, and copying two paragraphs at once.
 *
 * Every transform dnd-kit computes leaves here as a decoration rather than as a
 * style on the element, for the reason set out in cellDecorations.ts: writing to
 * ProseMirror's own DOM gets the write reverted and the element replaced.
 *
 * Nothing here renders inside the text column. Each component below returns
 * either null or a handle in the margin.
 */

type CellSorterProps = {
  editor: Editor
  /** The positioned ancestor the handles are placed against. */
  container: HTMLElement | null
  canWriteSecrets: boolean
}

/**
 * Subscribes to the editor, deriving a value only from transactions that could
 * have changed it.
 *
 * Decoration transactions are excluded everywhere: they are this component's own
 * echo, they fire on every frame of a drag, and they change neither the document
 * nor the selection.
 */
function useEditorValue<T>(editor: Editor, read: (editor: Editor) => T, keep: (a: T, b: T) => boolean) {
  const [value, setValue] = useState<T>(() => read(editor))
  const latest = useRef({ read, keep })
  latest.current = { read, keep }

  useEffect(() => {
    function refresh() {
      setValue((previous) => {
        const next = latest.current.read(editor)
        return latest.current.keep(previous, next) ? previous : next
      })
    }

    function onTransaction({ transaction }: { transaction: Transaction }) {
      if (!isCellDecorationTransaction(transaction)) refresh()
    }

    editor.on('transaction', onTransaction)
    // The first read happened before ProseMirror had necessarily rendered.
    refresh()

    return () => {
      editor.off('transaction', onTransaction)
    }
  }, [editor])

  return value
}

const identical = <T,>(a: T, b: T) => a === b

/**
 * The cell under a pointer at this height.
 *
 * Height alone, ignoring x. The handle sits in the margin *outside* the cell, so
 * a rule that asked whether the pointer was over the cell itself would drop the
 * gutter the moment the writer reached for it.
 */
function cellAtOffset(cells: Cell[], offsetY: number): string | null {
  let found: Cell | null = null

  for (const cell of cells) {
    if (offsetY < cell.element.offsetTop) break
    found = cell
  }

  return (found ?? cells[0])?.id ?? null
}

/**
 * How far the button row reaches past the surface's left edge, in pixels.
 *
 * Three 1.5rem buttons are wider than the surface's left padding, so the row's
 * outer third hangs over the page margin — outside the container element, where
 * no pointer event of its own ever fires. Hover is therefore decided against the
 * container's box widened by this much, so that the whole strip beside a cell
 * counts as reaching for that cell's controls, not just the sliver of it the
 * buttons happen to occupy.
 *
 * Rounded up from the CSS in DocumentEditor.css: a 74px row whose right edge
 * sits 41px inside the container overhangs it by 33.
 */
const GUTTER_REACH = 40

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export function CellSorter({ editor, container, canWriteSecrets }: CellSorterProps) {
  const cells = useEditorValue(editor, readCells, sameCells)
  const currentId = useEditorValue(editor, currentCellId, identical)

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  // The pointer handler and the announcer are registered once and read the live
  // list through a ref; rebinding them per snapshot would drop a listener in the
  // middle of a gesture.
  const cellsRef = useRef(cells)
  cellsRef.current = cells
  const activeRef = useRef<string | null>(activeId)
  activeRef.current = activeId

  const ids = useMemo(() => cells.map((cell) => cell.id), [cells])

  /*
   * Hover, measured rather than delegated.
   *
   * The listener is on the window and the test is geometric, because the region
   * a writer reaches into for the controls is not the container: it starts a
   * button row's width outside its left edge. Bound to the container instead,
   * the margin beside a tall cell reads as *away* — pointerleave fires, the
   * gutter unmounts, and the buttons are only reachable along the one line they
   * are drawn on.
   */
  useEffect(() => {
    if (!container) return

    const root = container
    let frame = 0

    function onPointerMove(event: PointerEvent) {
      // A cell in flight owns the gutter; hover has nothing to say until the
      // drag is over.
      if (activeRef.current || frame) return
      const { clientX, clientY } = event

      frame = window.requestAnimationFrame(() => {
        frame = 0
        const box = root.getBoundingClientRect()
        const within =
          clientX >= box.left - GUTTER_REACH &&
          clientX <= box.right &&
          clientY >= box.top &&
          clientY <= box.bottom

        setHoveredId(within ? cellAtOffset(cellsRef.current, clientY - box.top) : null)
      })
    }

    function onPointerOut(event: PointerEvent) {
      // A pointer that has left the window sends no further moves, so without
      // this the last one it did send would leave a gutter hanging on whichever
      // cell it was beside.
      if (!event.relatedTarget && !activeRef.current) setHoveredId(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerout', onPointerOut)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerout', onPointerOut)
    }
  }, [container])

  const sensors = useSensors(
    // A few pixels of travel before a drag begins, so that clicking the grip —
    // or passing over it on the way to the menu — is not a one-pixel reorder.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /*
   * While a menu is open its cell keeps the gutter, and hover stops mattering.
   *
   * Without this the menu is unusable: reaching for an item means moving the
   * pointer, moving the pointer retargets the gutter, and the menu would unmount
   * before the click landed.
   */
  const handleMenuOpenChange = useCallback((id: string, open: boolean) => {
    setPinnedId(open ? id : null)
  }, [])

  function handleDragStart(event: DragStartEvent) {
    setPinnedId(null)
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const from = cellsRef.current.find((cell) => cell.id === active.id)
    const to = cellsRef.current.find((cell) => cell.id === over.id)
    if (!from || !to) return

    moveCell(editor, from.index, to.index)
  }

  const announcements = useMemo<Announcements>(() => {
    const place = (id: string | number | undefined) =>
      cellsRef.current.findIndex((cell) => cell.id === id) + 1

    return {
      onDragStart: ({ active }) =>
        `Picked up cell ${place(active.id)} of ${cellsRef.current.length}.`,
      onDragOver: ({ active, over }) =>
        over && over.id !== active.id ? `Now at position ${place(over.id)}.` : undefined,
      onDragEnd: ({ active, over }) =>
        over && over.id !== active.id
          ? `Dropped at position ${place(over.id)}.`
          : 'Left where it was.',
      onDragCancel: () => 'Move cancelled.',
    }
  }, [])

  const gutterId = activeId ?? pinnedId ?? hoveredId

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      // A cell only ever changes its place in the stack, so sideways travel is
      // noise, and a cell dragged off the surface has nowhere to land.
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {cells.map((cell) => (
          <SortableCell
            key={cell.id}
            editor={editor}
            cell={cell}
            canWriteSecrets={canWriteSecrets}
            current={cell.id === currentId}
            hasGutter={cell.id === gutterId}
            onMenuOpenChange={handleMenuOpenChange}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}

type SortableCellProps = {
  editor: Editor
  cell: Cell
  canWriteSecrets: boolean
  current: boolean
  hasGutter: boolean
  onMenuOpenChange: (id: string, open: boolean) => void
}

/**
 * One cell's binding to dnd-kit.
 *
 * It renders no cell — ProseMirror already did that — and at most a handle in
 * the margin. Its real work is the two effects: one points dnd-kit at the
 * existing element so it can be measured and collided with, the other sends back
 * the look dnd-kit has decided the cell should have.
 *
 * A layout effect rather than an ordinary one, so the cell and the pointer
 * dragging it are never a frame apart.
 */
function SortableCell({
  editor,
  cell,
  canWriteSecrets,
  current,
  hasGutter,
  onMenuOpenChange,
}: SortableCellProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cell.id })

  useLayoutEffect(() => {
    setNodeRef(cell.element)
    return () => setNodeRef(null)
  }, [cell.element, setNodeRef])

  const classes = [
    isDragging ? 'document-cell--lifted' : null,
    hasGutter && !isDragging ? 'document-cell--hovered' : null,
    current ? 'document-cell--current' : null,
  ].filter(Boolean)

  const styles = [
    transform ? `transform: translate3d(0, ${Math.round(transform.y)}px, 0);` : null,
    // dnd-kit returns no transition for the cell being dragged, which is right:
    // that one tracks the pointer exactly, and only its neighbours glide.
    transition && !prefersReducedMotion() ? `transition: ${transition};` : null,
  ].filter(Boolean)

  const decoration =
    classes.length > 0 || styles.length > 0
      ? { class: classes.join(' '), style: styles.join(' ') }
      : null

  // No dependency list. Every value above comes from dnd-kit and changes on the
  // renders dnd-kit drives, which are exactly the renders that must repaint;
  // setCellDecoration() drops the call when nothing actually changed.
  useLayoutEffect(() => {
    setCellDecoration(editor.view, cell.id, decoration)
  })

  useEffect(() => {
    const { view } = editor
    return () => setCellDecoration(view, cell.id, null)
  }, [editor, cell.id])

  if (!hasGutter) return null

  const gripProps = { ...attributes, ...listeners, ref: setActivatorNodeRef } as GripProps

  return (
    <CellGutter
      editor={editor}
      cell={cell}
      canWriteSecrets={canWriteSecrets}
      offsetY={transform?.y ?? 0}
      dragging={isDragging}
      gripProps={gripProps}
      onMenuOpenChange={(open) => onMenuOpenChange(cell.id, open)}
    />
  )
}
