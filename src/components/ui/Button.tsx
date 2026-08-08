import type { ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router'
import type { LinkProps } from 'react-router'
import './Button.css'

type Variant = 'primary' | 'secondary'

function buttonClass(variant: Variant, className?: string) {
  return ['button', `button--${variant}`, className].filter(Boolean).join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
  return <button className={buttonClass(variant, className)} type={type} {...rest} />
}

type ButtonLinkProps = LinkProps & { variant?: Variant }

/** A router link that looks like a button. Used for navigation actions. */
export function ButtonLink({ variant = 'primary', className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, className)} {...rest} />
}
