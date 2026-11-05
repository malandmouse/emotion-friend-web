import { useCallback, useEffect, useState } from 'react'
import { authenticatedApi } from '../auth/session'
import { ApiFailure } from '../api/client'
import { Alert, Button, Card, Checkbox, PageHeader } from '../components/ui'
import { childPath } from './api'
import { object, workspaceError } from './contracts'
import { useResource } from './useResource'
import { ResourceState } from './shared'
import { ActionForm } from './ActionForm'
import type { EventPage, ScenarioProfile } from './ScenarioInputsPage'
import { DayApprovalPanel } from './DayApprovalPanel'
import { isAgentJobDetail, isAgentJobList } from './agentJobContracts'
import type { AgentJobDetail, AgentJobSummary } from './agentJobContracts'
import { isAgentCapabilities, isDayPreview, isPrototypeDay } from './prototypeContracts'
import type { DayPreviewItem } from './prototypeContracts'
import { pollResource } from './pollResource'
import { StoryPreviewCard, WorkflowSteps } from './CareComponents'
import { dayStateNames } from './careLabels'

function parseJob(raw: unknown): AgentJobDetail {
  if (!isAgentJobDetail(raw)) throw new ApiFailure('INVALID_RESPONSE')
  return raw
}
const stateLabels: Record<string, string> = { QUEUED: '제작 대기', RUNNING: '이야기를 만들고 있어요', RESULT_READY: '다섯 편의 주제·요약 준비 완료', HELD: '결과 확인 필요', FAILED: '제작 실패', CANCELLED: '취소됨', OUTCOME_UNKNOWN: '실행 여부 확인 필요' }
export function AgentPage({ id }: { id: string }) {
  const [job,setJob] = useState<AgentJobSummary|null>(null), [preview,setPreview] = useState<{jobId:string;items:DayPreviewItem[]}|null>(null), [error,setError] = useState('')
  const [selection,setSelection]=useState<{jobId:string;localDate:string}|null>(null),[pollEpoch,setPollEpoch]=useState(0)
  const load = useCallback(async (signal: AbortSignal) => {
    const [p,e,d,j,c] = await Promise.all([
      authenticatedApi(`${childPath(id)}/scenario-profile`,{signal}), authenticatedApi(`${childPath(id)}/daily-events`,{signal}),
      authenticatedApi(`${childPath(id)}/day-status`,{signal}), authenticatedApi(`${childPath(id)}/agent-jobs`,{signal}),
      authenticatedApi(`${childPath(id)}/agent-capabilities`,{signal}),
    ])
    if (!isAgentJobList(j)) throw new ApiFailure('INVALID_RESPONSE')
    if (!isPrototypeDay(d,id)) throw new ApiFailure('INVALID_RESPONSE')
    if (!isAgentCapabilities(c,id)) throw new ApiFailure('INVALID_RESPONSE')
    const jobs = j.items
    return {profile:object<ScenarioProfile>(p),events:object<EventPage>(e),day:d,jobs,capabilities:c}
  },[id])
  const r=useResource(load)
  const selectedId=selection?.localDate===r.data?.day.localDate?selection?.jobId:null
  const requestedId=selectedId??r.data?.day.jobId
  const displayed=job?.jobId===requestedId?job:r.data?.jobs.find(j=>j.jobId===requestedId)??null
  const displayedId=displayed?.jobId
  const previews=preview?.jobId===displayedId?preview?.items??[]:[]
  const reloadDay=r.reload
  const refresh=useCallback(async()=>{setError('');setPollEpoch(v=>v+1);await reloadDay()},[reloadDay])
  useEffect(()=>{
    if(!displayedId)return
    const controller=new AbortController()
    void pollResource({signal:controller.signal,
      read:async()=>parseJob(await authenticatedApi(`${childPath(id)}/agent-jobs/${displayedId}`,{signal:controller.signal})),
      pending:next=>['QUEUED','RUNNING'].includes(next.state),receive:async next=>{
        setJob(next)
        if(next.state==='RESULT_READY') {
          const raw=await authenticatedApi(`${childPath(id)}/agent-jobs/${displayedId}/summaries`,{signal:controller.signal})
          if(!isDayPreview(raw,displayedId))throw new ApiFailure('INVALID_RESPONSE')
          if(!controller.signal.aborted){setPreview({jobId:displayedId,items:raw.webPreview});await reloadDay()}
        }
      }}).catch(failure=>{if(!controller.signal.aborted)setError(workspaceError(failure))})
    return()=>controller.abort()
  },[id,displayedId,pollEpoch,reloadDay])
  return <>
    <PageHeader title="하루 대화 제작" description="저장된 아동 설정과 선택한 경험으로 하루 다섯 편을 제작합니다." action={<Button variant="secondary" loading={r.loading} onClick={()=>void refresh()}>최신 상태 확인</Button>} />
    <WorkflowSteps current={r.data?.day.canLaunch || r.data?.day.state === 'COMPLETED' ? 3 : r.data?.day.state === 'MEDIA_PREPARING' ? 2 : r.data?.day.state === 'PENDING_APPROVAL' ? 1 : 0} labels={['이야기 제작', '주제·요약 확인', '목소리 준비', 'iPad 학습']} />
    <div className="stack care-agent-stack">
      {error&&<Alert tone="error">{error}</Alert>}
      <ResourceState loading={r.loading} error={r.error} retry={refresh}>{r.data&&<>
        <Card className="care-generation-card" title={`Day ${r.data.day.programDay} · 오늘의 다섯 이야기`} action={<span className="care-date">{r.data.day.localDate}</span>}>
          <p>오늘의 상태: {dayStateNames[r.data.day.state] ?? r.data.day.state} · 완료 {r.data.day.completedCount}/5</p>
          <Alert tone={r.data.capabilities.generationMode==='LIVE'?'warning':'info'}>{r.data.capabilities.generationMode==='LIVE'
            ?`실제 제작 모드 · ${r.data.capabilities.modelRef}. 하루 다섯 편은 기본 ${r.data.capabilities.expectedGptCalls}회 GPT 요청입니다. 확정 후 문장별 Typecast, 카드·확장·마지막 반응 비용은 추가됩니다.`
            :'무료 모의 모드입니다. GPT·Typecast 유료 호출 없이 연결을 확인합니다.'}</Alert>
          <p><a href={`#/workspace/children/${id}/scenario-settings`}>AI 대화 설정 수정</a> · <a href={`#/workspace/children/${id}/daily-events`}>최근 경험 등록·수정</a></p>
          {r.data.day.canLaunch&&<Alert tone="success">오늘의 이야기가 준비됐습니다. <a href={`#/workspace/children/${id}/device`}>iPad 연결 코드 확인</a> 후 앱에서 시작하세요.</Alert>}
          <p><a href={`#/workspace/children/${id}/records?date=${r.data.day.localDate}`}>이 날짜의 학습 결과 확인</a></p>
          {selectedId&&selectedId!==r.data.day.jobId&&<Button variant="secondary" onClick={()=>{setSelection(null);setPreview(null);void refresh()}}>오늘 제작 상태로 돌아가기</Button>}
          <ActionForm label="하루 다섯 편 제작" disabled={!r.data.day.canGenerate||r.data.capabilities.engine!=='EF_ST_AGENT_DRAFT_V2_1'} confirmation={r.data.capabilities.generationMode==='LIVE'?'이 다섯 편의 실제 GPT 제작 비용이 발생함을 확인했습니다.':undefined} onRecover={refresh} onSuccess={raw=>{const next=parseJob(raw);setPreview(null);setError('');setSelection({jobId:next.jobId,localDate:r.data!.day.localDate});setJob(next);void refresh()}} prepare={data=>{
            const selected=data.getAll('eventIds').map(String)
            if(selected.length>5)throw new ApiFailure('INVALID_SCHEMA',422)
            return {path:`${childPath(id)}/agent-jobs`,method:'POST',expectedStatus:202,body:{schemaVersion:'EF_GENERATE_DAY_P1',programDay:r.data!.day.programDay,localDate:r.data!.day.localDate,
              expectedProfileVersion:r.data!.profile.baseProfileVersion,expectedScenarioProfileRevision:r.data!.profile.revision,expectedDailyEventRevision:r.data!.events.revision,dailyEventIds:selected,expectedGenerationMode:r.data!.capabilities.generationMode}}
          }}>
            <fieldset><legend>아동 답변에 참고할 경험 (선택, 최대 다섯 개)</legend>{r.data.events.items.length?r.data.events.items.map(e=><Checkbox key={e.eventId} name="eventIds" value={e.eventId} label={`${e.occurredOn} · ${e.text}`} />):<p>저장된 경험이 없습니다. 경험 없이도 제작할 수 있습니다.</p>}</fieldset>
            <p>기본 프로필·AI 대화 설정은 서버에서 가져옵니다. 최근 경험을 캐릭터의 경험으로 바꾸지 않습니다.</p>
          </ActionForm>
        </Card>
        {displayed&&<Card className="care-generation-status" title="제작 상태"><p role="status">{stateLabels[displayed.state]} · {displayed.mode==='MOCK'?'무료 모의 연결 확인':'실제 GPT 제작'}</p>
          {displayed.mode==='MOCK'&&<Alert>현재 원고는 연결 확인용 모의 자료입니다. 실제 GPT 품질 평가나 아동용 실음원은 아닙니다.</Alert>}
          {['QUEUED','RUNNING'].includes(displayed.state)&&<ActionForm label="제작 취소" confirmation="진행 중인 제작을 취소합니다. 이미 사용한 API 비용은 취소되지 않습니다." prepare={()=>({path:`${childPath(id)}/agent-jobs/${displayed.jobId}/cancel`,method:'POST',expectedStatus:200,body:{expectedVersion:displayed.version}})} onSuccess={raw=>{setJob(parseJob(raw));void r.reload()}} />}
          {['QUEUED','RUNNING'].includes(displayed.state)&&<ActionForm label="대기·진행 작업 이어받기" prepare={()=>({path:`${childPath(id)}/agent-jobs/${displayed.jobId}/dispatch`,method:'POST',expectedStatus:202,body:{}})} onSuccess={refresh} />}
          {displayed.state==='OUTCOME_UNKNOWN'&&<Alert>이전 요청의 실행 여부가 불명확합니다. 자동으로 다시 생성하지 않습니다.</Alert>}
          {displayed.state==='RESULT_READY'&&<a className="button button--primary" href={`#/workspace/children/${id}/review`}>콘텐츠 검토 화면</a>}
        </Card>}
        {previews.length > 0 && <div className="care-story-grid">{previews.map(story => <StoryPreviewCard key={story.slot} story={story} />)}</div>}
        {displayed?.state==='RESULT_READY'&&previews.length===5&&displayed.jobId===r.data.day.jobId&&<DayApprovalPanel key={displayed.jobId} id={id} jobId={displayed.jobId} onReady={reloadDay} />}
        {!!r.data.jobs.length&&<Card title="최근 제작 작업">{r.data.jobs.map(j=><p key={j.jobId}><Button variant="secondary" onClick={()=>{setPreview(null);setError('');setSelection({jobId:j.jobId,localDate:r.data!.day.localDate});setJob(j);setPollEpoch(v=>v+1)}}>{stateLabels[j.state]} · {j.jobId.slice(0,8)}</Button></p>)}</Card>}
      </>}</ResourceState>
    </div>
  </>
}
