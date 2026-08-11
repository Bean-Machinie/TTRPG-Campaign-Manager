import { cn } from '../../lib/cn'

/**
 * What a menu looks like in this product, written down once.
 *
 * Every popup in the app had invented its own: different radii on the panel and
 * the rows, three different greys for an icon, dividers that stopped short of
 * the panel edge, group headings shouting in uppercase in one menu and
 * whispering in sentence case in the next. The specification is now here, and
 * everything that opens a panel spells it the same way.
 *
 *   panel      12px corners, a hairline ring, 6px of padding
 *   row        8px corners inside that, icon → label → trailing
 *   icon       one step quieter than its label, and it warms on hover
 *   divider    full-bleed, so it divides the panel rather than floating in it
 *   heading    sentence case, small, quiet — a label, not an announcement
 *
 * Class strings rather than components, because the only menu in the shell is
 * the account menu and its rows are Motion elements — a `<MenuItem>` cannot be
 * one of those. The editor's popups are this same specification a second time,
 * in `DocumentEditor.css`: they are portalled outside the shell and written in
 * that file's CSS variables rather than in Tailwind, so the vocabulary is
 * shared even though the two spellings cannot be. Group headings are in that
 * half only — nothing the shell opens has groups in it yet.
 */

/** A ring, not a border: the panel's padding then means what it says. */
export const menuPanel = cn(
  'z-50 overflow-hidden rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-gray-200',
  'dark:bg-gray-900 dark:ring-gray-800',
)

/** Negative margins carry it out through the panel's 6px of padding. */
export const menuSeparator = '-mx-1.5 my-1.5 h-px bg-gray-100 dark:bg-gray-800'

/**
 * An icon inside a row. A named group rather than the bare `group` so that a
 * row sitting inside some other grouped element cannot steal the hover.
 */
export const menuIcon = cn(
  'size-4 shrink-0 text-gray-400 transition-colors',
  'group-hover/menu-item:text-gray-500 dark:text-gray-500 dark:group-hover/menu-item:text-gray-400',
)

export type MenuTone = 'default' | 'danger'

export function menuItem(tone: MenuTone = 'default', className?: string) {
  return cn(
    // rounded-md, not rounded-lg: global.css redefines the radius scale, and on
    // it `md` is the 8px this row wants while `lg` is the panel's 12px.
    'group/menu-item flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2',
    'text-left text-sm font-medium outline-hidden transition-colors',
    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600',
    tone === 'danger'
      ? cn(
          'text-error-700 hover:bg-error-50 focus-visible:bg-error-50',
          'dark:text-error-500 dark:hover:bg-error-500/10 dark:focus-visible:bg-error-500/10',
        )
      : cn(
          'text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50',
          'dark:text-gray-300 dark:hover:bg-gray-800/70 dark:focus-visible:bg-gray-800/70',
        ),
    className,
  )
}
