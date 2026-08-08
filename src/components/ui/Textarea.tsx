import { useId } from 'react'
import type { TextareaHTMLAttributes } from 'react'
import './Field.css'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
}

export function Textarea({ label, id, className, ...rest }: TextareaProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId

  return (
    <div className="field">
      <label className="field__label" htmlFor={textareaId}>
        {label}
      </label>
      <textarea
        className={['field__input', 'field__textarea', className].filter(Boolean).join(' ')}
        id={textareaId}
        rows={3}
        {...rest}
      />
    </div>
  )
}
