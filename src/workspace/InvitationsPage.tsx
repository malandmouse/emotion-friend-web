import { useState } from 'react'
import { Alert, Button, Card, EmptyState, PageHeader } from '../components/ui'
import { loadInbox } from './api'
import { ActionDialog } from './ActionDialog'
import type { InboxInvitation } from './contracts'
import { formatTime } from './contracts'
import { Capabilities, ResourceState } from './shared'
import { useResource } from './useResource'

export function InvitationsPage() {
  const resource = useResource(loadInbox)
  const [selected, setSelected] = useState<{ invitation: InboxInvitation; accept: boolean } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  return <>
    <PageHeader title="받은 치료사 초대" description="기존에 알고 있는 보호자에게 실제 치료 관계를 확인한 뒤 수락해 주세요." action={<Button variant="secondary" loading={resource.loading} onClick={() => { setSelected(null); void resource.reload() }}>초대 새로고침</Button>} />
    {message && <div className="section-notice"><Alert tone="success">{message}</Alert></div>}
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload}>
      {resource.data && <div className="stack">{resource.data.length === 0 ? <Card><EmptyState title="새로 받은 초대가 없어요" description="초대가 취소·만료되거나 이미 처리되었다면 표시되지 않습니다." /></Card> : resource.data.map((invitation) => <Card key={invitation.invitationId} title={`${invitation.guardianDisplayName}님의 초대`}>
        <p className="muted">보호자 연락처 {invitation.guardianContact} · 만료 {formatTime(invitation.expiresAt)}</p><p className="form-note">수락 전에는 아동 정보가 표시되지 않습니다.</p><div className="form-actions"><Capabilities values={invitation.capabilities} /></div><div className="row form-actions"><Button onClick={() => setSelected({ invitation, accept: true })}>관계 확인·수락</Button><Button variant="secondary" onClick={() => setSelected({ invitation, accept: false })}>거절 내용 확인</Button></div>
      </Card>)}
        {selected && <ActionDialog key={`${selected.invitation.invitationId}:${selected.accept}`} title={selected.accept ? '치료 관계 확인 후 초대 수락' : '초대 거절 확인'} onClose={() => setSelected(null)} intro={<div className="stack"><p><strong>{selected.invitation.guardianDisplayName}</strong>님의 초대입니다.</p><p className="muted">보호자 연락처 {selected.invitation.guardianContact} · 만료 {formatTime(selected.invitation.expiresAt)}</p><Capabilities values={selected.invitation.capabilities} /></div>} label={selected.accept ? '초대 수락' : '초대 거절'} reauthenticate={selected.accept} confirmation={selected.accept ? '보호자와 기존 연락 경로로 실제 치료 관계를 확인했습니다.' : '이 초대를 거절함을 확인했습니다.'} prepare={() => ({ path: `/therapist-invitations/${selected.invitation.invitationId}/${selected.accept ? 'accept' : 'decline'}`, method: 'POST', expectedStatus: 204, body: selected.accept ? { treatmentRelationshipConfirmed: true } : undefined })} onSuccess={async () => { setMessage(selected.accept ? '초대를 수락했습니다. 연결된 아동 목록에서 확인해 주세요.' : '초대를 거절했습니다.'); setSelected(null); await resource.reload() }} onRecover={async () => { setSelected(null); await resource.reload() }} />}
      </div>}
    </ResourceState>
  </>
}
