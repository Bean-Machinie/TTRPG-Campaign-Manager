import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronsUpDown, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { LazyMotion, domAnimation, m } from 'motion/react'
import type { Variants } from 'motion/react'
import { useAuth } from '../../auth/useAuth'
import { useMyProfile } from '../../profile/hooks'
import { useTheme } from '../../theme/useTheme'
import { cn } from '../../lib/cn'
import { menuIcon, menuItem, menuPanel, menuSeparator } from '../ui/menuStyles'
import { Avatar } from './Avatar'
import { initialsOf } from './navigation'

/**
 * Who you are signed in as, and everything that follows from that.
 *
 * The row identifies you and the panel acts. That split is what the previous
 * version did not have: the panel opened onto a row repeating your name, and
 * under it a "Settings" row going to the same route the name row went to — two
 * rows, one destination, and your email nowhere on screen at all. The identity
 * now lives entirely in the trigger, which has room for it, and the panel holds
 * only the three things there are to do.
 *
 * The chevron is `ChevronsUpDown` rather than a single caret because the panel
 * opens upward from a control at the bottom of the sidebar; a caret pointing
 * down would be describing the wrong direction half the time.
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
      {/*
        `aria-expanded` is doing double duty: it tells a screen reader the panel
        is open and it is the selector that keeps the row lit while it is.
      */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'group flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left',
          'outline-hidden transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          'hover:bg-gray-50 aria-expanded:bg-gray-50',
          'dark:hover:bg-gray-800/60 dark:aria-expanded:bg-gray-800/60',
        )}
      >
        <Avatar initials={initialsOf(name)} size="md" />

        {/* Two lines in the space one used to take: the avatar is 36px and a
            13px name over an 11px address is 34px, so the row does not grow. */}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
            {name}
          </span>
          {email ? (
            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{email}</span>
          ) : null}
        </span>

        <ChevronsUpDown
          className={cn(
            'size-4 shrink-0 transition-colors',
            'text-gray-400 group-hover:text-gray-500',
            'dark:text-gray-500 dark:group-hover:text-gray-400',
          )}
          aria-hidden="true"
        />
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
          className={cn(menuPanel, 'absolute inset-x-0 bottom-full mb-2')}
        >
          <m.button
            variants={itemVariants}
            role="menuitem"
            onClick={() => go('/app/settings')}
            className={menuItem()}
          >
            <Settings className={menuIcon} aria-hidden="true" />
            <span className="flex-1">Settings</span>
          </m.button>

          {/*
            The whole row toggles, rather than being a label with a switch
            parked at the end of it that is the only live 36 pixels in a 235px
            row. `menuitemcheckbox` rather than `switch` because this is inside
            a menu: it is the role that means "a checkable thing in a list of
            commands", and it is what a screen reader expects to find here. The
            track below is then decoration and carries no semantics at all.
          */}
          <m.button
            variants={itemVariants}
            type="button"
            role="menuitemcheckbox"
            aria-checked={isDark}
            onClick={toggleTheme}
            className={menuItem()}
          >
            {isDark ? (
              <Moon className={menuIcon} aria-hidden="true" />
            ) : (
              <Sun className={menuIcon} aria-hidden="true" />
            )}
            <span className="flex-1">Dark mode</span>
            <span
              aria-hidden="true"
              className={cn(
                'inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                isDark ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700',
              )}
            >
              <span
                className={cn(
                  'block size-4 rounded-full bg-white shadow-xs transition-transform',
                  isDark ? 'translate-x-4' : 'translate-x-0.5',
                )}
              />
            </span>
          </m.button>

          <div role="separator" className={menuSeparator} />

          <m.button
            variants={itemVariants}
            role="menuitem"
            onClick={handleSignOut}
            className={menuItem('danger')}
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">Sign out</span>
          </m.button>
        </m.div>
      </LazyMotion>
    </div>
  )
}
