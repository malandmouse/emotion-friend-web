import { useCallback, useState } from 'react'
import type { Member } from '../auth/contracts'
import { authenticatedApi } from '../auth/session'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, SelectField, TextArea, TextField } from '../components/ui'
import { ActionDialog } from './ActionDialog'
import { formatTime, page, roleLabels, statusLabels } from './contracts'
import { ResourceState } from './shared'
import { useResource } from './useResource'

export function MembersPage({ member }: { member: Member }) {
  const [status, setStatus] = useState('PENDING')
  const [cursor, setCursor] = useState<string | undefined>()
  const [selected, setSelected] = useState<{ member: Member; action: 'approve' | 'reject' | 'suspend' | 'role' } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => page<Member>(await authenticatedApi(`/admin/members?limit=20${status ? `&status=${status}` : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)), [status, cursor])
  const resource = useResource(load)
  return <>
    <PageHeader title="회원·역할 관리" description="가입 신청 역할과 승인 역할을 구분하고, 검토 근거를 남깁니다." action={<Button variant="secondary" loading={resource.loading} onClick={() => { setSelected(null); void resource.reload() }}>회원 새로고침</Button>} />
    <div className="section-notice filter-bar"><SelectField label="계정 상태" value={status} onChange={(event) => { setStatus(event.target.value); setCursor(undefined); setSelected(null) }}><option value="">전체</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField></div>
    {message && <div className="section-notice"><Alert tone="success">{message}</Alert></div>}
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload}>
      {resource.data && <div className="stack">{resource.data.items.length === 0 ? <Card><EmptyState title="해당 상태의 회원이 없어요" description="상태 필터를 변경하거나 목록을 새로 확인해 주세요." /></Card> : resource.data.items.map((target) => {
        const protectedMember = target.id === member.id || target.role === 'ADMIN'
        return <Card title={target.displayName} key={target.id} action={<Badge>{statusLabels[target.status]}</Badge>}><p className="muted">{target.email} · 가입 {formatTime(target.createdAt)}</p><dl className="detail-grid"><div><dt>신청 역할</dt><dd>{target.requestedRole ? roleLabels[target.requestedRole] : '해당 없음'}</dd></div><div><dt>승인 역할</dt><dd>{target.role ? roleLabels[target.role] : '미승인'}</dd></div><div><dt>이메일 확인</dt><dd>{target.emailVerified ? '확인 완료' : '미확인'}</dd></div></dl>
          {protectedMember ? <p className="muted">운영자 계정은 이 화면에서 변경할 수 없습니다.</p> : <div className="row"><Button disabled={resource.loading || target.status === 'ACTIVE' || !target.emailVerified} onClick={() => setSelected({ member: target, action: 'approve' })}>신청 역할 승인</Button>{target.status === 'PENDING' && <Button variant="secondary" disabled={resource.loading} onClick={() => setSelected({ member: target, action: 'reject' })}>신청 반려</Button>}{target.status === 'ACTIVE' && <><Button variant="secondary" disabled={resource.loading} onClick={() => setSelected({ member: target, action: 'role' })}>역할 변경</Button><Button variant="secondary" disabled={resource.loading} onClick={() => setSelected({ member: target, action: 'suspend' })}>이용 정지</Button></>}</div>}
          {!target.emailVerified && !protectedMember && <p className="form-note">이메일 확인 전에는 승인할 수 없습니다.</p>}
        </Card>
      })}
        <div className="row">{cursor && <Button variant="secondary" onClick={() => setCursor(undefined)}>처음 목록</Button>}{resource.data.nextCursor && <Button variant="secondary" onClick={() => setCursor(resource.data!.nextCursor!)}>다음 회원</Button>}</div>
        {selected && <ActionDialog key={`${selected.member.id}:${selected.action}`} title={`${selected.member.displayName} · ${selected.action === 'approve' ? '신청 역할 승인' : selected.action === 'reject' ? '가입 신청 반려' : selected.action === 'suspend' ? '이용 정지' : '역할 변경'} 확인`} onClose={() => setSelected(null)} intro={<div className="stack"><Alert tone="warning">{selected.member.email} 계정의 상태를 변경합니다. 해당 회원의 기존 세션은 종료되며, 정지·역할 변경 등으로 철회된 치료사 연결은 자동 복구되지 않습니다.</Alert><p className="form-note">현재 상태: {statusLabels[selected.member.status]} · 신청 역할: {selected.member.requestedRole ? roleLabels[selected.member.requestedRole] : '해당 없음'} · 승인 역할: {selected.member.role ? roleLabels[selected.member.role] : '미승인'}</p></div>}
          label="검토 결과 적용" danger={selected.action === 'suspend' || selected.action === 'reject'} reauthenticate confirmation="대상 회원과 검토 근거, 변경에 따른 접근·연결 영향을 확인했습니다." prepare={(data) => ({ path: `/admin/members/${selected.member.id}/${selected.action}`, method: 'POST', expectedStatus: 200, body: { reason: String(data.get('reason')).trim(), reviewReference: String(data.get('reviewReference')).trim(), ...(selected.action === 'role' ? { role: data.get('role') } : {}) } })} onSuccess={async () => { setMessage('서버에 검토 결과를 적용했습니다. 해당 회원은 다시 로그인해야 합니다.'); setSelected(null); await resource.reload() }} onRecover={async () => { setSelected(null); await resource.reload() }}>
            {selected.action === 'role' && <SelectField label="변경할 역할" name="role" required defaultValue={selected.member.role === 'GUARDIAN' ? 'THERAPIST' : 'GUARDIAN'}><option value={selected.member.role === 'GUARDIAN' ? 'THERAPIST' : 'GUARDIAN'}>{selected.member.role === 'GUARDIAN' ? '치료사' : '보호자'}</option></SelectField>}
            <TextArea label="검토 사유" name="reason" required maxLength={500} /><TextField label="검토 근거 식별자" name="reviewReference" required maxLength={200} placeholder="검토 문서·기록의 식별자" />
        </ActionDialog>}
      </div>}
    </ResourceState>
  </>
}
