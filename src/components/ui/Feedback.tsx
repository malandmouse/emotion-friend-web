import type { ReactNode } from 'react'
import { Icon } from './Icon'
export function Spinner({ label }: { label?: string }) {
  return <span className="spinner" role={label ? 'status' : undefined} aria-hidden={label ? undefined : true}>{label && <span className="sr-only">{label}</span>}</span>
}
export function Alert({ tone = 'info', title, children, action }: { tone?: 'info' | 'success' | 'warning' | 'error'; title?: string; children: ReactNode; action?: ReactNode }) {
  return <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <Icon name={tone === 'error' || tone === 'warning' ? 'alert' : tone === 'success' ? 'check' : 'info'} size={19} />
    <div className="alert__body">{title && <p className="alert__title">{title}</p>}<div>{children}</div></div>{action && <div className="alert__action">{action}</div>}
  </div>
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'info' | 'success' | 'warning' | 'error' }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}
export function LoadingState({ label = '불러오는 중이에요', description = '잠시만 기다려 주세요.' }: { label?: string; description?: string }) {
  return <div className="state" role="status" aria-live="polite"><Spinner /><p className="state__title">{label}</p><p className="state__description">{description}</p></div>
}
export function Skeleton({ lines = 3, label = '내용을 불러오는 중' }: { lines?: number; label?: string }) {
  return <div className="skeleton" role="status"><span className="sr-only">{label}</span><div aria-hidden="true">{Array.from({ length: lines }, (_, i) => <div className="skeleton__line" key={i} />)}</div></div>
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="state"><span className="state__icon"><Icon name="empty" size={26} /></span><h3 className="state__title">{title}</h3><p className="state__description">{description}</p>{action && <div className="state__action">{action}</div>}</div>
}
export function ErrorState({ title = '화면을 불러오지 못했어요', description = '잠시 후 다시 시도해 주세요.', action }: { title?: string; description?: string; action?: ReactNode }) {
  return <div className="state state--error" role="alert"><span className="state__icon"><Icon name="alert" size={26} /></span><h3 className="state__title">{title}</h3><p className="state__description">{description}</p>{action && <div className="state__action">{action}</div>}</div>
}
