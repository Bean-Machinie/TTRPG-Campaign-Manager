import type { ReactNode } from 'react'
import './Page.css'

type PageProps = {
  children: ReactNode
  /** `narrow` is for focused single-column pages such as the auth forms. */
  width?: 'default' | 'narrow'
}

/** Centred content container with a sensible maximum width. */
export function Page({ children, width = 'default' }: PageProps) {
  return <div className={`page page--${width}`}>{children}</div>
}

type PageHeaderProps = {
  title: string
  description?: ReactNode
  /** Optional action rendered on the right, e.g. a button. */
  action?: ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {description ? <p className="page-header__description">{description}</p> : null}
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </header>
  )
}
