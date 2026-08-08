import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import './Field.css'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
}

export function Input({ label, id, className, ...rest }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        className={['field__input', className].filter(Boolean).join(' ')}
        id={inputId}
        {...rest}
      />
    </div>
  )
}
