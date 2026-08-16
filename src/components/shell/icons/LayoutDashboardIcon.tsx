import { cn } from '../../../lib/cn'
import type { Variants } from 'motion/react'
import { LazyMotion, domMin, m, useAnimation, useReducedMotion } from 'motion/react'
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
} from 'react'
import type { AnimatedIconHandle } from './types'

interface LayoutDashboardIconProps
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
  duration?: number
  isAnimated?: boolean
  color?: string
}

const LayoutDashboardIcon = forwardRef<AnimatedIconHandle, LayoutDashboardIconProps>(
  (
    {
      onMouseEnter,
      onMouseLeave,
      className,
      size = 24,
      duration = 0.6,
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
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (!isAnimated || reduced) return
        if (!isControlled.current) controls.start('animate')
        else onMouseEnter?.(event)
      },
      [controls, reduced, isAnimated, onMouseEnter],
    )

    const handleLeave = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (!isControlled.current) controls.start('normal')
        else onMouseLeave?.(event)
      },
      [controls, onMouseLeave],
    )

    const iconVariants: Variants = {
      normal: { scale: 1, rotate: 0 },
      animate: {
        scale: [1, 1.06, 0.98, 1],
        rotate: [0, -1.5, 1.5, 0],
        transition: { duration: 1.1 * duration, ease: 'easeInOut' },
      },
    }

    const tileVariants: Variants = {
      normal: { opacity: 1, scale: 1, y: 0 },
      animate: (index: number) => ({
        opacity: [0.6, 1],
        scale: [0.95, 1.04, 1],
        y: [3, -2, 0],
        transition: {
          duration: 0.9 * duration,
          ease: 'easeInOut',
          delay: index * 0.08,
        },
      }),
    }

    return (
      <LazyMotion features={domMin} strict>
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
            animate={controls}
            initial="normal"
            variants={iconVariants}
          >
            {[
              { width: 7, height: 9, x: 3, y: 3 },
              { width: 7, height: 5, x: 14, y: 3 },
              { width: 7, height: 9, x: 14, y: 12 },
              { width: 7, height: 5, x: 3, y: 16 },
            ].map((tile, index) => (
              <m.rect
                key={`${tile.x}-${tile.y}`}
                {...tile}
                rx="1"
                variants={tileVariants}
                custom={index}
                initial="normal"
                animate={controls}
              />
            ))}
          </m.svg>
        </m.div>
      </LazyMotion>
    )
  },
)

LayoutDashboardIcon.displayName = 'LayoutDashboardIcon'
export { LayoutDashboardIcon }
