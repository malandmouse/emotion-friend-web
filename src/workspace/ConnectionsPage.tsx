import { useCallback, useState } from 'react'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, TextField } from '../components/ui'
import { childPath, loadConnections } from './api'
import { ActionDialog } from './ActionDialog'
import { formatTime } from './contracts'
import { Capabilities, ResourceState } from './shared'
import { useResource } from './useResource'

const invitationStates: Record<string, string> = { PENDING: '응답 대기', ACCEPTED: '수락됨', DECLINED: '거절됨', CANCELLED: '취소됨', EXPIRED: '만료됨' }
export function ConnectionsPage({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => loadConnections(id, signal), [id])
  const resource = useResource(load)
  const [message, setMessage] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [action, setAction] = useState<{ kind: 'cancel' | 'disconnect' | 'deactivate'; id: string; label: string } | null>(null)
  async function complete(text: string) { setMessage(text); setAction(null); setInviteOpen(false); await resource.reload() }
  return <>
    <PageHeader title={!resource.loading && resource.data ? `${resource.data.child.pseudonym}의 연결 관리` : '아동 연결 관리'} description="치료사 초대와 연결 상태를 각각 확인합니다. 기기 연결은 후속 기능입니다." action={<Button variant="secondary" loading={resource.loading} onClick={() => { setAction(null); void resource.reload() }}>상태 새로고침</Button>} />
    {message && <div className="section-notice"><Alert tone="success">{message}</Alert></div>}
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload}>
      {resource.data && <div className="stack">
        <Card title="치료사 초대">{resource.data.coreGranted ? <><p className="muted">승인된 치료사 본인이 초대를 수락해야 연결됩니다.</p><div className="form-actions"><Button onClick={() => setInviteOpen(true)}>치료사 초대하기</Button></div></> : <Alert tone="warning">초대 전에 기본 프로필·학습 동의가 필요합니다. <a href={`#/workspace/children/${id}/consents`}>동의 관리로 이동</a></Alert>}</Card>
        {inviteOpen && resource.data.coreGranted && <ActionDialog title="치료사 초대" onClose={() => setInviteOpen(false)} intro={<p className="muted">{resource.data.child.pseudonym}의 학습을 함께할 치료사를 초대합니다. 치료사가 수락해야 연결되며, 회원 가입 여부는 표시하지 않습니다.</p>} label="초대 요청" reauthenticate prepare={(data) => ({ path: `${childPath(id)}/therapist-invitations`, method: 'POST', expectedStatus: 202, body: { therapistEmail: String(data.get('therapistEmail')).trim() } })} onSuccess={() => complete('초대 요청을 접수했습니다. 접수는 계정 존재 여부나 연결 완료를 의미하지 않습니다.')} onRecover={async () => { setInviteOpen(false); await resource.reload() }}>
          <TextField label="치료사 이메일" name="therapistEmail" type="email" autoComplete="off" required maxLength={254} placeholder="초대할 치료사의 가입 이메일" />
        </ActionDialog>}
        <Card title="보낸 초대">{resource.data.invitations.length === 0 ? <EmptyState title="보낸 초대가 없어요" description="치료사에게 초대를 요청하면 이곳에서 처리 상태를 확인할 수 있어요." /> : <div className="stack">{resource.data.invitations.map((invitation) => <div className="management-row" key={invitation.invitationId}><div><strong>{invitation.therapistEmail}</strong><p className="muted">유효기간 {formatTime(invitation.expiresAt)}</p></div><Badge>{invitationStates[invitation.state] ?? invitation.state}</Badge>{invitation.state === 'PENDING' && <Button variant="secondary" size="sm" onClick={() => setAction({ kind: 'cancel', id: invitation.invitationId, label: invitation.therapistEmail })}>초대 취소</Button>}</div>)}</div>}</Card>
        <Card title="연결된 치료사">{resource.data.therapists.length === 0 ? <EmptyState title="연결된 치료사가 없어요" description="초대 수락 후 연결된 치료사를 확인할 수 있어요." /> : <div className="stack">{resource.data.therapists.map((therapist) => <div className="management-row" key={therapist.therapistId}><div><strong>{therapist.displayName}</strong><Capabilities values={therapist.capabilities} /></div><Button variant="secondary" size="sm" onClick={() => setAction({ kind: 'disconnect', id: therapist.therapistId, label: therapist.displayName })}>연결 해제</Button></div>)}</div>}</Card>
        <Card title="아동 비활성화"><p>학습 접근을 차단하고 치료사 연결·미완료 초대를 철회합니다. 물리적인 정보 삭제를 뜻하지 않습니다.</p><div className="form-actions"><Button variant="secondary" onClick={() => setAction({ kind: 'deactivate', id, label: resource.data!.child.pseudonym })}>비활성화 내용 확인</Button></div></Card>
        {action && <ActionDialog key={`${action.kind}:${action.id}`} title={`${action.label} · ${action.kind === 'cancel' ? '초대 취소' : action.kind === 'disconnect' ? '연결 해제' : '아동 비활성화'} 확인`} onClose={() => setAction(null)} intro={<Alert tone="warning">{action.kind === 'deactivate' ? '아동의 학습 접근을 차단하고 치료사 연결·미완료 초대를 철회합니다. 물리적인 정보 삭제를 뜻하지 않습니다.' : action.kind === 'disconnect' ? '이 치료사의 아동 프로필·기록 조회 권한을 종료합니다. 다시 연결하려면 새로 초대해야 합니다.' : '보낸 초대를 취소합니다. 연결하려면 새로 초대해야 합니다.'}</Alert>}
          label={action.kind === 'cancel' ? '초대 취소' : action.kind === 'disconnect' ? '연결 해제' : '아동 비활성화'} danger reauthenticate={action.kind === 'deactivate'} confirmation={action.kind === 'deactivate' ? '아동 접근과 연결을 차단하며, 물리적인 삭제가 아님을 확인했습니다.' : '이 초대 또는 연결을 종료하면 새로 초대해야 함을 확인했습니다.'} prepare={() => ({ path: action.kind === 'deactivate' ? childPath(id) : `${childPath(id)}/${action.kind === 'cancel' ? 'therapist-invitations' : 'therapists'}/${action.id}`, method: 'DELETE', expectedStatus: 204 })} onSuccess={async () => { if (action.kind === 'deactivate') window.location.hash = '/workspace/children'; else await complete('선택한 초대 또는 연결을 종료했습니다.') }} onRecover={async () => { setAction(null); await resource.reload() }} />}
      </div>}
    </ResourceState>
  </>
}
