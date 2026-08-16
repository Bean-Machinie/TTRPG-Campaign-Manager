import {
  CheckboxGroupDescription,
  CheckboxGroupIndicator,
  CheckboxGroupItem,
  CheckboxGroupLabel,
  CheckboxGroupList,
  CheckboxGroupRoot,
} from '@diceui/checkbox-group'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

export type CheckboxCardOption = {
  value: string
  label: string
  description?: ReactNode
  disabled?: boolean
}

type Props = {
  label: string
  value: string[]
  options: CheckboxCardOption[]
  onValueChange: (value: string[]) => void
  description?: ReactNode
  invalid?: boolean
}

/** Multi-selection cards composed from Dice UI's Checkbox Group primitives. */
export function CheckboxCards({
  label,
  value,
  options,
  onValueChange,
  description,
  invalid = false,
}: Props) {
  return (
    <CheckboxGroupRoot
      value={value}
      onValueChange={onValueChange}
      invalid={invalid}
      className="dice-checkbox-group"
    >
      <div className="dice-checkbox-group__heading">
        <CheckboxGroupLabel className="field__label">{label}</CheckboxGroupLabel>
        {description ? (
          <CheckboxGroupDescription className="field__hint">
            {description}
          </CheckboxGroupDescription>
        ) : null}
      </div>
      <CheckboxGroupList className="dice-checkbox-grid">
        {options.map((option) => (
          <CheckboxGroupItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="dice-checkbox-card"
          >
            <span className="dice-checkbox-card__control" aria-hidden="true">
              <CheckboxGroupIndicator className="dice-checkbox-card__indicator">
                <Check aria-hidden="true" />
              </CheckboxGroupIndicator>
            </span>
            <span className="dice-checkbox-card__copy">
              <span className="dice-checkbox-card__title">{option.label}</span>
              {option.description ? (
                <span className="dice-checkbox-card__description">{option.description}</span>
              ) : null}
            </span>
          </CheckboxGroupItem>
        ))}
      </CheckboxGroupList>
    </CheckboxGroupRoot>
  )
}
