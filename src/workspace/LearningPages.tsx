import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import type { Member } from '../auth/contracts'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, SelectField, TextField } from '../components/ui'
import { ActionForm } from './ActionForm'
import { childPath } from './api'
import { formatTime, workspaceError } from './contracts'
import { loadRecords, loadSessions, needsLearningReload, parseSession, periodQuery, sessionHref, sessionLabels } from './learning'
import type { SessionStatus } from './learning'
import { ResourceState } from './shared'
import { useResource } from './useResource'

const limitationLabels: Record<string, string> = { RECOGNITION_NOT_COLLECTED: '인식 관찰 지표는 아직 수집되지 않았습니다.', ASSISTANCE_NOT_COLLECTED: '도움 사용 지표는 아직 수집되지 않았습니다.', NOT_A_DIAGNOSTIC_SCORE: '이 집계는 진단 점수가 아닙니다.' }

export function SessionsPage({ id, member }: { id: string; member: Member }) {
  const [cursor, setCursor] = useState<string>()
  const [filter, setFilter] = useState<SessionStatus | ''>('')
  const load = useCallback((signal: AbortSignal) => loadSessions(id, cursor, filter || undefined, signal), [id, cursor, filter])
  const resource = useResource(load)
  return <>
    <PageHeader title={!resource.loading && resource.data ? `${resource.data.child.pseudonym}의 학습 세션` : '학습 세션'} description="서버에 저장된 진행 상태와 완료·별을 확인합니다." action={<Button variant="secondary" loading={resource.loading} onClick={() => void resource.reload()}>세션 새로고침</Button>} />
    <div className="stack">
      <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload}>
        {resource.data && <>
          {member.role === 'GUARDIAN' && resource.data.child.capabilities.includes('MANAGE') && <Card title="Day 1 세션 시작·복원"><div className="section-notice"><Alert>발행된 5개 자료가 준비되어야 시작할 수 있습니다. 현재는 보호자 계정으로 실행하는 관리 기능이며, 아동 기기 연결과 이야기 재생은 별도 연동이 필요합니다.</Alert></div>
            <ActionForm label="세션 시작·복원" disabled={resource.loading} prepare={(data) => ({ path: `${childPath(id)}/learning-sessions`, method: 'POST', expectedStatus: [200, 201], body: { schemaVersion: '0.3.0', deviceId: String(data.get('deviceId')).trim() } })} onSuccess={(raw) => { const session = parseSession(raw, id); window.location.hash = sessionHref(id, session.sessionId).slice(1) }} onRecover={resource.reload} onFailure={async (error) => { if (needsLearningReload(error)) await resource.reload() }}>
              <TextField label="실행 기기 식별자" name="deviceId" required maxLength={128} pattern="[A-Za-z0-9][A-Za-z0-9._:\-]*" hint="연동된 실행 기기의 식별자를 입력하세요. 같은 기기 식별자로 기존 세션을 복원합니다." />
            </ActionForm>
          </Card>}
          <div className="filter-bar"><SelectField label="세션 상태" value={filter} onChange={(event) => { setFilter(event.target.value as SessionStatus | ''); setCursor(undefined) }}><option value="">전체</option><option value="ACTIVE">진행 중</option><option value="COMPLETED">완료</option></SelectField></div>
          {resource.data.items.length === 0 ? <Card><EmptyState title="학습 세션이 없어요" description="시작된 세션이 여기에 표시됩니다. 아직 시작하지 않은 상태는 학습 실패나 0점이 아닙니다." /></Card> : resource.data.items.map((session) => <Card key={session.sessionId} title={`Day ${session.dayIndex} · ${session.localDate}`} action={<Badge tone={session.status === 'COMPLETED' ? 'success' : 'info'}>{sessionLabels[session.status]}</Badge>}>
            <dl className="detail-grid"><div><dt>완료한 이야기</dt><dd>{session.completedCount} / 5개</dd></div><div><dt>누적 별</dt><dd>★ {session.stars} / 5개</dd></div><div><dt>시작</dt><dd>{formatTime(session.startedAt)}</dd></div><div><dt>보상 기준 시간대</dt><dd>{session.timezone}</dd></div></dl>
            {session.completedAt && <p className="muted">완료 {formatTime(session.completedAt)}</p>}
            <a className="button button--secondary" href={sessionHref(id, session.sessionId)}>세션 상세·receipt</a>
          </Card>)}
          <div className="row">{cursor && <Button variant="secondary" onClick={() => setCursor(undefined)}>처음 목록</Button>}{resource.data.nextCursor && <Button variant="secondary" onClick={() => setCursor(resource.data!.nextCursor!)}>다음 목록</Button>}</div>
        </>}
      </ResourceState>
    </div>
  </>
}

