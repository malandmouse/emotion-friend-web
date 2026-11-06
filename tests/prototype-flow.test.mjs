import assert from 'node:assert/strict'
import test from 'node:test'
import { isAgentCapabilities, isDayPreview, isDayRelease, isPrototypeDay } from '../src/workspace/prototypeContracts.ts'
import { pollResource } from '../src/workspace/pollResource.ts'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const jobId=id(1),childId=id(2),releaseId=id(3)
const preview={job:{jobId,state:'RESULT_READY',mode:'MOCK',version:3,publicationAllowed:false},dayDraftHash:'a'.repeat(64),
  summaryRefs:Array.from({length:5},(_,i)=>({slot:i+1,summaryId:id(10+i)})),
  webPreview:Array.from({length:5},(_,i)=>({slot:i+1,title:`이야기 ${i+1}`,summary:'가상의 요약',npcId:'JungHoon',place:'Class'}))}

test('pre-generation notice uses explicit server/worker mode and model metadata',()=>{
 const capability={schemaVersion:'EF_AGENT_CAPABILITIES_P1',childId,generationMode:'LIVE',engine:'EF_ST_AGENT_DRAFT_V2_1',modelRef:'synthetic-model',configurationRef:'fixture',sessionsPerDay:5,expectedGptCalls:41}
 assert.equal(isAgentCapabilities(capability,childId),true)
 assert.equal(isAgentCapabilities({...capability,generationMode:'OTHER'},childId),false)
 assert.equal(isAgentCapabilities({...capability,expectedGptCalls:1},childId),false)
 assert.equal(isAgentCapabilities(capability,id(9)),false)
})

test('five summaries must belong to the selected job before the confirmation form opens',()=>{
  assert.equal(isDayPreview(preview,jobId),true)
  assert.equal(isDayPreview(preview,id(9)),false)
  assert.equal(isDayPreview({...preview,webPreview:preview.webPreview.slice(0,4)},jobId),false)
  assert.equal(isDayPreview({...preview,summaryRefs:preview.summaryRefs.map(x=>({...x,summaryId:id(10)}))},jobId),false)
})
test('release lookup is bound to the same job and READY requires all media',()=>{
  const release={releaseId,jobId,revision:2,state:'READY',planId:id(4),error:null,mediaProgress:{totalSentences:70,readySentences:70,failedAssetIds:[]}}
  assert.equal(isDayRelease(release,jobId,releaseId),true)
  assert.equal(isDayRelease(release,id(9),releaseId),false)
  assert.equal(isDayRelease(release,jobId,id(9)),false)
  assert.equal(isDayRelease({...release,mediaProgress:{...release.mediaProgress,readySentences:69}},jobId),false)
})
test('day status keeps server calendar and child identity, including a not-prepared day',()=>{
  const day={schemaVersion:'EF_DAY_STATUS_P1',childId,localDate:'2026-11-07',timezone:'Asia/Seoul',programDay:1,state:'NOT_PREPARED',jobId:null,releaseId:null,planId:null,completedCount:0,totalCount:5,canGenerate:true,canLaunch:false}
  assert.equal(isPrototypeDay(day,childId),true)
  assert.equal(isPrototypeDay(day,id(9)),false)
  assert.equal(isPrototypeDay({...day,totalCount:4},childId),false)
})
test('status polling follows a task to completion and stops without new work',async()=>{
  const values=['QUEUED','RUNNING','RESULT_READY'],received=[];let calls=0
  await pollResource({signal:new AbortController().signal,interval:0,read:async()=>values[calls++],receive:v=>received.push(v),pending:v=>v!=='RESULT_READY'})
  assert.equal(calls,3);assert.deepEqual(received,values)
})
test('a failed lookup stops; explicit same-task lookup can resume after connectivity returns',async()=>{
  let reads=0;const received=[],options={signal:new AbortController().signal,interval:0,
    read:async()=>{reads++;if(reads===1)throw Error('synthetic offline');return 'RESULT_READY'},receive:v=>received.push(v),pending:()=>false}
  await assert.rejects(pollResource(options),/synthetic offline/)
  assert.equal(reads,1);assert.deepEqual(received,[])
  await pollResource(options);assert.equal(reads,2);assert.deepEqual(received,['RESULT_READY'])
})
test('a delayed response from a previous page or child cannot update the current task',async()=>{
  const abort=new AbortController(),received=[];let finish
  const read=new Promise(resolve=>{finish=resolve})
  const task=pollResource({signal:abort.signal,read:()=>read,receive:v=>received.push(v),pending:()=>false})
  abort.abort();finish('old task');await task
  assert.deepEqual(received,[])
})
