import { NavLink, Outlet } from 'react-router'
import { NavIcon } from '../../../components/shell/NavIcon'
import { MATERIAL_GROUPS } from '../../../components/shell/navigation'
import { PageHeader } from '../../../components/ui/Page'
import { cn } from '../../../lib/cn'
import { useCampaignOutlet } from './useCampaignOutlet'
import './CampaignMaterialPage.css'

/** One nested home for everything a campaign accumulates. */
export function CampaignMaterialPage() {
  const context = useCampaignOutlet()

  return (
    <div className="material-page">
      <PageHeader
        title="Material"
        description="Documents, notes and quests arranged in one campaign library."
      />

      <div className="material-workspace">
        <aside className="material-browser" aria-label="Material types">
          <p className="material-browser__label">Library</p>
          <div className="material-browser__tree">
            {MATERIAL_GROUPS.map((group, index) => (
              <NavLink
                key={group.path}
                to={group.path}
                className={({ isActive }) =>
                  cn('material-browser__link icon-host', isActive && 'material-browser__link--active')
                }
              >
                <span className="material-browser__branch" aria-hidden="true">
                  <span className="material-browser__line" />
                  <span className="material-browser__elbow" />
                  {index < MATERIAL_GROUPS.length - 1 ? (
                    <span className="material-browser__tail" />
                  ) : null}
                </span>
                <NavIcon icon={group.icon} size={18} />
                <span>{group.label}</span>
              </NavLink>
            ))}
          </div>
        </aside>

        <main className="material-content">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  )
}
