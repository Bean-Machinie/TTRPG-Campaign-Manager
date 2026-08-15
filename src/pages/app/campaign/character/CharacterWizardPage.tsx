import { useCallback, useState } from 'react'
import type { ComponentType } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../../../auth/useAuth'
import {
  useCampaignEntity,
  useCampaignMembers,
  useGameSystems,
} from '../../../../campaigns/hooks'
import { completeEntity, deleteEntity, updateEntity } from '../../../../campaigns/campaignsApi'
import { invalidateCampaignContents } from '../../../../components/shell/commands'
import type { CampaignEntity } from '../../../../campaigns/types'
import { canEditEntity } from '../../../../entities/access'
import type { EntityData } from '../../../../entities/entityData'
import { catalogFor } from '../../../../entities/srd/catalog'
import {
  WIZARD_STEPS,
  WIZARD_STEP_HINTS,
  WIZARD_STEP_LABELS,
  firstIncompleteStep,
  isWizardStep,
  resolveStep,
  validateStep,
} from '../../../../entities/wizard/steps'
import type { WizardContext, WizardDraft, WizardStep } from '../../../../entities/wizard/steps'
import { SAVE_STATUS_LABELS, useAutosave } from '../../../../documents/useAutosave'
import { errorMessage } from '../../../../lib/errors'
import { Alert } from '../../../../components/ui/Alert'
import { Button } from '../../../../components/ui/Button'
import { useCampaignOutlet } from '../useCampaignOutlet'
import { CharacterCreationStepper } from './CharacterCreationStepper'
import { WizardSummary } from './WizardSummary'
import { SetupStep } from './steps/SetupStep'
import { ClassStep } from './steps/ClassStep'
import { OriginStep } from './steps/OriginStep'
import { AbilitiesStep } from './steps/AbilitiesStep'
import { SkillsStep } from './steps/SkillsStep'
import { DetailsStep } from './steps/DetailsStep'
import { ReviewStep } from './steps/ReviewStep'
import type { StepProps } from './stepProps'
import { readDraftPortrait, writeDraftPortrait } from './draftPortrait'

/**
 * The creation wizard: one draft, seven steps, one route each.
 *
 * The steps are real URLs rather than a number in component state, and the
 * three things that buys are the reason this page exists at all. The back
 * button goes back a step. A step can be linked to. A refresh in the middle of
 * step four returns to step four rather than to step one, because the draft is
 * a row in the database and the step is in the address bar — neither of them is
 * in this component's memory.
 *
 * The route is `.../new/:draftId/:step`, one entry rather than seven, and the
 * step list lives in the wizard module instead of in the route table. That is
 * not brevity: the guard, the progress rail and the order of the steps all read
 * the same list, and a second copy in App.tsx would be a list that could
 * disagree with the one enforcing it.
 *
 * Saving is by autosave, the same hook the document editor uses. There is no
 * Save button anywhere in the flow, because "Continue" already means "I am done
 * with this step" and a second button meaning almost that would be a question
 * about the difference.
 */

const STEP_COMPONENTS: Record<WizardStep, ComponentType<StepProps>> = {
  setup: SetupStep,
  class: ClassStep,
  origin: OriginStep,
  abilities: AbilitiesStep,
  skills: SkillsStep,
  details: DetailsStep,
  review: ReviewStep,
}

export function CharacterWizardPage() {
  const { draftId } = useParams()
  const { entity, loading, error } = useCampaignEntity(draftId)
  const { campaign } = useCampaignOutlet()

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
  }

  if (error) return <Alert>{error}</Alert>

  if (!entity) {
    return (
      <Alert>
        That draft does not exist, or it is not yours.{' '}
        <Link className="underline" to={`/app/campaigns/${campaign.id}/entities`}>
          Back to characters
        </Link>
      </Alert>
    )
  }

  // A finished character is not edited through the wizard. Sending somebody
  // back through seven steps to change one ability score is the thing this
  // restructure exists to stop, so the detail page is where they land.
  if (entity.status === 'complete') {
    return <Navigate to={`/app/campaigns/${campaign.id}/entities/${entity.id}`} replace />
  }

  // Keyed so the draft is seeded from the row exactly once and owned by the
  // wizard from there, the way the document editor is seeded from its body.
  return <Wizard key={entity.id} entity={entity} />
}

