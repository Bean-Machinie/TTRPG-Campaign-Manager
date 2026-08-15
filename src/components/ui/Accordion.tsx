import { createContext, useContext, useMemo, useState } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type AccordionContextValue = {
  expanded: Set<string>
  toggle: (value: string) => void
}

const AccordionContext = createContext<AccordionContextValue | null>(null)
const AccordionItemContext = createContext<string | null>(null)

export function Accordion({
  multiple = false,
  defaultValue = [],
  className,
  children,
}: {
  multiple?: boolean
  defaultValue?: string[]
  className?: string
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(() => new Set(defaultValue))
  const value = useMemo<AccordionContextValue>(
    () => ({
      expanded,
      toggle: (item) =>
        setExpanded((current) => {
          const next = multiple ? new Set(current) : new Set<string>()
          if (current.has(item)) next.delete(item)
          else next.add(item)
          return next
        }),
    }),
    [expanded, multiple],
  )

  return (
    <AccordionContext.Provider value={value}>
      <div className={cn('divide-y divide-gray-200 dark:divide-gray-800', className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

export function AccordionItem({ value, className, ...props }: HTMLAttributes<HTMLDivElement> & { value: string }) {
  return (
    <AccordionItemContext.Provider value={value}>
      <div className={cn('py-1', className)} {...props} />
    </AccordionItemContext.Provider>
  )
}

export function AccordionTrigger({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const accordion = useContext(AccordionContext)
  const item = useContext(AccordionItemContext)
  if (!accordion || !item) throw new Error('AccordionTrigger must be inside an AccordionItem.')
  const open = accordion.expanded.has(item)

  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => accordion.toggle(item)}
      className={cn(
        'group flex w-full cursor-pointer items-center gap-3 rounded-md py-3 text-left',
        'text-sm font-semibold text-gray-900 outline-hidden transition-colors',
        'hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        'dark:text-gray-100 dark:hover:text-brand-300',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function AccordionContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const accordion = useContext(AccordionContext)
  const item = useContext(AccordionItemContext)
  if (!accordion || !item) throw new Error('AccordionContent must be inside an AccordionItem.')
  if (!accordion.expanded.has(item)) return null

  return <div className={cn('pb-4', className)} {...props} />
}
