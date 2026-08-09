/**
 * The one thing every animated icon in this folder agrees on.
 *
 * Each icon is a copy-in component from lucide-animated, and each declares its
 * own identically-shaped handle. This is that shape, named once, so the sidebar
 * can hold a ref to "an icon" without caring which one it got.
 *
 * The handle matters because of how those components decide when to play: left
 * alone they animate when the pointer is over the *glyph*, but attaching a ref
 * hands that decision to the parent — and in a sidebar the thing you point at
 * is the row, not the 20 pixels of picture at its left edge.
 */
export type AnimatedIconHandle = {
  startAnimation: () => void
  stopAnimation: () => void
}
