import { useCallback, useRef, useState } from 'react'
import type { Member } from '../auth/contracts'
import { ApiFailure } from '../api/client'
import { Alert, Badge, Button, Card, Checkbox, EmptyState, PageHeader, TextArea, TextField } from '../components/ui'
import { ActionForm } from './ActionForm'
import { formatTime } from './contracts'
import { loadReceipt, loadSession, needsLearningReload, parseExpression, parseReceipt, sessionLabels, sessionPath } from './learning'
import type { Expression, LearningSession, Receipt } from './learning'
import { ResourceState } from './shared'
import { useResource } from './useResource'

const nextActions: Record<string, string> = { CHARACTER_REPLY: '캐릭터 반응 연동 대기', CONTINUE: '다음 이야기 진행', NEXT_SLOT: '다음 이야기 진행', CONTINUE_SESSION: '다음 이야기 진행', SESSION_COMPLETED: '세션 완료', SHOW_RESULT: '학습 결과 확인', START_REVIEW: '복습 시작' }
function ReceiptDetails({ receipt }: { receipt: Receipt }) {
  return <div className="stack"><Alert tone="success" title={`이야기 ${receipt.slot}의 완료가 수락되었습니다`}>완료·별·receipt가 함께 저장되었습니다. 재생 실패로 이미 저장된 완료나 별이 취소되지는 않습니다.</Alert>
    <dl className="detail-grid"><div><dt>수락 시각</dt><dd>{formatTime(receipt.completedAt)}</dd></div><div><dt>이번에 받은 별</dt><dd>★ +{receipt.starsAwarded}</dd></div><div><dt>수락 당시 완료</dt><dd>{receipt.completedCount} / 5개</dd></div><div><dt>수락 당시 누적 별</dt><dd>★ {receipt.stars} / 5개</dd></div><div><dt>다음 단계</dt><dd>{nextActions[receipt.nextAction] ?? receipt.nextAction}</dd></div><div><dt>완료 식별자</dt><dd className="technical-id">{receipt.receiptId}</dd></div></dl>
    <p className="muted">receipt의 누적 수치는 수락 당시 값입니다. 현재 누적 수치는 위의 세션 상태에서 확인해 주세요.</p>
  </div>
}
function ReceiptPanel({ childId, sessionId, slot }: { childId: string; sessionId: string; slot: number }) {
  const load = useCallback((signal: AbortSignal) => loadReceipt(childId, sessionId, slot, signal), [childId, sessionId, slot])
  const resource = useResource(load)
  return <Card title={`이야기 ${slot} · 완료 receipt`} action={<Button variant="secondary" loading={resource.loading} onClick={() => void resource.reload()}>receipt 다시 조회</Button>}><ResourceState loading={resource.loading} error={resource.error} retry={resource.reload}>{resource.data ? <ReceiptDetails receipt={resource.data} /> : <EmptyState title="아직 저장된 완료가 없어요" description="현재 세션에 이 이야기의 완료 기록이 없습니다." />}</ResourceState></Card>
}

function CompletionPanel({ session, reload, recover }: { session: LearningSession; reload: () => Promise<void>; recover: (slot: number) => Promise<void> }) {
  const [expression, setExpression] = useState<Expression | null>(null)
  const [version, setVersion] = useState(1)
  const [entry, setEntry] = useState(0)
  const [completionLocked, setCompletionLocked] = useState(false)
  const submittedVersion = useRef(version)
  const slot = session.completedCount + 1
  const path = `${sessionPath(session.sessionId)}/slots/${slot}`
  async function onFailure(error: unknown) { if (needsLearningReload(error)) await reload() }
  return <Card title={`이야기 ${slot} · 실행 결과 연결`}>
    <div className="section-notice"><Alert>연동된 학습 실행 화면에서 아동이 실제로 선택한 경로·감정과 직접 확인한 입력만 연결하세요. 이야기 재생 기능은 이 화면에 포함되어 있지 않습니다. 완료와 별은 서버 검증 후 저장됩니다.</Alert></div>
    <details className="completion-details"><summary>직접 입력 확정과 완료 연결</summary><div className="stack">
      {!expression ? <ActionForm key={entry} label="아동이 확인한 입력 확정" prepare={(data) => {
        const draftVersion = Number(data.get('draftVersion'))
        if (!Number.isSafeInteger(draftVersion) || draftVersion < 1) throw new ApiFailure('INVALID_SCHEMA', 422)
        submittedVersion.current = draftVersion
        return { path: `${path}/confirmed-expressions`, method: 'POST', expectedStatus: 201, body: { text: String(data.get('text')), draftVersion, inputSource: 'TYPED', childConfirmed: true } }
      }} onSuccess={(raw) => {
        const parsed = parseExpression(raw, submittedVersion.current)
        setVersion(parsed.draftVersion); setExpression(parsed)
      }} onRecover={() => recover(slot)} onFailure={onFailure}>
        <TextArea label="아동이 확인할 직접 입력" name="text" required maxLength={2000} hint="원문은 브라우저 저장소에 저장하지 않습니다. 입력 확정만으로 완료나 별이 생기지는 않습니다." />
        <TextField label="입력 버전" name="draftVersion" type="number" required min={version} step={1} defaultValue={version} hint="다시 확정할 때는 이전보다 큰 버전을 사용합니다. 새로고침 후에는 실행 화면의 최신 버전을 확인하세요." />
        <Checkbox required name="childConfirmed" label="아동이 이 입력을 직접 확인했습니다." />
      </ActionForm> : <>
        <Alert tone="success">입력 버전 {expression.draftVersion}을 확정했습니다. 유효 기한: {formatTime(expression.expiresAt)}. 완료하기 전에는 별이 지급되지 않습니다.</Alert>
        <ActionForm label="실행 결과 검증·완료 저장" onLockChange={setCompletionLocked} confirmation="실제 학습 실행에서 선택한 경로·감정이며, 아동이 확인한 입력 버전과 일치합니다." prepare={(data) => {
          if (Date.now() >= Date.parse(expression.expiresAt)) throw new ApiFailure('EXPRESSION_EXPIRED', 409)
          const selectedChoiceIds = String(data.get('choices')).split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
          if (selectedChoiceIds.length > 100 || new Set(selectedChoiceIds).size !== selectedChoiceIds.length || selectedChoiceIds.some((value) => value.length > 128)) throw new ApiFailure('INVALID_BRANCH_PATH', 422)
          return { path: `${path}/finalize`, method: 'POST', expectedStatus: 200, body: { confirmedExpressionRef: expression.confirmedExpressionRef, draftVersion: expression.draftVersion, selectedChoiceIds, terminalSceneId: String(data.get('scene')).trim(), selectedEmotionId: String(data.get('emotion')).trim(), expressionChoice: 'ORIGINAL', expectedSessionRevision: session.revision, expectedWorldRevision: session.worldRevision, clientCommitId: crypto.randomUUID() } }
        }} onSuccess={async (raw) => { parseReceipt(raw, session.sessionId, slot, session.planId); await recover(slot) }} onRecover={() => recover(slot)} onFailure={onFailure}>
          <TextArea label="선택한 경로 식별자 (순서대로 한 줄에 하나)" name="choices" maxLength={12899} hint="실행 화면에서 받은 선택 식별자를 사용합니다. 선택 분기가 없으면 비워 두세요." />
          <TextField label="마지막 장면 식별자" name="scene" required maxLength={128} />
          <TextField label="선택한 감정 식별자" name="emotion" required maxLength={128} />
        </ActionForm>
        <Button variant="secondary" disabled={completionLocked} onClick={() => { setExpression(null); setVersion(expression.draftVersion + 1); setEntry((value) => value + 1) }}>입력을 바꾸거나 다시 확정</Button>
      </>}
    </div></details>
  </Card>
}

