import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ApiFailure, isObject } from '../api/client'
import { authenticatedApi } from '../auth/session'
import { Alert, Button, Checkbox, TextField } from '../components/ui'
import { workspaceError } from './contracts'

interface Plan { path: string; method: 'POST' | 'PUT' | 'DELETE'; body?: unknown; expectedStatus: number | readonly number[]; key?: string }
export interface ActionFormProps {
  label: string; children?: ReactNode; reauthenticate?: boolean; idempotent?: boolean; danger?: boolean; confirmation?: string; disabled?: boolean;
  prepare: (data: FormData, verificationRef?: string) => Omit<Plan, 'key'>;
  onSuccess: (data: unknown) => void | Promise<void>;
  onRecover?: () => void | Promise<void>;
  onFailure?: (error: unknown) => void | Promise<void>;
  onLockChange?: (locked: boolean) => void;
  onCancel?: () => void;
}

export function ActionForm({ label, children, reauthenticate = false, idempotent = true, danger = false, confirmation, disabled = false, prepare, onSuccess, onRecover, onFailure, onLockChange, onCancel }: ActionFormProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(true)
  const plan = useRef<Plan | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { onLockChange?.(pending || uncertain) }, [pending, uncertain, onLockChange])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked.current || disabled) return
    const form = event.currentTarget
    const values = new FormData(form)
    locked.current = true; setPending(true); setError(null)
    let sent = false
    try {
      if (!uncertain || !plan.current) {
        let ref: string | undefined
        if (reauthenticate) {
          const result = await authenticatedApi('/auth/reauthenticate', { method: 'POST', body: { password: values.get('_password') }, credentialCheck: true })
          if (!mounted.current) return
          if (!isObject(result) || typeof result.verificationRef !== 'string') throw new ApiFailure('INVALID_RESPONSE')
          ref = result.verificationRef
        }
        plan.current = { ...prepare(values, ref), key: idempotent ? crypto.randomUUID() : undefined }
      }
      const current = plan.current
      sent = true
      const result = await authenticatedApi(current.path, { method: current.method, body: current.body, expectedStatus: current.expectedStatus, idempotencyKey: current.key })
      if (!mounted.current) return
      await onSuccess(result)
      plan.current = null; if (mounted.current) setUncertain(false)
      form.reset()
    } catch (failure) {
      const unknownOutcome = sent && idempotent && (uncertain || !(failure instanceof ApiFailure) || failure.status === 0 || failure.status >= 500)
      if (mounted.current) setUncertain(unknownOutcome)
      if (!unknownOutcome) plan.current = null
      if (mounted.current) setError(workspaceError(failure))
      await onFailure?.(failure)
    } finally {
      const password = form.elements.namedItem('_password') as HTMLInputElement | null
      if (password) password.value = ''
      locked.current = false; if (mounted.current) setPending(false)
    }
  }
  return <form className="action-form" onSubmit={submit}>
    <fieldset className="form-fieldset stack" disabled={pending || uncertain || disabled}>
      {children}
      {confirmation && <Checkbox name="_confirmed" required label={confirmation} />}
      {reauthenticate && <TextField label="본인 비밀번호" name="_password" type="password" autoComplete="current-password" required minLength={1} maxLength={128} placeholder="변경 전에 비밀번호를 확인해 주세요" />}
    </fieldset>
    {error && <Alert tone="error">{error}</Alert>}
    {uncertain && <Alert tone="warning">이전 요청의 완료 여부를 확인하지 못했습니다. 같은 요청으로 결과를 다시 확인하거나 최신 상태를 조회해 주세요. 새로고침 후에는 먼저 목록에서 결과를 확인해 주세요.</Alert>}
    <div className="row">{onCancel && <Button variant="secondary" disabled={pending || uncertain} onClick={onCancel}>취소</Button>}{uncertain && onRecover && <Button variant="secondary" disabled={pending || disabled} onClick={() => void onRecover()}>현재 상태 조회</Button>}<Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={disabled} loading={pending} loadingLabel="처리 중">{uncertain ? '같은 요청 결과 확인' : label}</Button></div>
  </form>
}
