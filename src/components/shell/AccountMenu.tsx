import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronUp, LogOut, Moon, Sun, UserRound } from 'lucide-react'
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
 * The row says who, the panel says what. The trigger is one line — a small
 * tile, a name, a caret — because it is the last thing in the panel and the
 * least often used thing in it, and a two-line block with an email in it was
 * claiming three times the height of a nav row to say something you already
 * know. The email is still one click away, at the head of the panel, where it
 * is answering a question rather than filling a corner.
 *
 * The caret points at the panel in both states rather than describing an
 * abstract open/closed: it opens upward from the foot of the sidebar, so it
 * points up while shut — that is where the thing will appear — and rotates to
 * point back down while open, at the row that will take it away again.
 *
 * The panel never unmounts — it sits in the DOM at all times with `inert`
 * standing in for conditional rendering, which is what lets the *closing*
 * animation play instead of the panel just vanishing. `inert` does the job
 * conditional rendering used to: unreachable by tab, click or screen reader
 * while closed.
 *
 * The panel's own box never moves and never resizes — that is the whole fix
 * for both a flicker and a growth that wandered. `scaleY` distorted the text
 * inside it as it scaled; `grid-template-rows` on an absolutely-positioned,
 * intrinsically-sized box was worse, because with `bottom` fixed and no `top`,
 * the browser has to recompute `top` from the animating height on *every
 * frame* (`top = constant − height`), and an auto-sized grid track's `fr`
 * value has no well-defined size to interpolate against — which is exactly
 * what showed up as the box growing from some point above the button in both
 * directions, rather than from the button itself.
 *
 * `clip-path: inset()` sidesteps all of it. The panel is mounted at its real,
 * final size from the first frame — position and dimensions computed once,
 * never touched again — and what animates is only how much of it is clipped
 * away, a purely visual property the compositor handles without ever
 * re-running layout. `inset(100% 0 0 0)` clips everything except a sliver at
 * the very bottom edge; `inset(0 0 0 0)` clips nothing. Interpolating between
 * them reveals the panel from that fixed bottom edge upward, and because the
 * edge itself never moves, neither does the panel's position — it only ever
 * uncovers more of a box that was always exactly where it is now.
 *
 * Motion's row stagger agrees with that on purpose: `staggerDirection: -1`
 * runs the rows bottom to top, so Sign out settles in first and the header
 * last, at the edge the clip is still retreating from. Nothing here is
 * sequenced — `staggerChildren` alone, with no `when` — so the clip and the
 * rows' fade run together rather than as two separate, visible steps.
 */

const panelVariants: Variants = {
  open: {
    opacity: 1,
    clipPath: 'inset(0% 0% 0% 0% round 0.75rem)',
    transition: {
      duration: 0.16,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.028,
      // Bottom row first, top row last — see the docblock above.
      staggerDirection: -1,
    },
  },
  closed: {
    opacity: 0,
    // Clips everything above the bottom-most sliver of the panel, leaving
    // just the rounded corner's own curve visible rather than a hard edge.
    clipPath: 'inset(100% 0% 0% 0% round 0.75rem)',
    transition: {
      duration: 0.11,
      ease: [0.4, 0, 1, 1],
      staggerChildren: 0.018,
    },
  },
}

const itemVariants: Variants = {
  open: { opacity: 1, y: 0, transition: { duration: 0.11, ease: [0.22, 1, 0.36, 1] } },
  // Rises into place rather than dropping in, to match a panel that opens
  // upward: a row starts below where it settles, inside the space the box has
  // not grown into yet.
  closed: { opacity: 0, y: 8, transition: { duration: 0.07 } },
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
          // Eight-pixel corners and a twelve-pixel gutter, the same as every
          // nav row above it. The 24px tile and 6px of vertical padding make a
          // 36px row — the height of a nav row, which is what this is.
          'group flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-1.5 text-left',
          'outline-hidden transition-colors duration-150',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600',
          'hover:bg-gray-50 aria-expanded:bg-gray-50',
          'dark:hover:bg-gray-800/60 dark:aria-expanded:bg-gray-800/60',
        )}
      >
        <Avatar
          initials={initialsOf(name)}
          src={profile?.avatarUrl}
          preset={profile?.avatarPreset}
        />

        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white">
          {name}
        </span>

        <ChevronUp
          className={cn(
            // `transition` and not `transition-colors`: the rotation is the
            // half that has to move.
            'size-4 shrink-0 transition duration-150',
            'text-gray-400 group-hover:text-gray-500',
            'dark:text-gray-500 dark:group-hover:text-gray-400',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {/*
        Fixed in place from the first frame — position and size, both computed
        once and never touched again. `bottom-full` plus `mb-2` is the only
        thing anchoring it, and nothing here ever recomputes that: only the
        `clip-path` on the panel inside changes, so the box itself has nowhere
        to wander from.
      */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-full mb-2',
          // The closed panel keeps its full layout box so clip-path can animate
          // without reflow. Make that invisible box transparent to the mouse;
          // otherwise it sits over the lower campaign rows and swallows their
          // clicks and wheel events even though the menu itself is inert.
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <LazyMotion features={domAnimation} strict>
          <m.div
            role="menu"
            aria-label="Account"
            aria-hidden={!open}
            inert={!open}
            initial="closed"
            animate={open ? 'open' : 'closed'}
            variants={panelVariants}
            className={menuPanel}
          >
            {/*
              Who, in full, at the head of the panel. `presentation` because it
              is not a command: a screen reader walking a menu should hear
              three things it can do, not two things and a paragraph.
            */}
            <m.div variants={itemVariants} role="presentation" className="px-2.5 pt-1 pb-2">
              <p className="m-0 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {name}
              </p>
              {email ? (
                <p className="m-0 truncate text-xs text-gray-500 dark:text-gray-400">{email}</p>
              ) : null}
            </m.div>

            <div role="separator" className={menuSeparator} />

            <m.button
              variants={itemVariants}
              role="menuitem"
              onClick={() => go('/app/profile')}
              className={menuItem()}
            >
              <UserRound className={menuIcon} aria-hidden="true" />
              <span className="flex-1">Profile</span>
            </m.button>

            {/*
              The whole row toggles, rather than being a label with a switch
              parked at the end of it that is the only live 36 pixels in a
              235px row. `menuitemcheckbox` rather than `switch` because this
              is inside a menu: it is the role that means "a checkable thing in
              a list of commands", and it is what a screen reader expects to
              find here. The track below is then decoration and carries no
              semantics at all.
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
    </div>
  )
}
