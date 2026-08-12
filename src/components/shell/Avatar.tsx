import { cn } from '../../lib/cn'

type AvatarProps = {
  initials: string
  /**
   * `xs` is exactly the width of a nav row's icon, which is the whole reason it
   * exists: a campaign listed among navigation items has to start its label on
   * the same vertical line the items above it do, and a 24px tile in a 20px
   * column puts every campaign name four pixels to the right of every other
   * label in the panel. `sm` names a campaign, `md` names a person.
   */
  size?: 'xs' | 'sm' | 'md'
}

const SIZES = {
  xs: 'size-5 rounded text-[0.625rem] tracking-tight',
  sm: 'size-6 rounded-md text-[0.625rem]',
  md: 'size-9 rounded-lg text-xs',
} as const

/** Initials on a tinted square — every campaign and every person gets one, nothing else. */
export function Avatar({ initials, size = 'sm' }: AvatarProps) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center bg-brand-50 font-semibold text-brand-700',
        'dark:bg-brand-500/15 dark:text-brand-300',
        SIZES[size],
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
