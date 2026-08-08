import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import './Field.css'

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
}

export function Checkbox({ label, id, className, ...rest }: CheckboxProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="field field--inline">
      <input
        className={['field__checkbox', className].filter(Boolean).join(' ')}
        id={inputId}
        type="checkbox"
        {...rest}
      />
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
    </div>
  )
}
