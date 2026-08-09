import type { Ref } from 'react'
import { cn } from '../../lib/cn'
import type { SectionIcon } from './navigation'
import type { AnimatedIconHandle } from './icons/types'
import './icons.css'

/**
 * One icon, whichever kind it is.
 *
 * A Motion icon is handed the ref so the row above can start and stop it; a
 * Lucide glyph is handed a `data-motion` and animates from CSS when that same
 * row is hovered. Callers pass a ref either way and never branch — a nav row
 * should not have to know which sort of drawing it was given.
 */
type NavIconProps = {
  icon: SectionIcon
  className?: string
  size?: number
  ref?: Ref<AnimatedIconHandle>
}

export function NavIcon({ icon, className, size = 20, ref }: NavIconProps) {
  if (icon.kind === 'motion') {
    const Icon = icon.component
    return <Icon ref={ref} size={size} className={cn('shrink-0', className)} aria-hidden="true" />
  }

  const Icon = icon.component
  return (
    <Icon
      size={size}
      className={cn('ui-icon shrink-0', className)}
      data-motion={icon.motion}
      aria-hidden="true"
    />
  )
}
