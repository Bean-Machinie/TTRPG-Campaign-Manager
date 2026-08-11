import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * A key, as this design system draws one.
 *
 * There were two of these — the sidebar's bordered chip and the palette's
 * ringed one — sitting eight pixels apart in the same field of view and not
 * quite matching. A key is a key; this is the one.
 *
 * The ring rather than a border is deliberate: it costs no layout, so a chip
 * can sit in a flex row next to text without nudging the baseline the way a
 * bordered box does.
 */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-5 shrink-0 items-center justify-center rounded px-1 py-px',
        'font-sans text-xs font-medium text-gray-500 ring-1 ring-gray-200 ring-inset',
        'dark:text-gray-400 dark:ring-gray-700',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
