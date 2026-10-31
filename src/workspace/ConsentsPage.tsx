import { useCallback, useState } from 'react'
import { Alert, Badge, Button, Card, PageHeader } from '../components/ui'
import { childPath, loadConsents } from './api'
import { ActionDialog } from './ActionDialog'
import { consentLabels, formatTime } from './contracts'
import type { Notice } from './contracts'
import { ResourceState } from './shared'
import { useResource } from './useResource'

export function ConsentsPage({ id }: { id: string }) {
  const load = useCallback(() => loadConsents(id), [id])
  const resource = useResource(load)
  const [selection, setSelection] = useState<{ notice: Notice; granted: boolean } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  return <>
    <PageHeader title={resource.data ? `${resource.data.child.pseudonym}의 정보 사용 동의` : '정보 사용 동의'} description="목적별로 안내를 확인한 뒤 각각 선택할 수 있습니다." action={<Button variant="secondary" loading={resource.loading} onClick={() => { setSelection(null); void resource.reload() }}>동의 상태 확인</Button>} />
    {message && <div className="section-notice"><Alert tone="success">{message}</Alert></div>}
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload}>
      {resource.data && <div className="stack"><Alert>등록과 동의는 별도입니다. 선택하지 않은 목적은 동의하지 않은 상태이며, 철회한 기능의 새 처리를 중단합니다.</Alert>
        {resource.data.notices.map((notice) => {
          const consent = resource.data!.consents.find((value) => value.scope === notice.scope)
          const granted = consent?.granted === true
          return <Card key={notice.scope} title={consentLabels[notice.scope] ?? notice.scope} action={<Badge tone={granted ? 'success' : 'neutral'}>{granted ? '동의함' : consent ? '철회됨' : '미동의'}</Badge>}>
            <p>{notice.purpose}</p><p className="form-note">안내 버전 {notice.noticeVersion}{consent && <> · {granted ? '동의' : '철회'} 기록 {formatTime(consent.withdrawnAt ?? consent.recordedAt)}</>}</p>
            <div className="form-actions"><Button variant="secondary" disabled={resource.loading} onClick={() => { setMessage(null); setSelection({ notice, granted: !granted }) }}>{granted ? '동의 철회하기' : '내용 확인·동의 선택'}</Button></div>
          </Card>
        })}
        {selection && <ActionDialog key={`${selection.notice.scope}:${selection.granted}`} title={`${consentLabels[selection.notice.scope]} · ${selection.granted ? '동의' : '철회'} 확인`} onClose={() => setSelection(null)} intro={<div className="stack"><Alert tone={selection.granted ? 'info' : 'warning'}>{selection.notice.purpose}{!selection.granted && selection.notice.scope === 'CORE_PROFILE_LEARNING' && <p>기본 동의를 철회하면 연결된 치료사와 미완료 초대도 철회됩니다. 나중에 다시 동의해도 치료사 연결이 자동 복구되지 않습니다.</p>}</Alert><p className="form-note">대상 아동: {resource.data.child.pseudonym} · 안내 버전 {selection.notice.noticeVersion}</p></div>}
          label={selection.granted ? '이 목적에 동의' : '이 목적 동의 철회'} danger={!selection.granted} reauthenticate confirmation={`${resource.data.child.pseudonym}의 해당 목적과 변경 내용을 확인했습니다.`} prepare={(_, verificationRef) => ({ path: `${childPath(id)}/consents`, method: 'POST', expectedStatus: 200, body: { schemaVersion: '0.3.0', scope: selection.notice.scope, granted: selection.granted, noticeVersion: selection.notice.noticeVersion, guardianVerificationRef: verificationRef } })} onSuccess={async () => { setMessage(selection.granted ? '선택한 목적에 동의했습니다.' : '선택한 목적의 동의를 철회했습니다.'); setSelection(null); await resource.reload() }} onRecover={async () => { setSelection(null); await resource.reload() }} />}
        <p className="muted">표시된 안내는 서버가 제공한 처리 목적 요약입니다. 전체 정보 사용 안내와 보관 정책은 서비스의 게시된 정책을 함께 확인해 주세요.</p>
      </div>}
    </ResourceState>
  </>
}
