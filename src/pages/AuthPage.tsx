import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AuthLayout } from '../components/layout/AuthLayout'
import { Alert, Button, Checkbox, SelectField, TextField } from '../components/ui'
import { ApiFailure, authErrorMessage } from '../api/client'
import { login, signup as createAccount } from '../auth/session'
import type { Member, RequestedRole } from '../auth/contracts'
import { useAuth } from '../auth/useAuth'
import { postLoginHash } from '../auth/emailVerification'

export function AuthPage({ signup = false }: { signup?: boolean }) {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [requestedRole, setRequestedRole] = useState<RequestedRole>('GUARDIAN')
  const [remember, setRemember] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState(false)
  const [created, setCreated] = useState<Member | null>(null)
  const busy = useRef(false)

  const emailIssue = !email.trim() ? '이메일 주소를 입력해 주세요.' : email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? '올바른 이메일 주소를 입력해 주세요.' : undefined
  const passwordIssue = !password ? '비밀번호를 입력해 주세요.' : password.length > 128 || (signup && password.length < 15) ? (signup ? '비밀번호는 15~128자로 입력해 주세요.' : '비밀번호는 128자 이내로 입력해 주세요.') : password.includes('\0') ? '비밀번호에 사용할 수 없는 문자가 있습니다.' : undefined
  const nameIssue = signup && !name.trim() ? '이름을 입력해 주세요.' : signup && (name.trim().length > 80 || /\p{Cc}/u.test(name)) ? '이름은 제어 문자 없이 80자 이내로 입력해 주세요.' : undefined

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    setSubmitted(true); setError(null); setDuplicate(false)
    const form = event.currentTarget
    const invalid = emailIssue ? 'email' : nameIssue ? 'name' : passwordIssue ? 'password' : undefined
    if (invalid) { (form.elements.namedItem(invalid) as HTMLInputElement)?.focus(); return }
    busy.current = true; setPending(true)
    try {
      if (signup) {
        const member = await createAccount({ email: email.trim(), displayName: name.trim(), password, requestedRole })
        setPassword('')
        setCreated(member)
      } else {
        await login(email.trim(), password, remember)
        setPassword('')
        window.location.hash = postLoginHash()
      }
    } catch (failure) {
      setError(authErrorMessage(failure, signup ? 'signup' : 'login'))
      if (failure instanceof ApiFailure && failure.code === 'ACCOUNT_ALREADY_EXISTS') {
        setDuplicate(true)
        ;(form.elements.namedItem('email') as HTMLInputElement)?.focus()
      }
    } finally { busy.current = false; setPending(false) }
  }

  return <AuthLayout variant={signup ? 'signup' : 'login'}><div className="auth-form">
    <h1>{signup ? '보호자·치료사 회원가입' : '보호자·치료사 로그인'}</h1>
    <nav className="auth-switch" aria-label="계정 메뉴"><a href="#/login" aria-current={!signup ? 'page' : undefined} aria-disabled={pending || undefined} onClick={(event) => { if (pending) event.preventDefault() }}>로그인</a><a href="#/signup" aria-current={signup ? 'page' : undefined} aria-disabled={pending || undefined} onClick={(event) => { if (pending) event.preventDefault() }}>회원가입</a></nav>
    {created ? <div className="auth-created">
      <Alert tone="success" title="가입 신청을 완료했어요">{created.displayName}님의 계정은 승인 대기 상태입니다. 가입 완료는 이메일 확인이나 역할 승인을 의미하지 않습니다.</Alert>
      <p className="muted">로그인하여 현재 계정 상태를 확인해 주세요.</p>
      <a className="button button--primary" href="#/login">로그인하기</a>
    </div> : <>
      <p className="auth-description">{signup ? '성인 계정으로 가입을 신청한 뒤 계정 승인 상태를 확인해요.' : '로그인 후 계정 정보와 현재 승인 상태를 확인할 수 있어요.'}</p>
      <form noValidate onSubmit={submit} onChange={() => setError(null)}>
        <fieldset className="form-fieldset" disabled={pending}>
          <TextField label="이메일 주소" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="이메일 주소를 입력해 주세요" value={email} onChange={(event) => { setEmail(event.target.value); setDuplicate(false) }} error={duplicate ? '이미 가입된 이메일 주소입니다.' : submitted ? emailIssue : undefined} maxLength={254} required />
          {signup && <div className="auth-signup-details">
            <TextField label="이름" name="name" autoComplete="name" placeholder="이름을 입력해 주세요" value={name} onChange={(event) => setName(event.target.value)} error={submitted ? nameIssue : undefined} maxLength={80} required />
            <SelectField label="신청 역할" name="requestedRole" value={requestedRole} onChange={(event) => setRequestedRole(event.target.value as RequestedRole)} required><option value="GUARDIAN">보호자</option><option value="THERAPIST">치료사</option></SelectField>
          </div>}
          <TextField label="비밀번호" name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} placeholder={signup ? '15~128자 비밀번호를 입력해 주세요' : '비밀번호를 입력해 주세요'} value={password} onChange={(event) => setPassword(event.target.value)} error={submitted ? passwordIssue : undefined} maxLength={128} minLength={signup ? 15 : 1} required />
          {!signup && <Checkbox name="remember" checked={remember} onChange={(event) => setRemember(event.target.checked)} label="로그인 상태 유지" />}
        </fieldset>
        {signup && <Alert>이메일 중복 여부는 가입 시 확인합니다.</Alert>}
        {(error || (!submitted && auth.error)) && <div className="form-feedback"><Alert tone="error">{error || authErrorMessage(auth.error)}</Alert></div>}
        <div className="auth-actions"><div className="auth-submit"><Button type="submit" loading={pending} loadingLabel={signup ? '가입 신청 중' : '로그인 중'}>{signup ? '계정 만들기' : '로그인'}</Button></div></div>
        <p className="auth-preview-note">{signup ? '가입 신청 후 로그인하여 계정 상태를 확인해 주세요.' : '로그인 상태 유지를 선택하면 이 브라우저에 로그인 정보가 남습니다.'}</p>
      </form>
    </>}
  </div></AuthLayout>
}
