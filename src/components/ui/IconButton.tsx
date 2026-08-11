import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '../../lib/cn'

/**
 * A button that is only its icon.
 *
 * Every square control in the chrome used to spell its own hover, its own
 * radius and its own grey out of the same handful of utilities, and they had
 * drifted: `rounded-md` here, `hover:bg-gray-50` there, no focus ring on any of
 * them. This is that button, once.
 *
 * Two things it does that the hand-written ones did not. `aria-expanded` styles
 * itself, so a control that has opened a menu stays lit while the menu is up
 * without needing a second `data-` attribute threaded down from state. And
 * `icon-host` is on by default, so the icons in `icons.css` animate from the
 * whole 40px target rather than from the 20px glyph inside it.
 */

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `sm` for dense rows, `md` for the top bar. */
  size?: 'sm' | 'md'
  ref?: Ref<HTMLButtonElement>
}

export function IconButton({ size = 'md', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        // 8px on this project's scale — see global.css, which redefines it.
        'icon-host inline-grid shrink-0 cursor-pointer place-items-center rounded-md',
        'text-gray-500 outline-hidden transition-colors',
        'hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        'aria-expanded:bg-gray-100 aria-expanded:text-gray-700',
        'dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 dark:active:bg-gray-700',
        'dark:aria-expanded:bg-gray-800 dark:aria-expanded:text-gray-200',
        size === 'sm' ? 'size-8' : 'size-10',
        className,
      )}
      {...rest}
    />
  )
}
