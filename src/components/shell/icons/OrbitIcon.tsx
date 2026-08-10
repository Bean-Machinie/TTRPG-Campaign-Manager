import { cn } from '../../../lib/cn'
import type { Variants } from 'motion/react'
import { LazyMotion, domAnimation, m, useAnimation, useReducedMotion } from 'motion/react'
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
} from 'react'

/**
 * A body with two satellites, turning for as long as you point at it.
 *
 * The gesture is animate-ui's `orbit` default: the whole drawing rotates at a
 * constant rate, which is the one motion that reads as orbiting rather than as
 * an icon being jostled. It loops instead of playing once because a single
 * revolution ending in place would look like a stutter — the row stops the
 * animation when the pointer leaves, and the turn unwinds from wherever it got to.
 */

export interface OrbitIconHandle {
  startAnimation: () => void
  stopAnimation: () => void
}

interface OrbitIconProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    | 'color'
    | 'onDrag'
    | 'onDragStart'
    | 'onDragEnd'
    | 'onAnimationStart'
    | 'onAnimationEnd'
    | 'onAnimationIteration'
  > {
  size?: number
  /** Seconds per revolution. */
  duration?: number
  isAnimated?: boolean
  color?: string
}

const OrbitIcon = forwardRef<OrbitIconHandle, OrbitIconProps>(
  (
    {
      onMouseEnter,
      onMouseLeave,
      className,
      size = 24,
      duration = 2,
      isAnimated = true,
      color,
      ...props
    },
    ref,
  ) => {
    const controls = useAnimation()
    const reduced = useReducedMotion()
    const isControlled = useRef(false)

    useImperativeHandle(ref, () => {
      isControlled.current = true
      return {
        startAnimation: () =>
          reduced ? controls.start('normal') : controls.start('animate'),
        stopAnimation: () => controls.start('normal'),
      }
    })

    const handleEnter = useCallback(
      (e?: React.MouseEvent<HTMLDivElement>) => {
        if (!isAnimated || reduced) return
        if (!isControlled.current) controls.start('animate')
        else onMouseEnter?.(e as React.MouseEvent<HTMLDivElement>)
      },
      [controls, reduced, isAnimated, onMouseEnter],
    )

    const handleLeave = useCallback(
      (e?: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlled.current) controls.start('normal')
        else onMouseLeave?.(e as React.MouseEvent<HTMLDivElement>)
      },
      [controls, onMouseLeave],
    )

    const orbitVariants: Variants = {
      normal: { rotate: 0 },
      animate: {
        rotate: 360,
        transition: {
          duration,
          ease: 'linear' as const,
          repeat: Infinity,
          repeatType: 'loop' as const,
        },
      },
    }

    return (
      <LazyMotion features={domAnimation} strict>
        <m.div
          className={cn('inline-flex items-center justify-center', className)}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          {...props}
          style={{ color, ...props.style }}
        >
          <m.svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-orbit-icon lucide-orbit"
            variants={orbitVariants}
            initial="normal"
            animate={controls}
          >
            <path d="M20.341 6.484A10 10 0 0 1 10.266 21.85" />
            <path d="M3.659 17.516A10 10 0 0 1 13.74 2.152" />
            <circle cx="12" cy="12" r="3" />
            <circle cx="19" cy="5" r="2" />
            <circle cx="5" cy="19" r="2" />
          </m.svg>
        </m.div>
      </LazyMotion>
    )
  },
)

OrbitIcon.displayName = 'OrbitIcon'
export { OrbitIcon }
