import { APP_NAME } from '../../constants'
import { ButtonLink } from '../../components/ui/Button'
import { Page } from '../../components/ui/Page'
import './LandingPage.css'

export function LandingPage() {
  return (
    <Page>
      <section className="landing-intro">
        <h1>{APP_NAME}</h1>
        <p className="landing-intro__tagline">Your campaign, all in one place.</p>
        <p className="landing-intro__body">
          A lightweight home for your tabletop RPG campaigns.
        </p>

        <div className="landing-intro__actions">
          <ButtonLink to="/signup">Get started</ButtonLink>
          <ButtonLink to="/login" variant="secondary">
            Sign in
          </ButtonLink>
        </div>
      </section>

      <section className="landing-later">
        <h2>What will live here</h2>
        <p>
          Campaigns, sessions, characters, locations, quests, notes and maps will be
          added in later iterations. This is the public side of the product.
        </p>
      </section>
    </Page>
  )
}
