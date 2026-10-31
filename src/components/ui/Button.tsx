import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Feedback'
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
  loadingLabel?: string
  fullWidth?: boolean
  icon?: ReactNode
}
export function Button({ children, variant = 'primary', size = 'md', loading = false, loadingLabel = '처리 중', fullWidth = false, icon, disabled, className = '', type = 'button', ...props }: ButtonProps) {
  return <button {...props} type={type} className={`button button--${variant} button--${size} ${fullWidth ? 'button--full' : ''} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined}>
    {loading ? <Spinner /> : icon}<span>{loading ? loadingLabel : children}</span>
  </button>
}
