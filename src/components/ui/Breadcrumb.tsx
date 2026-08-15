import type { ComponentPropsWithoutRef, HTMLAttributes, LiHTMLAttributes } from 'react'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router'
import type { LinkProps } from 'react-router'
import { cn } from '../../lib/cn'

export function Breadcrumb({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <nav aria-label="Breadcrumb" className={cn('min-w-0', className)} {...props} />
}

export function BreadcrumbList({ className, ...props }: ComponentPropsWithoutRef<'ol'>) {
  return (
    <ol
      className={cn(
        'm-0 flex min-w-0 list-none items-center gap-1 overflow-hidden p-0',
        'text-sm text-gray-500 dark:text-gray-400',
        className,
      )}
      {...props}
    />
  )
}

export function BreadcrumbItem({ className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn('flex min-w-0 items-center', className)} {...props} />
}

export function BreadcrumbLink({ className, ...props }: LinkProps) {
  return (
    <Link
      className={cn(
        'truncate rounded-md px-1.5 py-1 font-medium no-underline outline-hidden transition-colors',
        'hover:bg-gray-50 hover:text-gray-700',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        'dark:hover:bg-gray-800/60 dark:hover:text-gray-200',
        className,
      )}
      {...props}
    />
  )
}

export function BreadcrumbPage({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-current="page"
      className={cn('truncate px-1.5 py-1 font-semibold text-gray-700 dark:text-gray-200', className)}
      {...props}
    />
  )
}

export function BreadcrumbSeparator({ className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center text-gray-300 dark:text-gray-700', className)}
      {...props}
    >
      <ChevronRight className="size-4" />
    </li>
  )
}

export function BreadcrumbEllipsis({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={cn('grid size-5 place-items-center', className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
    </span>
  )
}
