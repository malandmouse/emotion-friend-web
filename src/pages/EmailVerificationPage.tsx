import { useRef, useState } from 'react'
import { AuthLayout } from '../components/layout/AuthLayout'
import { Alert, Button, LoadingState } from '../components/ui'
import { ApiFailure, authErrorMessage } from '../api/client'
import { authenticatedApi, logout, reloadMember } from '../auth/session'
import { clearEmailVerification, pendingEmailVerification } from '../auth/emailVerification'
import { useAuth } from '../auth/useAuth'

export function EmailVerificationPage() {
  const auth = useAuth()
  const [pending, setPending] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const verification = pendingEmailVerification()

  async function confirm() {
    if (busy.current || !verification) return
    busy.current = true; setPending(true); setError(null)
    try {
      await authenticatedApi('/auth/email-verifications/confirm', { method: 'POST', body: { verificationId: verification.verificationId, token: verification.token }, expectedStatus: 204 })
      clearEmailVerification(); setComplete(true)
      try { await reloadMember() } catch { /* The confirmation succeeded; account reload can be retried separately. */ }
    } catch (failure) {
      setError(failure instanceof ApiFailure && failure.code === 'VERIFICATION_INVALID'
        ? '확인 정보가 만료되었거나 이미 사용되었어요. 메일을 받은 계정으로 로그인했는지 확인하고, 필요한 경우 내 계정에서 새 메일을 요청해 주세요.'
        : failure instanceof ApiFailure && (failure.status === 0 || failure.status >= 500)
          ? '응답을 확인하지 못했어요. 내 계정에서 이메일 확인 상태를 새로고침해 주세요. 확인이 끝나지 않았다면 다시 제출할 수 있어요.'
          : authErrorMessage(failure))
    } finally { busy.current = false; setPending(false) }
  }

  async function switchAccount() {
    if (busy.current) return
    busy.current = true; setPending(true); setError(null)
    try { await logout(); window.location.hash = '/login' }
    catch (failure) { setError(authErrorMessage(failure, 'logout')) }
    finally { busy.current = false; setPending(false) }
  }

  return <AuthLayout><div className="auth-form account-page stack">
    <h1>이메일 확인</h1>
    {complete ? <>
      <Alert tone="success" title="이메일 확인을 완료했어요">내 계정에서 현재 승인 상태를 확인할 수 있어요. 이메일 확인과 운영자의 역할 승인은 별도로 진행됩니다.</Alert>
      <a className="button button--primary" href="#/account">내 계정으로 이동</a>
    </> : auth.status === 'loading' ? <LoadingState label="로그인 상태를 확인하고 있어요" /> : !verification ? <>
      <Alert tone="warning" title="사용할 확인 링크가 없어요">메일의 링크를 다시 열어 주세요. 요청 후 15분이 지났다면 내 계정에서 새 확인 메일을 요청해 주세요.</Alert>
      <a className="button button--primary" href={auth.status === 'authenticated' ? '#/account' : '#/login'}>{auth.status === 'authenticated' ? '내 계정으로 이동' : '로그인하기'}</a>
    </> : auth.status === 'anonymous' || auth.status === 'error' ? <>
      <Alert title="메일을 받은 계정으로 로그인해 주세요">로그인 후 이 확인 화면으로 돌아옵니다. 확인 정보는 이 탭에서만 잠시 보관됩니다.</Alert>
      <a className="button button--primary" href="#/login">로그인하고 계속하기</a>
    </> : <>
      <p>현재 로그인한 이메일: <strong style={{ overflowWrap: 'anywhere' }}>{auth.member?.email}</strong></p>
      <Alert title="가입 이메일을 확인해 주세요">메일을 받은 계정이 맞다면 아래 버튼을 눌러 이메일 소유 확인을 완료해 주세요.</Alert>
      {auth.member?.emailVerified && <Alert tone="success">현재 로그인한 계정의 이메일은 이미 확인된 상태입니다. 다른 계정의 메일을 열었다면 계정을 변경해 주세요.</Alert>}
      <div className="row"><Button loading={pending} loadingLabel="확인 중" onClick={() => void confirm()}>이메일 확인 완료</Button><Button variant="secondary" disabled={pending} onClick={() => void switchAccount()}>다른 계정으로 로그인</Button></div>
      <a href="#/account">내 계정에서 상태 확인·새 메일 요청</a>
    </>}
    {error && <Alert tone="error">{error}</Alert>}
  </div></AuthLayout>
}