function Wizard({ entity }: { entity: CampaignEntity }) {
  const { campaign, role } = useCampaignOutlet()
  const { user } = useAuth()
  const { step } = useParams()
  const navigate = useNavigate()

  const { systems } = useGameSystems()
  const { members } = useCampaignMembers(campaign.id)

  const [draft, setDraft] = useState<WizardDraft>({
    name: entity.name,
    kind: entity.kind,
    systemId: entity.systemId,
    playerUserId: entity.playerUserId,
    summary: entity.summary,
    visibility: entity.visibility,
    data: entity.data,
  })

  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [portrait, setPortrait] = useState<string | null>(() => readDraftPortrait(entity.id))

  const save = useCallback(
    (value: WizardDraft) => updateEntity(entity.id, value),
    [entity.id],
  )
  const { schedule, status: saveStatus, error: saveError } = useAutosave(save)

  const system = systems.find((entry) => entry.id === draft.systemId)
  const wizardHref = `/app/campaigns/${campaign.id}/entities/new/${entity.id}`

  if (!system) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading ruleset…</p>
  }

  if (!canEditEntity(entity, role, user?.id)) {
    return <Alert>This character is not yours to edit.</Alert>
  }

  const context: WizardContext = {
    definition: system.definition,
    catalog: catalogFor(system.key),
  }

  // Anything that is not a step — `resume`, or a URL somebody mistyped — means
  // "wherever this draft got to". That is the same question the guard answers,
  // so it is answered with the same function rather than with a stored cursor.
  if (!isWizardStep(step)) {
    return <Navigate to={`${wizardHref}/${firstIncompleteStep(draft, context)}`} replace />
  }

  const allowed = resolveStep(step, draft, context)

  // The guard. A step whose dependencies are not met redirects to the earliest
  // gap, so `.../skills` on a draft with no class lands on `.../class`.
  // Replace rather than push: a redirect the user did not ask for should not be
  // something they have to press Back through twice.
  if (allowed !== step) {
    return <Navigate to={`${wizardHref}/${allowed}`} replace />
  }

  const problems = validateStep(allowed, draft, context)
  const index = WIZARD_STEPS.indexOf(allowed)

  // Computed outside the state updater rather than inside it. An updater is
  // meant to be pure, and scheduling a save from within one is a side effect
  // React is free to run twice.
  function update(changes: Partial<WizardDraft>) {
    const next = { ...draft, ...changes }
    setDraft(next)
    schedule(next)
  }

  function patchData(changes: Partial<EntityData>) {
    update({ data: { ...draft.data, ...changes } })
  }

  function goTo(target: WizardStep) {
    navigate(`${wizardHref}/${target}`)
  }

  async function finish() {
    setActionError(null)
    setBusy(true)

    try {
      // Saved and then completed, in that order and as two calls. A completion
      // that fails leaves a draft that is still a draft, rather than a
      // character saved under a status nobody chose.
      await updateEntity(entity.id, draft)
      await completeEntity(entity.id)
      // The campaign has one more character in it than the sidebar thinks.
      invalidateCampaignContents(campaign.id)
      navigate(`/app/campaigns/${campaign.id}/entities/${entity.id}`, { replace: true })
    } catch (caught) {
      setActionError(errorMessage(caught, 'Could not finish that character.'))
      setBusy(false)
    }
  }

  async function discard() {
    if (!window.confirm('Discard this unfinished character?')) return

    setActionError(null)
    setBusy(true)

    try {
      await deleteEntity(entity.id)
      navigate(`/app/campaigns/${campaign.id}/entities`, { replace: true })
    } catch (caught) {
      setActionError(errorMessage(caught, 'Could not discard that draft.'))
      setBusy(false)
    }
  }

  const Step = STEP_COMPONENTS[allowed]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {WIZARD_STEP_LABELS[allowed]}
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {saveError ?? SAVE_STATUS_LABELS[saveStatus]}
        </p>
      </header>

      {actionError ? <Alert>{actionError}</Alert> : null}

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex flex-col gap-6">
          <CharacterCreationStepper
            currentStep={allowed}
            isStepEnabled={(entry) => resolveStep(entry, draft, context) === entry}
            onStepChange={goTo}
            previousDisabled={index === 0 || busy}
            nextDisabled={busy || problems.length > 0}
            onPrevious={() => goTo(WIZARD_STEPS[index - 1])}
            onNext={() => {
              if (allowed === 'review') void finish()
              else goTo(WIZARD_STEPS[index + 1])
            }}
            nextLabel={allowed === 'review' ? (busy ? 'Saving…' : 'Create character') : 'Next'}
          >
            <section className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
              <div>
                <p className="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {WIZARD_STEP_LABELS[allowed]}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {WIZARD_STEP_HINTS[allowed]}
                </p>
              </div>

              <Step
                draft={draft}
                context={context}
                onChange={update}
                onPatchData={patchData}
                members={members}
                canManage={role !== 'player'}
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
            </section>
          </CharacterCreationStepper>

          <div>
            <Button variant="secondary" disabled={busy} onClick={() => void discard()}>
              Discard
            </Button>
          </div>
        </div>

        <WizardSummary
          draft={draft}
          context={context}
          portrait={portrait}
          onPortraitChange={(value) => {
            setPortrait(value)
            writeDraftPortrait(entity.id, value)
          }}
        />
      </div>
    </div>
  )
}
