import type { ReactNode } from 'react'
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTrigger,
} from '../../../../components/reui/stepper'
import { Button } from '../../../../components/ui/Button'
import { WIZARD_STEPS, WIZARD_STEP_LABELS } from '../../../../entities/wizard/steps'
import type { WizardStep } from '../../../../entities/wizard/steps'

type Props = {
  currentStep: WizardStep
  isStepEnabled: (step: WizardStep) => boolean
  onStepChange: (step: WizardStep) => void
  previousDisabled?: boolean
  nextDisabled?: boolean
  onPrevious: () => void
  onNext: () => void
  nextLabel?: string
  children?: ReactNode
}

export function CharacterCreationStepper({
  currentStep,
  isStepEnabled,
  onStepChange,
  previousDisabled = false,
  nextDisabled = false,
  onPrevious,
  onNext,
  nextLabel = 'Next',
  children,
}: Props) {
  const current = WIZARD_STEPS.indexOf(currentStep) + 1

  return (
    <Stepper
      value={current}
      onValueChange={(value) => {
        const step = WIZARD_STEPS[value - 1]
        if (step && isStepEnabled(step)) onStepChange(step)
      }}
      className="space-y-6"
    >
      <StepperNav>
        {WIZARD_STEPS.map((step, index) => {
          const number = index + 1
          return (
            <StepperItem
              key={step}
              step={number}
              disabled={!isStepEnabled(step)}
            >
              <StepperTrigger
                aria-label={`Step ${number}: ${WIZARD_STEP_LABELS[step]}`}
                title={WIZARD_STEP_LABELS[step]}
              >
                <StepperIndicator>{number}</StepperIndicator>
              </StepperTrigger>
              {number < WIZARD_STEPS.length ? <StepperSeparator /> : null}
            </StepperItem>
          )
        })}
      </StepperNav>

      {children ? (
        <StepperPanel>
          <StepperContent value={current}>{children}</StepperContent>
        </StepperPanel>
      ) : null}

      <div className="flex items-center justify-between gap-2.5">
        <Button variant="secondary" disabled={previousDisabled} onClick={onPrevious}>
          Previous
        </Button>
        <Button disabled={nextDisabled} onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    </Stepper>
  )
}
