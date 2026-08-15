import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import './Field.css'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  /** A sentence under the control, tied to it by aria-describedby. */
  hint?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, id, className, ...rest },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={ref}
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
})
