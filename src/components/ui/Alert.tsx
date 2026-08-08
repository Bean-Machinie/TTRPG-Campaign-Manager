import type { ReactNode } from 'react'
import './Alert.css'

type AlertProps = {
  children: ReactNode
  variant?: 'error' | 'info'
}

/** Inline feedback block used for form errors and setup notices. */
export function Alert({ children, variant = 'error' }: AlertProps) {
  return (
    <p className={`alert alert--${variant}`} role={variant === 'error' ? 'alert' : undefined}>
      {children}
    </p>
  )
}
