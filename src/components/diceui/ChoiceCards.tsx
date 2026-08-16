import {
  ListboxItem,
  ListboxItemIndicator,
  ListboxRoot,
} from '@diceui/listbox'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

export type ChoiceCardOption = {
  value: string
  label: string
  description?: ReactNode
  icon?: ReactNode
  badge?: ReactNode
  disabled?: boolean
}

type Props = {
  label: string
  value: string
  options: ChoiceCardOption[]
  onValueChange: (value: string) => void
  description?: ReactNode
  compact?: boolean
}

/** A visual selection grid powered by Dice UI's keyboard-navigable Listbox. */
export function ChoiceCards({
  label,
  value,
  options,
  onValueChange,
  description,
  compact = false,
}: Props) {
  return (
    <div className="dice-choice-field">
      <div className="dice-choice-field__heading">
        <p className="field__label">{label}</p>
        {description ? <p className="field__hint">{description}</p> : null}
      </div>
      <ListboxRoot
        value={value}
        onValueChange={onValueChange}
        orientation="mixed"
        aria-label={label}
        className={compact ? 'dice-choice-grid dice-choice-grid--compact' : 'dice-choice-grid'}
      >
        {options.map((option) => (
          <ListboxItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="dice-choice-card"
          >
            {option.icon ? <span className="dice-choice-card__icon">{option.icon}</span> : null}
            <span className="dice-choice-card__copy">
              <span className="dice-choice-card__title">{option.label}</span>
              {option.description ? (
                <span className="dice-choice-card__description">{option.description}</span>
              ) : null}
            </span>
            {option.badge ? <span className="dice-choice-card__badge">{option.badge}</span> : null}
            <ListboxItemIndicator className="dice-choice-card__indicator">
              <Check aria-hidden="true" />
            </ListboxItemIndicator>
          </ListboxItem>
        ))}
      </ListboxRoot>
    </div>
  )
}
