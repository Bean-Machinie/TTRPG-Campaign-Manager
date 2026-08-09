/**
 * Positioning for the two popovers the editor owns: the slash menu and the
 * block menu.
 *
 * Hand-rolled rather than pulled from a positioning library. Both popovers
 * anchor to a rectangle, open downward, and flip up when there is no room —
 * that is the whole requirement, and it is smaller than the configuration a
 * library would need. The bubble menu is not here: Tiptap's own BubbleMenu
 * positions itself.
 */

const GAP = 6

const VIEWPORT_MARGIN = 8

export function createPopupContainer(className: string): HTMLDivElement {
  const element = document.createElement('div')
  element.className = className
  // Off-screen until the first position lands, so it cannot flash in the
  // corner on the frame it is created.
  element.style.position = 'fixed'
  element.style.top = '-9999px'
  element.style.left = '-9999px'
  element.style.zIndex = '40'
  document.body.append(element)
  return element
}

/** Places `element` under `anchor`, flipping above it when it would overflow. */
export function positionPopup(element: HTMLElement, anchor: DOMRect | null): void {
  if (!anchor) return

  const { width, height } = element.getBoundingClientRect()

  const spaceBelow = window.innerHeight - anchor.bottom
  const flip = spaceBelow < height + GAP + VIEWPORT_MARGIN && anchor.top > height + GAP

  const top = flip ? anchor.top - height - GAP : anchor.bottom + GAP

  const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN
  const left = Math.max(VIEWPORT_MARGIN, Math.min(anchor.left, maxLeft))

  element.style.top = `${Math.round(top)}px`
  element.style.left = `${Math.round(left)}px`
}

export function removePopupContainer(element: HTMLElement | null): void {
  element?.remove()
}
