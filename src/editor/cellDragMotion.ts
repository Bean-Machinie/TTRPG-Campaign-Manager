import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'

type CellBox = {
  pos: number
  element: HTMLElement
  rect: DOMRect
}

type DragMotion = {
  boxes: CellBox[]
  sourceIndex: number
  targetIndex: number
  surfaceTop: number
  onDragOver: (event: DragEvent) => void
}

const activeDrags = new WeakMap<EditorView, DragMotion>()

function cellBoxes(editor: Editor): CellBox[] {
  const boxes: CellBox[] = []

  editor.state.doc.forEach((_node, pos) => {
    const dom = editor.view.nodeDOM(pos)
    if (dom instanceof HTMLElement) {
      boxes.push({ pos, element: dom, rect: dom.getBoundingClientRect() })
    }
  })

  return boxes
}

function clearTransforms(motion: DragMotion) {
  for (const box of motion.boxes) {
    box.element.style.removeProperty('transform')
    box.element.classList.remove('document-cell--drag-source')
  }
}

function animateTo(motion: DragMotion, targetIndex: number) {
  if (motion.targetIndex === targetIndex) return
  motion.targetIndex = targetIndex

  const { boxes, sourceIndex } = motion
  const source = boxes[sourceIndex]
  clearTransforms(motion)
  source.element.classList.add('document-cell--drag-source')

  if (targetIndex < sourceIndex) {
    const previous = boxes[sourceIndex - 1]
    const distance = source.rect.bottom - previous.rect.bottom
    for (let index = targetIndex; index < sourceIndex; index += 1) {
      boxes[index].element.style.transform = `translate3d(0, ${distance}px, 0)`
    }
  } else if (targetIndex > sourceIndex) {
    const next = boxes[sourceIndex + 1]
    const distance = next.rect.top - source.rect.top
    for (let index = sourceIndex + 1; index <= targetIndex; index += 1) {
      boxes[index].element.style.transform = `translate3d(0, ${-distance}px, 0)`
    }
  }
}

function targetIndexAt(motion: DragMotion, clientY: number): number {
  const surfaceShift = motion.boxes[0].element.parentElement?.getBoundingClientRect().top
    ?? motion.surfaceTop
  const offset = surfaceShift - motion.surfaceTop
  const candidates = motion.boxes.filter((_box, index) => index !== motion.sourceIndex)

  for (let index = 0; index < candidates.length; index += 1) {
    const rect = candidates[index].rect
    if (clientY < rect.top + offset + rect.height / 2) return index
  }

  return candidates.length
}

function autoScroll(clientY: number) {
  const edge = 72
  let amount = 0
  if (clientY < edge) amount = -Math.ceil((edge - clientY) / 5)
  if (clientY > window.innerHeight - edge) {
    amount = Math.ceil((clientY - (window.innerHeight - edge)) / 5)
  }
  if (amount !== 0) window.scrollBy({ top: amount, behavior: 'auto' })
}

export function beginCellDrag(editor: Editor, sourcePos: number) {
  finishCellDrag(editor.view)

  const boxes = cellBoxes(editor)
  const sourceIndex = boxes.findIndex((box) => box.pos === sourcePos)
  if (sourceIndex < 0 || boxes.length < 2) return

  const motion: DragMotion = {
    boxes,
    sourceIndex,
    targetIndex: sourceIndex,
    surfaceTop: editor.view.dom.getBoundingClientRect().top,
    onDragOver: () => undefined,
  }

  motion.onDragOver = (event) => {
    autoScroll(event.clientY)
    animateTo(motion, targetIndexAt(motion, event.clientY))
  }

  activeDrags.set(editor.view, motion)
  editor.view.dom.classList.add('document-editor__surface--sorting')
  boxes[sourceIndex].element.classList.add('document-cell--drag-source')
  editor.view.dom.addEventListener('dragover', motion.onDragOver)
}

export function cellDragTarget(view: EditorView) {
  const motion = activeDrags.get(view)
  if (!motion) return null
  return {
    sourcePos: motion.boxes[motion.sourceIndex].pos,
    targetIndex: motion.targetIndex,
  }
}

export function finishCellDrag(view: EditorView) {
  const motion = activeDrags.get(view)
  if (!motion) return

  view.dom.removeEventListener('dragover', motion.onDragOver)
  view.dom.classList.remove('document-editor__surface--sorting')
  clearTransforms(motion)
  activeDrags.delete(view)
}
