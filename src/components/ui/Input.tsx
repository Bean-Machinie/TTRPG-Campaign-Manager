import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import './Field.css'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  /** A sentence under the control, tied to it by aria-describedby. */
  hint?: ReactNode
}

export function Input({ label, hint, id, className, ...rest }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        className={['field__input', className].filter(Boolean).join(' ')}
        id={inputId}
        aria-describedby={hint ? hintId : undefined}
        {...rest}
      />
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
