import { useId } from 'react'
import type { ReactNode, SelectHTMLAttributes } from 'react'
import './Field.css'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  /**
   * A sentence under the control, tied to it by aria-describedby.
   *
   * For the thing a label cannot say in two words: which other field this one
   * depends on, or why an option is missing. Screen readers read it with the
   * control rather than after it, which is the whole reason it is here rather
   * than in a paragraph the caller writes.
   */
  hint?: ReactNode
}

export function Select({ label, hint, id, className, children, ...rest }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const hintId = `${selectId}-hint`

  return (
    <div className="field">
      <label className="field__label" htmlFor={selectId}>
        {label}
      </label>
      <select
        className={['field__input', 'field__select', className].filter(Boolean).join(' ')}
        id={selectId}
        aria-describedby={hint ? hintId : undefined}
        {...rest}
      >
        {children}
      </select>
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
