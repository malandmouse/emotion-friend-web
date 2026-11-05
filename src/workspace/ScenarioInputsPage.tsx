import { useCallback, useState } from 'react'
import { authenticatedApi } from '../auth/session'
import { Alert, Button, Card, EmptyState, PageHeader } from '../components/ui'
import { childPath } from './api'
import { object } from './contracts'
import { useResource } from './useResource'
import { ResourceState } from './shared'
import { ActionForm } from './ActionForm'
import { DailyEventFields, ScenarioSettingsFields } from './ScenarioSettingsFields'
import { WorkflowSteps } from './CareComponents'
import { understanding } from './scenarioSettingsOptions'

export type Settings = {
  ageBands: string[]; caregiverObservedAt: string | null; experienceNarrative: string | null
  emotionExpression: string[] | null; understanding: Record<string, string | null>; priorityGoals: string[]
  expressionExamples: { text: string; context: string | null; source: string; recordedAt: string | null }[]
  characterPreference: string
}
export interface ScenarioProfile { revision: number; baseProfileVersion: number; profile: Settings }
export interface DailyEvent { eventId: string; version: number; occurredOn: string; text: string; reportedFeeling: string | null }
export interface EventPage { revision: number; items: DailyEvent[]; nextCursor: string | null }
function SettingsEditor({ id, view, reload }: { id: string; view: ScenarioProfile; reload: () => Promise<void> }) {
  return <Card className="care-settings-editor"><ActionForm label="설정 저장" onRecover={reload} onSuccess={reload} prepare={data => {
    const selectedGoals = data.getAll('priorityGoals').map(String)
    if (selectedGoals.length > 2) throw new Error('목표는 최대 두 개를 선택해 주세요.')
    const exampleText = String(data.get('examples') ?? '').split('\n').map(s => s.trim()).filter(Boolean)
    if (exampleText.length > 5) throw new Error('표현 예시는 다섯 개 이내로 입력해 주세요.')
    return { path: `${childPath(id)}/scenario-profile`, method: 'PUT', expectedStatus: 200, body: {
      expectedRevision: view.revision, expectedBaseProfileVersion: view.baseProfileVersion, settings: {
        ageBands: data.getAll('ageBands').map(String), caregiverObservedAt: new Date().toISOString(),
        experienceNarrative: data.get('experienceNarrative') || null,
        emotionExpression: data.getAll('emotionExpression').length ? data.getAll('emotionExpression') : null,
        understanding: Object.fromEntries(Object.keys(understanding).map(k => [k, data.get(k) || null])),
        priorityGoals: selectedGoals, characterPreference: data.get('characterPreference'),
        expressionExamples: exampleText.map(text => ({ text, context: null, source: 'CAREGIVER_REPORTED_CHILD_UTTERANCE', recordedAt: null })),
      },
    } }
  }}>
    <ScenarioSettingsFields profile={view.profile} />
  </ActionForm></Card>
}
export function ScenarioSettingsPage({ id }: { id: string }) {
  const load = useCallback(async (signal: AbortSignal) => object<ScenarioProfile>(await authenticatedApi(`${childPath(id)}/scenario-profile`, { signal })), [id])
  const r = useResource(load)
  return <><PageHeader title="AI 대화 설정" description="기본 프로필의 관심사·피할 소재와 함께 시나리오·답변·카드 제작에 사용합니다." /><WorkflowSteps current={0} /><ResourceState loading={r.loading} error={r.error} retry={r.reload}>{r.data && <div className="stack"><SettingsEditor key={`${id}:${r.data.revision}:${r.data.baseProfileVersion}`} id={id} view={r.data} reload={r.reload} /><Card title="다음 단계"><p>설정을 저장한 뒤, 최근 경험을 추가하거나 바로 하루 다섯 편을 준비할 수 있습니다.</p><div className="row"><a className="button button--secondary" href={`#/workspace/children/${id}/daily-events`}>최근 경험 등록</a><a className="button button--primary" href={`#/workspace/children/${id}/agent`}>하루 다섯 편 준비</a></div></Card></div>}</ResourceState></>
}
function EventEditor({ id, event, done }: { id: string; event?: DailyEvent; done: () => Promise<void> }) {
  return <ActionForm label={event ? '경험 수정' : '경험 저장'} onSuccess={done} onRecover={done} prepare={data => ({
    path: `${childPath(id)}/daily-events${event ? `/${event.eventId}` : ''}`, method: event ? 'PUT' : 'POST', expectedStatus: event ? 200 : 201,
    body: { ...(event ? { expectedVersion: event.version } : {}), occurredOn: data.get('occurredOn'), text: data.get('text'), reportedFeeling: data.get('reportedFeeling') || null },
  })}>
    <DailyEventFields event={event} />
  </ActionForm>
}
export function DailyEventsPage({ id }: { id: string }) {
  const [cursor, setCursor] = useState<string | null>(null), [editing, setEditing] = useState<string | null>(null)
  const load = useCallback(async (signal: AbortSignal) => object<EventPage>(await authenticatedApi(`${childPath(id)}/daily-events${cursor ? `?cursor=${cursor}` : ''}`, { signal })), [id, cursor])
  const r = useResource(load)
  return <><PageHeader title="최근 경험" description="아이의 일상에서 다음 이야기의 실마리를 찾아요." action={<a className="button button--primary" href={`#/workspace/children/${id}/agent`}>이야기 제작으로</a>} /><WorkflowSteps current={1} /><div className="care-events-layout">
    <div className="stack"><Card title="오늘, 어떤 일이 있었나요?" description="아이의 말과 경험을 짧게 남겨 주세요." className="care-event-editor"><EventEditor id={id} done={r.reload} /></Card><Alert>아동이 답변할 때 꺼낼 수 있는 후보로 참고합니다. 캐릭터의 경험으로 바꾸지 않으며, 저장만으로 유료 호출하지 않습니다.</Alert></div>
    <div className="stack"><div className="care-list-heading"><h2>저장한 경험</h2><span>이야기 제작에서 최대 5개 선택</span></div><ResourceState loading={r.loading} error={r.error} retry={r.reload}>{r.data && <>
      {r.data.items.length === 0 && <Card><EmptyState title="아직 남긴 경험이 없어요" description="떠오르는 경험이 있을 때 편하게 남겨 주세요. 경험 없이도 이야기를 제작할 수 있어요." /></Card>}
      {r.data.items.map(e => <Card className="care-event-card" key={`${e.eventId}:${e.version}`} title={e.occurredOn}>{editing === e.eventId ? <EventEditor id={id} event={e} done={async () => { setEditing(null); await r.reload() }} /> : <><p className="care-event-text">{e.text}</p>{e.reportedFeeling && <p className="care-feeling-tag">{e.reportedFeeling}</p>}<div className="care-event-actions"><Button variant="secondary" onClick={() => setEditing(e.eventId)}>수정</Button><ActionForm label="경험 삭제" danger confirmation="이 경험을 앞으로 제작할 때 사용하지 않습니다." prepare={() => ({ path: `${childPath(id)}/daily-events/${e.eventId}?expectedVersion=${e.version}`, method: 'DELETE', expectedStatus: 200 })} onSuccess={r.reload} onRecover={r.reload} /></div></>}</Card>)}
      <div className="row">{cursor && <Button variant="secondary" onClick={() => setCursor(null)}>처음 목록</Button>}{r.data.nextCursor && <Button variant="secondary" onClick={() => setCursor(r.data!.nextCursor)}>다음 목록</Button>}</div>
    </>}</ResourceState></div>
  </div></>
}
