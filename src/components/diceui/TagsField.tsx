import {
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText,
  TagsInputLabel,
  TagsInputRoot,
} from '@diceui/tags-input'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  label: string
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  hint?: ReactNode
}

/** Token entry composed from Dice UI's accessible Tags Input. */
export function TagsField({ label, value, onValueChange, placeholder, hint }: Props) {
  return (
    <TagsInputRoot
      value={value}
      onValueChange={onValueChange}
      addOnPaste
      addOnTab
      blurBehavior="add"
      className="dice-tags field"
    >
      <TagsInputLabel className="field__label">{label}</TagsInputLabel>
      <div className="dice-tags__surface">
        {value.map((item) => (
          <TagsInputItem key={item} value={item} className="dice-tags__item">
            <TagsInputItemText />
            <TagsInputItemDelete className="dice-tags__delete" aria-label={`Remove ${item}`}>
              <X aria-hidden="true" />
            </TagsInputItemDelete>
          </TagsInputItem>
        ))}
        <TagsInputInput className="dice-tags__input" placeholder={placeholder} />
      </div>
      {hint ? <p className="field__hint">{hint}</p> : null}
    </TagsInputRoot>
  )
}
