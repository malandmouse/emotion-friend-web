import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Icon } from './Icon'
interface FieldProps { label: string; hint?: string; error?: string; className?: string }
function FieldFrame({ id, label, required, hint, error, children, className = '' }: FieldProps & { id: string; required?: boolean; children: ReactNode }) {
  return <div className={`field ${error ? 'field--error' : ''} ${className}`}>
    <label className="field__label" htmlFor={id}>{label}{required && <span className="field__required"> * <span className="sr-only">필수</span></span>}</label>
    {children}
    {hint && <p className="field__hint" id={`${id}-hint`}>{hint}</p>}
    {error && <p className="field__error" id={`${id}-error`}><Icon name="alert" size={15} />{error}</p>}
  </div>
}
function describedBy(id: string, hint?: string, error?: string, external?: string) {
  return [hint && `${id}-hint`, error && `${id}-error`, external].filter(Boolean).join(' ') || undefined
}
export function TextField({ label, hint, error, id, className, required, 'aria-describedby': external, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId(); const fieldId = id ?? generatedId
  return <FieldFrame id={fieldId} label={label} hint={hint} error={error} required={required} className={className}>
    <input {...props} id={fieldId} className="field__control" required={required} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy(fieldId, hint, error, external)} />
  </FieldFrame>
}
export function SelectField({ label, hint, error, id, className, required, children, 'aria-describedby': external, ...props }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId(); const fieldId = id ?? generatedId
  return <FieldFrame id={fieldId} label={label} hint={hint} error={error} required={required} className={className}>
    <div className="field__select"><select {...props} id={fieldId} className="field__control" required={required} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy(fieldId, hint, error, external)}>{children}</select><Icon name="chevron" size={16} /></div>
  </FieldFrame>
}
export function TextArea({ label, hint, error, id, className, required, 'aria-describedby': external, ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId(); const fieldId = id ?? generatedId
  return <FieldFrame id={fieldId} label={label} hint={hint} error={error} required={required} className={className}>
    <textarea {...props} id={fieldId} className="field__control field__textarea" required={required} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={describedBy(fieldId, hint, error, external)} />
  </FieldFrame>
}
export function Checkbox({ label, className = '', id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  const generatedId = useId()
  return <label className={`checkbox ${className}`} htmlFor={id ?? generatedId}><input {...props} id={id ?? generatedId} type="checkbox" /><span>{label}</span></label>
}
