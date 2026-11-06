import { useId } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
export function Card({ title, description, action, children, className = '', ...props }: Omit<HTMLAttributes<HTMLElement>, 'title'> & { title?: string; description?: string; action?: ReactNode }) {
  const headingId = useId()
  return <section {...props} className={`card ${className}`} aria-labelledby={title ? headingId : props['aria-labelledby']}>
    {(title || action) && <div className="card__header"><div>{title && <h2 id={headingId}>{title}</h2>}{description && <p className="muted card__description">{description}</p>}</div>{action}</div>}{children}
  </section>
}
export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>
}
