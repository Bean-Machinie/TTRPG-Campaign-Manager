import { useEffect, useRef, type Ref } from 'react'
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
    return <MotionNavIcon icon={icon} className={className} size={size} forwardedRef={ref} />
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

function MotionNavIcon({
  icon,
  className,
  size,
  forwardedRef,
}: {
  icon: Extract<SectionIcon, { kind: 'motion' }>
  className?: string
  size: number
  forwardedRef?: Ref<AnimatedIconHandle>
}) {
  const hostRef = useRef<HTMLSpanElement>(null)
  const handleRef = useRef<AnimatedIconHandle | null>(null)
  const Icon = icon.component

  useEffect(() => {
    const row = hostRef.current?.closest<HTMLElement>('.icon-host')
    if (!row) return

    const start = () => handleRef.current?.startAnimation()
    const stop = () => handleRef.current?.stopAnimation()
    row.addEventListener('pointerenter', start)
    row.addEventListener('pointerleave', stop)
    row.addEventListener('focusin', start)
    row.addEventListener('focusout', stop)

    return () => {
      row.removeEventListener('pointerenter', start)
      row.removeEventListener('pointerleave', stop)
      row.removeEventListener('focusin', start)
      row.removeEventListener('focusout', stop)
    }
  }, [])

  return (
    <span ref={hostRef} className="inline-flex shrink-0">
      <Icon
        ref={(handle) => {
          handleRef.current = handle
          if (typeof forwardedRef === 'function') forwardedRef(handle)
          else if (forwardedRef) forwardedRef.current = handle
        }}
        size={size}
        className={cn('shrink-0', className)}
        aria-hidden="true"
      />
    </span>
  )
}
