import { useId } from 'react'
import type { ReactNode, TextareaHTMLAttributes } from 'react'
import './Field.css'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  /** A sentence under the control, tied to it by aria-describedby. */
  hint?: ReactNode
}

export function Textarea({ label, hint, id, className, ...rest }: TextareaProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const hintId = `${textareaId}-hint`

  return (
    <div className="field">
      <label className="field__label" htmlFor={textareaId}>
        {label}
      </label>
      <textarea
        className={['field__input', 'field__textarea', className].filter(Boolean).join(' ')}
        id={textareaId}
        rows={3}
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
