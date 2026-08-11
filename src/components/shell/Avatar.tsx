import { cn } from '../../lib/cn'

type AvatarProps = {
  initials: string
  size?: 'sm' | 'md'
}

/** Initials on a tinted square — every campaign and every person gets one, nothing else. */
export function Avatar({ initials, size = 'sm' }: AvatarProps) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-md bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
        size === 'sm' ? 'size-6 text-[0.625rem]' : 'size-9 rounded-lg text-xs',
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
