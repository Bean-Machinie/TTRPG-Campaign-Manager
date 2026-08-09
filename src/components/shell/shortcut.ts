/**
 * The keystroke that opens search.
 *
 * ⌘K where that is the convention and Ctrl K everywhere else, decided once at
 * module load: the label on the sidebar's search field and the check in the
 * shell's key handler have to agree, and a field that advertises a shortcut
 * that does not work is worse than one that advertises none.
 */
const isApple =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

export const SEARCH_SHORTCUT_LABEL = isApple ? '⌘K' : 'Ctrl K'

export function isSearchShortcut(event: KeyboardEvent) {
  if (event.key !== 'k' && event.key !== 'K') return false
  return isApple ? event.metaKey : event.ctrlKey
}