export function RecordsPage({ id }: { id: string }) {
  const [cursor, setCursor] = useState<string>()
  const [period, setPeriod] = useState('')
  const [periodError, setPeriodError] = useState('')
  const load = useCallback((signal: AbortSignal) => loadRecords(id, cursor, period, signal), [id, cursor, period])
  const resource = useResource(load)
  function changePeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try { const next = periodQuery(String(data.get('from')), String(data.get('to'))); setPeriod(next); setPeriodError(''); setCursor(undefined) } catch (error) { setPeriodError(workspaceError(error)) }
  }
  const summary = resource.data?.summary
  return <>
    <PageHeader title={!resource.loading && resource.data ? `${resource.data.child.pseudonym}의 학습 결과·기록` : '학습 결과·기록'} description="수락된 완료 기록과 별만 표시합니다. 감정 선택을 정답률이나 진단 점수로 해석하지 않습니다." action={<Button variant="secondary" loading={resource.loading} onClick={() => void resource.reload()}>기록 새로고침</Button>} />
    <div className="stack">
      <Card title="기간별 학습 요약" description="기본 최근 30일 · 날짜 선택은 한국 시간 기준이며 시작일과 종료일을 포함합니다. 최대 366일을 조회할 수 있어요.">
        <form onSubmit={changePeriod} className="period-form"><TextField label="시작일" name="from" type="date" required /><TextField label="종료일" name="to" type="date" required /><div className="row"><Button type="submit" variant="secondary" disabled={resource.loading}>기간 적용</Button><Button variant="ghost" disabled={resource.loading} onClick={() => { setPeriod(''); setPeriodError('') }}>최근 30일</Button></div></form>
        {periodError && <Alert tone="error">{periodError}</Alert>}
      </Card>
      <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload}>
        {resource.data && summary && <>
          <Card title="완료·별 집계"><p className="muted">{formatTime(summary.periodStart)} 이상 ~ {formatTime(summary.periodEnd)} 미만</p><dl className="learning-metrics"><div><dt>완료한 이야기</dt><dd>{summary.completedLoops}개</dd></div><div><dt>받은 별</dt><dd>★ {summary.starsEarned}개</dd></div></dl>
            <div className="stack"><Alert>기록이 없는 상태는 0점이 아닙니다. 수집되지 않은 인식·도움 지표를 0으로 환산하지 않습니다.</Alert>{summary.limitations.length > 0 && <div><h3>이 집계로 알 수 없는 항목</h3><ul>{summary.limitations.map((item, index) => <li key={index}>{limitationLabels[item] ?? item}</li>)}</ul></div>}
              {summary.recognitionCounts.length > 0 && <div><h3>인식 관찰 횟수</h3><ul>{summary.recognitionCounts.map((item) => <li key={item.key}>{item.key}: {item.count}회</li>)}</ul></div>}
              {summary.assistanceCounts.length > 0 && <div><h3>도움 사용 횟수</h3><ul>{summary.assistanceCounts.map((item) => <li key={item.key}>{item.key}: {item.count}회</li>)}</ul></div>}
              <details><summary>집계 근거 식별자</summary><code className="technical-id">{summary.metricSnapshotHash}</code></details>
            </div>
          </Card>
          <Card title="전체 완료 기록" description="기간별 요약과 별도로 모든 수락된 기록을 서버 목록 순서로 표시합니다.">
            {resource.data.items.length === 0 ? <EmptyState title="아직 완료 기록이 없어요" description="서버가 완료를 수락하고 receipt를 저장하면 이곳에 표시됩니다." /> : <div className="stack">{resource.data.items.map((record) => <article className="management-row" key={record.receiptId}><div><h3>{record.subject}</h3><p className="muted">{formatTime(record.completedAt)} · 이야기 {record.slot} · ★ +{record.starsAwarded}</p></div><a className="button button--secondary" href={`${sessionHref(id, record.sessionId)}?receipt=${record.slot}`}>완료 receipt 보기</a></article>)}</div>}
          </Card>
          <div className="row">{cursor && <Button variant="secondary" onClick={() => setCursor(undefined)}>처음 목록</Button>}{resource.data.nextCursor && <Button variant="secondary" onClick={() => setCursor(resource.data!.nextCursor!)}>다음 목록</Button>}</div>
        </>}
      </ResourceState>
    </div>
  </>
}
