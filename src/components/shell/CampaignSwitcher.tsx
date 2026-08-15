import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { LazyMotion, domAnimation, m } from 'motion/react'
import type { Variants } from 'motion/react'
import type { CampaignSummary } from '../../campaigns/types'
import { cn } from '../../lib/cn'
import { menuPanel, menuSeparator } from '../ui/menuStyles'
import { Avatar } from './Avatar'
import { initialsOf } from './navigation'

const panelVariants: Variants = {
  open: {
    opacity: 1,
    clipPath: 'inset(0% 0% 0% 0% round 0.75rem)',
    transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] },
  },
  closed: {
    opacity: 0,
    clipPath: 'inset(0% 0% 100% 0% round 0.75rem)',
    transition: { duration: 0.11, ease: [0.4, 0, 1, 1] },
  },
}

type CampaignSwitcherProps = {
  campaigns: CampaignSummary[]
  activeCampaignId: string | null
  onNavigate?: () => void
}

export function CampaignSwitcher({
  campaigns,
  activeCampaignId,
  onNavigate,
}: CampaignSwitcherProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId)

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
    navigate(to)
    onNavigate?.()
  }

  const label = activeCampaign?.name ?? 'All campaigns'
  const initials = activeCampaign ? initialsOf(activeCampaign.name) : 'AC'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'group flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left',
          'text-sm font-semibold text-gray-700 outline-hidden transition-colors',
          'hover:bg-gray-50 aria-expanded:bg-gray-100',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600',
          'dark:text-gray-200 dark:hover:bg-gray-800/60 dark:aria-expanded:bg-gray-800',
        )}
      >
        <Avatar initials={initials} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      <div
        className={cn(
          'absolute inset-x-0 top-full z-50 mt-2',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <LazyMotion features={domAnimation} strict>
          <m.div
            role="menu"
            aria-label="Switch campaign"
            aria-hidden={!open}
            inert={!open}
            initial="closed"
            animate={open ? 'open' : 'closed'}
            variants={panelVariants}
            className={cn(menuPanel, 'max-h-[min(26rem,70vh)] overflow-y-auto')}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => go('/app')}
              className={campaignItemClass(activeCampaignId === null)}
            >
              <Avatar initials="AC" />
              <span className="min-w-0 flex-1 truncate">All campaigns</span>
              {activeCampaignId === null ? <Check className="size-4 text-brand-600" aria-hidden="true" /> : null}
            </button>

            {campaigns.map((campaign) => {
              const active = campaign.id === activeCampaignId
              return (
                <button
                  key={campaign.id}
                  type="button"
                  role="menuitem"
                  onClick={() => go(`/app/campaigns/${campaign.id}`)}
                  className={campaignItemClass(active)}
                >
                  <Avatar initials={initialsOf(campaign.name)} />
                  <span className="min-w-0 flex-1 truncate">{campaign.name}</span>
                  {active ? <Check className="size-4 text-brand-600" aria-hidden="true" /> : null}
                </button>
              )
            })}

            <div role="separator" className={menuSeparator} />

            <button
              type="button"
              role="menuitem"
              onClick={() => go('/app/campaigns/new')}
              className={campaignItemClass(false)}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                <Plus className="size-4" aria-hidden="true" />
              </span>
              <span className="flex-1">Create new campaign</span>
            </button>
          </m.div>
        </LazyMotion>
      </div>
    </div>
  )
}

function campaignItemClass(active: boolean) {
  return cn(
    'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm',
    'font-medium text-gray-700 outline-hidden transition-colors hover:bg-gray-50',
    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600',
    'dark:text-gray-300 dark:hover:bg-gray-800/70',
    active && 'bg-gray-50 text-gray-900 dark:bg-gray-800 dark:text-white',
  )
}
