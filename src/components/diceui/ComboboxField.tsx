import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxItemText,
  ComboboxLabel,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
} from '@diceui/combobox'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type ComboboxOption = {
  value: string
  label: string
  description?: ReactNode
  meta?: ReactNode
}

type Props = {
  label: string
  value: string
  options: ComboboxOption[]
  onValueChange: (value: string) => void
  placeholder?: string
  hint?: ReactNode
  disabled?: boolean
}

/** A styled composition of Dice UI's searchable Combobox primitives. */
export function ComboboxField({
  label,
  value,
  options,
  onValueChange,
  placeholder = 'Search or choose…',
  hint,
  disabled = false,
}: Props) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? ''
  const [inputValue, setInputValue] = useState(selectedLabel)

  useEffect(() => {
    setInputValue(selectedLabel)
  }, [selectedLabel])

  return (
    <ComboboxRoot
      value={value}
      onValueChange={(next) => {
        onValueChange(next)
        setInputValue(options.find((option) => option.value === next)?.label ?? '')
      }}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      onOpenChange={(open) => {
        if (!open) setInputValue(selectedLabel)
      }}
      autoHighlight
      openOnFocus
      disabled={disabled}
      className="dice-combobox field"
    >
      <ComboboxLabel className="field__label">{label}</ComboboxLabel>
      <ComboboxAnchor className="dice-combobox__anchor">
        <Search className="dice-combobox__search" aria-hidden="true" />
        <ComboboxInput className="dice-combobox__input" placeholder={placeholder} />
        <ComboboxTrigger className="dice-combobox__trigger" aria-label={`Open ${label} options`}>
          <ChevronDown aria-hidden="true" />
        </ComboboxTrigger>
      </ComboboxAnchor>

      {hint ? <p className="field__hint">{hint}</p> : null}

      <ComboboxPortal>
        <ComboboxContent className="dice-combobox__content" sideOffset={8} align="start">
          <ComboboxEmpty className="dice-combobox__empty">No matching option.</ComboboxEmpty>
          {options.map((option) => (
            <ComboboxItem
              key={option.value}
              value={option.value}
              label={option.label}
              className="dice-combobox__item"
            >
              <span className="dice-combobox__item-copy">
                <ComboboxItemText className="dice-combobox__item-label">
                  {option.label}
                </ComboboxItemText>
                {option.description ? (
                  <span className="dice-combobox__item-description">{option.description}</span>
                ) : null}
              </span>
              {option.meta ? <span className="dice-combobox__item-meta">{option.meta}</span> : null}
              <ComboboxItemIndicator className="dice-combobox__indicator">
                <Check aria-hidden="true" />
              </ComboboxItemIndicator>
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
  )
}
