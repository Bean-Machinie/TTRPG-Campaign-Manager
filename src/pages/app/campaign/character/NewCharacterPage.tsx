import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../../../auth/useAuth'
import { useCampaignMembers, useGameSystems } from '../../../../campaigns/hooks'
import { createEntity } from '../../../../campaigns/campaignsApi'
import { emptyEntityData } from '../../../../entities/entityData'
import { catalogFor } from '../../../../entities/srd/catalog'
import { validateStep } from '../../../../entities/wizard/steps'
import type { WizardContext, WizardDraft } from '../../../../entities/wizard/steps'
import { errorMessage } from '../../../../lib/errors'
import { Alert } from '../../../../components/ui/Alert'
import { Button } from '../../../../components/ui/Button'
import { useCampaignOutlet } from '../useCampaignOutlet'
import { CharacterCreationStepper } from './CharacterCreationStepper'
import { WizardSummary } from './WizardSummary'
import { SetupStep } from './steps/SetupStep'
import { writeDraftPortrait } from './draftPortrait'

/**
 * Where a character starts, and the only step with no draft behind it.
 *
 * Nothing is written until this step is finished, and the reason is the check
 * constraint: a row needs a name, and a name is exactly what this step
 * collects. Creating the draft on arrival instead would mean a row called
 * "Untitled" for every stray click on New character, and a drafts list that
 * fills up with things nobody started.
 *
 * On continue the row is created and the URL is *replaced*, so the history
 * entry for this page is gone: Back from step two goes to the character list
 * rather than to an empty form that would create a second draft.
 *
 * Which way it continues is the kind's decision. A player character goes to
 * step two of the wizard; an NPC or a creature goes to quick create, because a
 * GM inventing a shopkeeper mid-session is not building a character, they are
 * writing one down. The full sequence stays one link away for the ones that
 * deserve it.
 */
export function NewCharacterPage() {
  const { campaign, role } = useCampaignOutlet()
  const { user } = useAuth()
  const navigate = useNavigate()

  const { systems, loading, error } = useGameSystems()
  const { members } = useCampaignMembers(campaign.id)

  const canManage = role !== 'player'
  const [draft, setDraft] = useState<WizardDraft | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [portrait, setPortrait] = useState<string | null>(null)

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading rulesets…</p>
  }

  if (error) return <Alert>{error}</Alert>

  if (systems.length === 0) {
    return (
      <Alert>
        No rulesets are available. The `game_systems` table needs its seed row before a
        character can be created.
      </Alert>
    )
  }

  const value = draft ?? blank(systems[0].id, canManage, user?.id)
  const system = systems.find((entry) => entry.id === value.systemId) ?? systems[0]
  const context: WizardContext = {
    definition: system.definition,
    catalog: catalogFor(system.key),
  }

  const problems = validateStep('setup', value, context)

  async function start(destination: 'wizard' | 'quick') {
    setActionError(null)
    setBusy(true)

    try {
      const id = await createEntity(campaign.id, value, 'draft')
      writeDraftPortrait(id, portrait)
      const base = `/app/campaigns/${campaign.id}/entities/new/${id}`

      navigate(destination === 'quick' ? `${base}/quick` : `${base}/class`, { replace: true })
    } catch (caught) {
      setActionError(errorMessage(caught, 'Could not start that character.'))
      setBusy(false)
    }
  }

  const quick = value.kind !== 'pc'

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">New character</h1>
      </header>

      {actionError ? <Alert>{actionError}</Alert> : null}

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <CharacterCreationStepper
            currentStep="setup"
            isStepEnabled={(step) => step === 'setup'}
            onStepChange={() => undefined}
            previousDisabled
            nextDisabled={busy || problems.length > 0}
            onPrevious={() => undefined}
            onNext={() => void start(quick ? 'quick' : 'wizard')}
            nextLabel={busy ? 'Starting…' : 'Next'}
          >
            <section className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
              <div>
                <p className="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Identity and rules
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Who this is, and which rules they are built under.
                </p>
              </div>

              <SetupStep
                draft={value}
                context={context}
                onChange={(changes) => setDraft({ ...value, ...changes })}
                onPatchData={(changes) =>
                  setDraft({ ...value, data: { ...value.data, ...changes } })
                }
                members={members}
                canManage={canManage}
                systems={systems}
              />

              {problems.length > 0 ? (
                <Alert>
                  <ul className="list-disc pl-4">
                    {problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                </Alert>
              ) : null}

              {quick ? (
                <Button
                  className="self-start"
                  variant="secondary"
                  disabled={busy || problems.length > 0}
                  onClick={() => void start('wizard')}
                >
                  Build with full rules
                </Button>
              ) : null}
            </section>
          </CharacterCreationStepper>

          {quick ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              An {value.kind === 'npc' ? 'NPC' : 'creature'} goes to one short page: a
              description and a statblock, with nothing derived. Build with full rules to take
              it through all seven steps instead.
            </p>
          ) : null}
        </div>

        <WizardSummary
          draft={value}
          context={context}
          portrait={portrait}
          onPortraitChange={setPortrait}
        />
      </div>
    </div>
  )
}

/** A character with nothing decided, which is what step one is for deciding. */
function blank(systemId: string, canManage: boolean, userId: string | undefined): WizardDraft {
  const kind = canManage ? 'npc' : 'pc'

  return {
    name: '',
    kind,
    systemId,
    // A player may only ever create their own character, and the database
    // policies say the same thing. Filling it in here saves them a field that
    // has one legal value.
    playerUserId: kind === 'pc' ? (userId ?? null) : null,
    summary: null,
    visibility: 'shared',
    data: emptyEntityData(kind),
  }
}
