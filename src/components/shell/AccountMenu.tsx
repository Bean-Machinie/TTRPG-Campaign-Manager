import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { LogOut, Moon, Settings, Sun } from 'lucide-react'
import { LazyMotion, domAnimation, m } from 'motion/react'
import type { Variants } from 'motion/react'
import { useAuth } from '../../auth/useAuth'
import { useMyProfile } from '../../profile/hooks'
import { useTheme } from '../../theme/useTheme'
import { cn } from '../../lib/cn'
import { Avatar } from './Avatar'
import { initialsOf } from './navigation'

/**
 * Who you are signed in as, and everything that follows from that.
 *
 * The panel never unmounts — it sits in the DOM at all times with `inert`
 * standing in for conditional rendering, which is what lets the *closing*
 * animation play instead of the panel just vanishing. `inert` does the job
 * conditional rendering used to: unreachable by tab, click or screen reader
 * while closed.
 *
 * Motion's variant propagation drives the choreography: every row declares
 * the same `open`/`closed` names as the panel and inherits whichever one is
 * active, so there is no per-row state. Opening runs the panel first
 * (`when: 'beforeChildren'`) then cascades the rows in with a small stagger;
 * closing reverses that (`when: 'afterChildren'`) so the rows retreat before
 * the panel folds. `transformOrigin: 'bottom'` is what makes that fold read as
 * the panel bursting out of the row underneath it, rather than growing from
 * its own center — the panel opens upward, anchored to the account row.
 */

const panelVariants: Variants = {
  open: {
    scaleY: 1,
    opacity: 1,
    transition: {
      duration: 0.13,
      ease: [0.34, 1.56, 0.64, 1],
      when: 'beforeChildren',
      staggerChildren: 0.028,
    },
  },
  closed: {
    scaleY: 0,
    opacity: 0,
    transition: {
      duration: 0.1,
      ease: [0.4, 0, 1, 1],
      when: 'afterChildren',
      staggerChildren: 0.018,
    },
  },
}

const itemVariants: Variants = {
  open: { opacity: 1, y: 0, transition: { duration: 0.11, ease: [0.22, 1, 0.36, 1] } },
  closed: { opacity: 0, y: -8, transition: { duration: 0.07 } },
}

const itemClass = cn(
  'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium',
  'text-gray-700 outline-hidden transition-colors hover:bg-gray-50',
  'dark:text-gray-300 dark:hover:bg-gray-800/60',
)

export function AccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth()
  const { profile } = useMyProfile(user?.id)
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const email = user?.email ?? ''
  const name = profile?.displayName?.trim() || email.split('@')[0] || 'Signed in'

  // Outside click and Escape both close it; neither is wired up while the
  // panel is already closed, so a signed-in session sitting idle costs
  // nothing.
  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function go(to: string) {
    setOpen(false)
    onNavigate?.()
    navigate(to)
  }

  async function handleSignOut() {
    setOpen(false)
    onNavigate?.()
    await signOut()
    navigate('/')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
      >
        <Avatar initials={initialsOf(name)} size="md" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {name}
        </span>
      </button>

      <LazyMotion features={domAnimation} strict>
        <m.div
          role="menu"
          aria-label="Account"
          aria-hidden={!open}
          inert={!open}
          initial="closed"
          animate={open ? 'open' : 'closed'}
          variants={panelVariants}
          style={{ transformOrigin: 'bottom' }}
          className="absolute inset-x-0 bottom-full z-50 mb-2 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          <m.button
            variants={itemVariants}
            role="menuitem"
            onClick={() => go('/app/settings')}
            className={itemClass}
          >
            <Avatar initials={initialsOf(name)} size="sm" />
            <span className="min-w-0 flex-1 truncate">{name}</span>
          </m.button>

          <m.button
            variants={itemVariants}
            role="menuitem"
            onClick={() => go('/app/settings')}
            className={itemClass}
          >
            <Settings className="size-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            <span className="flex-1">Settings</span>
          </m.button>

          <m.div
            variants={itemVariants}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {isDark ? (
              <Moon className="size-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            ) : (
              <Sun className="size-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            )}
            <span className="flex-1 text-left">Dark mode</span>
            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              aria-label="Toggle dark mode"
              onClick={toggleTheme}
              className={cn(
                'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
                isDark ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700',
              )}
            >
              <span
                className={cn(
                  'block size-4 rounded-full bg-white shadow-xs transition-transform',
                  isDark ? 'translate-x-4' : 'translate-x-0.5',
                )}
              />
            </button>
          </m.div>

          <div className="my-1.5 h-px bg-gray-100 dark:bg-gray-800" />

          <m.button
            variants={itemVariants}
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-error-700 outline-hidden transition-colors hover:bg-error-50 dark:text-error-500 dark:hover:bg-error-500/10"
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">Sign out</span>
          </m.button>
        </m.div>
      </LazyMotion>
    </div>
  )
}
