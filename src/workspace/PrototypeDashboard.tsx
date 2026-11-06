import { useCallback, useState } from 'react'
import { Alert, Button, Card, EmptyState, TextField } from '../components/ui'
import { ResourceState } from './shared'
import { useResource } from './useResource'
import { loadPrototypeDay } from './prototypeDashboardData'

const goals:Record<string,string>={EMOTION_CONTEXT:'상황에서 감정 알아차리기',EMOTION_CAUSE:'감정의 이유 이해하기',SELF_FEELING:'내 마음 표현하기',SELF_CAUSE:'내 감정의 이유 말하기',DIFFERENT_FEELINGS:'서로 다른 마음 이해하기',SIMILAR_EMOTIONS:'비슷한 감정 구별하기',INTENSITY_MIXED:'감정의 세기·섞임 표현하기',THOUGHT_WISH:'내 생각·바람 표현하기'}
export function PrototypeDashboard({id,initialDate=''}:{id:string;initialDate?:string}) {
  const [date,setDate]=useState(initialDate)
  const load=useCallback((signal:AbortSignal)=>loadPrototypeDay(id,date,signal),[id,date]);const resource=useResource(load)
  const report=resource.data?.report
  return <Card title="날짜별 iPad 학습"><div className="row"><TextField label="학습 날짜 (비우면 서버 오늘)" type="date" value={date} onChange={e=>setDate(e.target.value)} /><Button variant="secondary" onClick={()=>void resource.reload()}>학습 결과 새로고침</Button></div>
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload}>
      {resource.data&&!report&&<EmptyState title={`${resource.data.day.localDate}에는 아직 준비된 학습이 없어요`} description="이 날짜의 완료·감정 관찰 기록은 아직 없습니다." action={<a className="button button--secondary" href={`#/workspace/children/${id}/agent`}>오늘 이야기 준비하기</a>} />}
      {report&&<div className="stack">
      <p>{report.localDate} · Day {report.programDay} · 완료 {report.completedCount}/5 · 별 {report.stars}/5</p>
      <ul>{report.slots.map(s=><li key={s.slot}>{s.slot}. {s.title} · {s.status==='COMPLETED'?'완료':s.status==='IN_PROGRESS'?'진행 중':'시작 전'}</li>)}</ul>
      <p>표현 방식: 내 원문 {report.expression.originalCount}회 · 카드 확장 {report.expression.aiComposedCount}회</p>
      <p>{report.recognition.validFirstResponses===null?'감정 문제 관찰이 아직 없습니다.':`도움 없이 처음 응답한 문제 ${report.recognition.validFirstResponses}회 중 일치 ${report.recognition.correctFirstResponses}회 · 다시 듣기 ${report.recognition.replayUsed}회`}</p>
      {report.nextTraining&&<p>다음 이야기 제작에 참고할 연습: {report.nextTraining.priorityGoals.map(g=>goals[g]??g).join(' · ')}. 완료한 경로의 관찰을 참고하며 보호자가 저장한 설정은 바꾸지 않습니다.</p>}
      {report.limitations.map((v,i)=><Alert key={i}>{v}</Alert>)}
      <a href={`#/workspace/children/${id}/agent`}>오늘 이야기 준비 상태 확인</a>
    </div>}</ResourceState></Card>
}
