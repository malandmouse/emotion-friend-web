import { useState } from 'react'
import { AuthLayout } from '../components/layout/AuthLayout'
import { Alert, Badge, Button, ErrorState, LoadingState } from '../components/ui'
import { authErrorMessage } from '../api/client'
import { logout, reloadMember } from '../auth/session'
import { useAuth } from '../auth/useAuth'
import { EmailVerificationPanel } from '../workspace/EmailVerificationPanel'
import { isActive } from '../workspace/contracts'

const roles = { GUARDIAN: '보호자', THERAPIST: '치료사', ADMIN: '운영자' }
const statuses = { PENDING: '승인 대기', ACTIVE: '활성', REJECTED: '승인 반려', SUSPENDED: '이용 정지' }

export function AccountPage() {
  const auth = useAuth()
  const [pending, setPending] = useState<'reload' | 'logout' | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function perform(action: 'reload' | 'logout') {
    if (pending) return
    setPending(action); setError(null)
    try {
      if (action === 'logout') { await logout(); window.location.hash = '/login' }
      else { await reloadMember() }
    } catch (failure) { setError(authErrorMessage(failure, action === 'logout' ? 'logout' : 'session')) }
    finally { setPending(null) }
  }

  const member = auth.member
  return <AuthLayout><div className="auth-form account-page">
    <h1>내 계정</h1>
    {auth.status === 'loading' || auth.status === 'anonymous' ? <LoadingState label="로그인 상태를 확인하고 있어요" /> : auth.status === 'error' ? <ErrorState title="계정 정보를 불러오지 못했어요" description={authErrorMessage(auth.error)} action={<Button loading={pending === 'reload'} disabled={!!pending} onClick={() => void perform('reload')}>다시 확인</Button>} /> : member && <div className="stack">
      <div className="account-heading"><h2>{member.displayName}님</h2><Badge tone={member.status === 'ACTIVE' ? 'success' : member.status === 'PENDING' ? 'warning' : 'error'}>{statuses[member.status]}</Badge></div>
      <dl className="account-details"><div><dt>이메일</dt><dd>{member.email}</dd></div><div><dt>신청 역할</dt><dd>{member.requestedRole ? roles[member.requestedRole] : '해당 없음'}</dd></div><div><dt>승인된 역할</dt><dd>{member.role ? roles[member.role] : '아직 승인되지 않았어요'}</dd></div><div><dt>이메일 확인</dt><dd>{member.emailVerified ? '확인 완료' : '미확인'}</dd></div></dl>
      {member.status === 'PENDING' ? <Alert title="계정 승인을 기다리고 있어요">이메일 소유 확인 후 운영자가 신청 역할을 검토합니다. 승인 전에는 아동 정보를 등록하거나 조회할 수 없습니다.</Alert> : member.status === 'REJECTED' ? <Alert tone="warning" title="가입 신청이 반려된 상태입니다">계정 상태를 확인하고 필요한 경우 운영자에게 문의해 주세요.</Alert> : member.status === 'SUSPENDED' ? <Alert tone="error">이용이 정지된 계정입니다. 학습 관리 기능을 사용할 수 없습니다.</Alert> : <Alert title="승인된 계정입니다">아동별 권한은 계정 역할과 별도로 서버에서 확인합니다.</Alert>}
      {!member.emailVerified && member.status !== 'SUSPENDED' && <EmailVerificationPanel />}
      {isActive(member) && <a className="button button--primary" href={member.role === 'ADMIN' ? '#/workspace/members' : '#/workspace/children'}>{member.role === 'ADMIN' ? '회원·역할 관리' : member.role === 'THERAPIST' ? '담당 아동·초대 확인' : '아동 등록·관리'}</a>}
    </div>}
    {error && <div className="form-feedback"><Alert tone="error">{error}</Alert></div>}
    {auth.status !== 'loading' && auth.status !== 'anonymous' && <div className="row account-actions">{member && <Button variant="secondary" loading={pending === 'reload'} disabled={!!pending} onClick={() => void perform('reload')}>상태 새로고침</Button>}<Button loading={pending === 'logout'} loadingLabel="로그아웃 중" disabled={!!pending} onClick={() => void perform('logout')}>로그아웃</Button></div>}
  </div></AuthLayout>
}
