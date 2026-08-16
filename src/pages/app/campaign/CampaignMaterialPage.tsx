import { Outlet } from 'react-router'
import { useCampaignOutlet } from './useCampaignOutlet'
import './CampaignMaterialPage.css'

/** One nested home for everything a campaign accumulates. */
export function CampaignMaterialPage() {
  const context = useCampaignOutlet()

  return (
    <div className="material-page">
      <main className="material-content">
        <Outlet context={context} />
      </main>
    </div>
  )
}
