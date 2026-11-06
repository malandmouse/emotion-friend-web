import { useCallback, useEffect, useState } from 'react'
import { authenticatedApi } from '../auth/session'
import { ApiFailure } from '../api/client'
import { Alert, Button, Card, Checkbox, SelectField } from '../components/ui'
import { childPath } from './api'
import { workspaceError } from './contracts'
import { useResource } from './useResource'
import { ResourceState } from './shared'
import { ActionForm } from './ActionForm'
import { isDayPreview, isDayRelease, isPrototypeDay } from './prototypeContracts'
import type { DayRelease } from './prototypeContracts'
import { pollResource } from './pollResource'

export function DayApprovalPanel({ id, jobId, onReady }: { id: string; jobId: string; onReady?: () => Promise<void> }) {
  const [release,setRelease]=useState<DayRelease|null>(null),[error,setError]=useState(''),[pollEpoch,setPollEpoch]=useState(0)
  const load=useCallback(async(signal:AbortSignal)=>{
    const [p,d]=await Promise.all([authenticatedApi(`${childPath(id)}/agent-jobs/${jobId}/summaries`,{signal}),authenticatedApi(`${childPath(id)}/day-status`,{signal})])
    if(!isPrototypeDay(d,id)||!isDayPreview(p,jobId))throw new ApiFailure('INVALID_RESPONSE')
    return {preview:p,releaseId:d.jobId===jobId?d.releaseId:null}
  },[id,jobId])
  const r=useResource(load),releaseId=release?.releaseId??r.data?.releaseId
  const refresh=async()=>{setError('');setPollEpoch(v=>v+1);await r.reload()}
  const changed=async(raw:unknown)=>{
    if(!isDayRelease(raw,jobId))throw new ApiFailure('INVALID_RESPONSE')
    setRelease(raw);setPollEpoch(v=>v+1);await r.reload()
  }
  useEffect(()=>{
    if(!releaseId)return
    const controller=new AbortController()
    void pollResource({signal:controller.signal,read:async()=>{
      const raw=await authenticatedApi(`${childPath(id)}/day-releases/${releaseId}`,{signal:controller.signal})
      if(!isDayRelease(raw,jobId,releaseId))throw new ApiFailure('INVALID_RESPONSE')
      return raw
    },receive:async next=>{setRelease(next);if(next.state==='READY')await onReady?.()},
    pending:next=>['CONFIRMED_MEDIA_PENDING','MEDIA_RUNNING'].includes(next.state)
    }).catch(failure=>{if(!controller.signal.aborted)setError(workspaceError(failure))})
    return()=>controller.abort()
  },[id,jobId,releaseId,pollEpoch,onReady])
  return <Card className="care-approval-card" title="이 다섯 편 확인"><ResourceState loading={r.loading} error={r.error} retry={refresh}>{r.data&&<div className="stack">
    <p>위의 다섯 주제·요약을 읽고 오늘 사용할 이야기인지 확인해 주세요.</p>
    {((!releaseId&&!release)||release?.state==='HELD')&&<ActionForm label="다섯 편에 대한 선택 저장" onRecover={refresh} onSuccess={changed} prepare={data=>({
      path:`${childPath(id)}/agent-jobs/${jobId}/day-decision`,method:'POST',expectedStatus:202,
      body:{expectedJobVersion:r.data!.preview.job.version,dayDraftHash:r.data!.preview.dayDraftHash,summaryIds:r.data!.preview.summaryRefs.map(s=>s.summaryId),decision:data.get('decision'),childUseAllowed:data.get('childUseAllowed')==='on'},
    })}>
      <SelectField label="검토 결과" name="decision" defaultValue="CONFIRM"><option value="CONFIRM">이 다섯 편으로 확정</option><option value="HOLD">보류</option></SelectField>
      <Checkbox name="childUseAllowed" label="이 다섯 편을 아동의 학습에 사용하는 데 동의합니다." />
      <p>확정하면 문장별 음원 준비와 발행이 이어집니다. 실제 제작 모드에서는 Typecast 사용료가 발생합니다. 전체 대본을 검수했다고 기록하지 않습니다.</p>
    </ActionForm>}
    {releaseId&&!release&&<p role="status">저장된 발행 상태를 확인하고 있어요.</p>}
    <Button variant="secondary" loading={r.loading} onClick={()=>void refresh()}>음원·발행 최신 상태 확인</Button>
    {release&&<><p role="status">발행 상태: {release.state} · 음원 {release.mediaProgress.readySentences}/{release.mediaProgress.totalSentences}</p>
      {release.error&&<Alert tone="warning">{release.error.message}</Alert>}
      {release.state==='READY'&&<Alert tone="success">다섯 편의 학습 준비가 완료됐습니다. iPad 앱에서 오늘의 이야기를 시작하세요. 처음 연결할 때는 <a href={`#/workspace/children/${id}/device`}>Unity 앱 연결</a>에서 코드를 받으세요.</Alert>}
      {release.state==='MEDIA_FAILED'&&release.mediaProgress.failedAssetIds.length>0&&<ActionForm label="확인된 실패 문장만 다시 준비" confirmation="실패가 확인된 문장만 다시 요청합니다. 실제 모드에서는 비용이 발생할 수 있습니다." prepare={()=>({path:`${childPath(id)}/day-releases/${release.releaseId}/retry-media`,method:'POST',expectedStatus:202,body:{expectedVersion:release.revision,failedAssetIds:release.mediaProgress.failedAssetIds}})} onRecover={refresh} onSuccess={changed} />}
      {release.state==='MEDIA_FAILED'&&release.mediaProgress.totalSentences>0&&release.mediaProgress.readySentences===release.mediaProgress.totalSentences&&<ActionForm label="준비된 음원으로 발행만 다시 연결" prepare={()=>({path:`${childPath(id)}/day-releases/${release.releaseId}/retry-publication`,method:'POST',expectedStatus:202,body:{expectedVersion:release.revision}})} onRecover={refresh} onSuccess={changed} />}
      {release.state==='OUTCOME_UNKNOWN' &&<Alert>음성 요청의 실행 여부가 불명확해 멈췄습니다. 성공한 음원과 예약을 보존하며 자동 재호출하지 않습니다.</Alert>}
    </>}
    {error&&<Alert tone="error">{error}</Alert>}
  </div>}</ResourceState></Card>
}