export function SessionPage({ id, sessionId, initialReceipt, member }: { id: string; sessionId: string; initialReceipt?: number; member: Member }) {
  const load = useCallback((signal: AbortSignal) => loadSession(id, sessionId, signal), [id, sessionId])
  const resource = useResource(load)
  const [receiptSlot, setReceiptSlot] = useState(initialReceipt)
  const [receiptVersion, setReceiptVersion] = useState(0)
  const data = resource.data
  const session = data?.session
  async function recover(slot: number) { setReceiptSlot(slot); setReceiptVersion((value) => value + 1); await resource.reload() }
  return <>
    <PageHeader title={!resource.loading && data ? `${data.child.pseudonym}의 학습 세션` : '학습 세션 상세'} description="현재 누적 상태와 슬롯별 완료 receipt를 확인합니다." action={<Button variant="secondary" loading={resource.loading} onClick={() => void resource.reload()}>세션 상태 확인</Button>} />
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload}>
      {data && session && <div className="stack">
        <Card title={`Day ${session.dayIndex} · ${session.localDate}`} action={<Badge tone={session.status === 'COMPLETED' ? 'success' : 'info'}>{sessionLabels[session.status]}</Badge>}>
          <dl className="learning-metrics"><div><dt>현재 완료</dt><dd>{session.completedCount} / 5개</dd></div><div><dt>현재 누적 별</dt><dd>★ {session.stars} / 5개</dd></div></dl><p className="muted">보상 기준: {session.localDate} · {session.timezone}. 한 이야기의 최초 완료에 별 1개, 세션당 최대 5개입니다.</p>
          <ol className="session-slots">{session.slots.map((item) => <li key={item.slot}><div><strong>이야기 {item.slot}</strong><Badge tone={item.completed ? 'success' : item.slot === session.completedCount + 1 ? 'info' : 'neutral'}>{item.completed ? '완료' : item.slot === session.completedCount + 1 ? '다음 순서' : '대기'}</Badge></div><Button variant="secondary" size="sm" disabled={resource.loading} onClick={() => { setReceiptSlot(item.slot); setReceiptVersion((value) => value + 1) }}>{item.completed ? 'receipt 보기' : '완료 여부 복구 조회'}</Button></li>)}</ol>
        </Card>
        {receiptSlot !== undefined && <ReceiptPanel key={`${receiptSlot}:${receiptVersion}`} childId={id} sessionId={sessionId} slot={receiptSlot} />}
        {member.role === 'GUARDIAN' && data.child.capabilities.includes('MANAGE') && session.status === 'ACTIVE' && session.completedCount < 5 && <fieldset className="form-fieldset" disabled={resource.loading}><CompletionPanel key={`${session.sessionId}:${session.revision}`} session={session} reload={resource.reload} recover={recover} /></fieldset>}
        <div className="row"><a className="button button--secondary" href={`#/workspace/children/${id}/sessions`}>세션 목록</a><a className="button button--secondary" href={`#/workspace/children/${id}/records`}>학습 결과·기록</a></div>
      </div>}
    </ResourceState>
  </>
}
