import { useId } from 'react'
import type { SelectHTMLAttributes } from 'react'
import './Field.css'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
}

export function Select({ label, id, className, children, ...rest }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className="field">
      <label className="field__label" htmlFor={selectId}>
        {label}
      </label>
      <select
        className={['field__input', 'field__select', className].filter(Boolean).join(' ')}
        id={selectId}
        {...rest}
      >
        {children}
      </select>
    </div>
  )
}
