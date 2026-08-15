import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type SeparatorProps = HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical'
}

export function Separator({ orientation = 'horizontal', className, ...props }: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-gray-200 dark:bg-gray-700',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-5 w-px',
        className,
      )}
      {...props}
    />
  )
}
