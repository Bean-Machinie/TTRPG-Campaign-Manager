import { cn } from '../../lib/cn'
import { avatarPosition } from '../../profile/avatarPresets'
import type { AvatarPreset } from '../../profile/avatarPresets'

type AvatarProps = {
  initials: string
  /** `xs` aligns with nav icons; `md` is for people in content rows. */
  size?: 'xs' | 'sm' | 'md' | 'xl'
  src?: string | null
  preset?: AvatarPreset | null
  className?: string
}

const SIZES = {
  xs: 'size-5 text-[0.625rem] tracking-tight',
  sm: 'size-6 text-[0.625rem]',
  md: 'size-9 text-xs',
  xl: 'size-36 text-3xl',
} as const

/** Initials, an uploaded image, or one cell from the curated avatar sprite. */
export function Avatar({ initials, size = 'sm', src, preset, className }: AvatarProps) {
  const imageStyle = preset
    ? {
        backgroundImage: 'url(/default-avatars.jpg)',
        backgroundPosition: avatarPosition(preset),
        backgroundSize: '400% 200%',
      }
    : undefined

  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-50 font-semibold text-brand-700',
        'dark:bg-brand-500/15 dark:text-brand-300',
        preset && 'bg-no-repeat',
        SIZES[size],
        className,
      )}
      style={imageStyle}
      aria-hidden="true"
    >
      {src ? <img className="size-full object-cover" src={src} alt="" /> : preset ? null : initials}
    </span>
  )
}
