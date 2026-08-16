import { ListboxItem, ListboxRoot } from '@diceui/listbox'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../../../../components/ui/Button'
import {
  WIZARD_STEPS,
  WIZARD_STEP_HINTS,
  WIZARD_STEP_LABELS,
} from '../../../../entities/wizard/steps'
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

/**
 * Dice UI's Listbox becomes a route-aware chapter navigator here. The current
 * draft still owns the guard; the primitive contributes roving focus, arrow
 * navigation, selection semantics, and disabled-item handling.
 */
export function CharacterCreationStepper({
  currentStep,
  isStepEnabled,
  onStepChange,
  previousDisabled = false,
  nextDisabled = false,
  onPrevious,
  onNext,
  nextLabel = 'Continue',
  children,
}: Props) {
  const current = WIZARD_STEPS.indexOf(currentStep)

  return (
    <div className="character-flow">
      <aside className="character-flow__rail" aria-label="Character creation progress">
        <div className="character-flow__rail-heading">
          <strong>Your journey</strong>
          <span>Chapter {current + 1} of {WIZARD_STEPS.length}</span>
        </div>

        <ListboxRoot
          value={currentStep}
          onValueChange={(value) => {
            const step = WIZARD_STEPS.find((entry) => entry === value)
            if (step && isStepEnabled(step)) onStepChange(step)
          }}
          orientation="vertical"
          className="character-flow__step-list"
          aria-label="Creation chapters"
        >
          {WIZARD_STEPS.map((step, index) => {
            const complete = index < current
            return (
              <ListboxItem
                key={step}
                value={step}
                disabled={!isStepEnabled(step)}
                className={complete ? 'character-flow__step character-flow__step--complete' : 'character-flow__step'}
                aria-label={`Chapter ${index + 1}: ${WIZARD_STEP_LABELS[step]}`}
              >
                <span className="character-flow__step-indicator" aria-hidden="true">
                  {complete ? <Check /> : index + 1}
                </span>
                <span className="character-flow__step-copy">
                  <span className="character-flow__step-title">{WIZARD_STEP_LABELS[step]}</span>
                  <span className="character-flow__step-description">{WIZARD_STEP_HINTS[step]}</span>
                </span>
              </ListboxItem>
            )
          })}
        </ListboxRoot>
      </aside>

      <section className="character-flow__stage">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep}
            className="character-flow__content"
            initial={{ opacity: 0, y: 12, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>

        <footer className="character-flow__actions">
          <Button variant="secondary" disabled={previousDisabled} onClick={onPrevious}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
          <p className="character-flow__actions-copy">
            Chapter {current + 1} of {WIZARD_STEPS.length}
          </p>
          <Button className="character-flow__next" disabled={nextDisabled} onClick={onNext}>
            {nextLabel}
            <ArrowRight aria-hidden="true" />
          </Button>
        </footer>
      </section>
    </div>
  )
}
