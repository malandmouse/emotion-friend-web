import { isAgentJobDetail } from './agentJobContracts.ts'
import type { AgentJobDetail } from './agentJobContracts.ts'

export interface PrototypeDay {
  localDate: string; programDay: number | null; state: string; jobId: string | null
  releaseId: string | null; planId: string | null; completedCount: number; canGenerate: boolean; canLaunch: boolean
}
export interface AgentCapabilities {
  generationMode: 'MOCK' | 'LIVE'; engine: string; modelRef: string; configurationRef: string; expectedGptCalls: number
}
export interface DayPreviewItem { slot: number; title: string; summary: string; npcId: string; place: string }
export interface DayPreview {
  job: AgentJobDetail; summaryRefs: { slot: number; summaryId: string }[]; dayDraftHash: string; webPreview: DayPreviewItem[]
}
export interface DayRelease {
  releaseId: string; jobId: string; revision: number; state: string; planId: string | null
  error: { message: string } | null
  mediaProgress: { totalSentences: number; readySentences: number; failedAssetIds: string[] }
}
function record(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v) }
function uuid(v: unknown): v is string { return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) }
function integer(v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number { return Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max }
function text(v: unknown): v is string { return typeof v === 'string' && v.trim().length > 0 }

export function isAgentCapabilities(v: unknown, childId: string): v is AgentCapabilities {
  return record(v) && v.schemaVersion === 'EF_AGENT_CAPABILITIES_P1' && v.childId === childId
    && ['MOCK','LIVE'].includes(String(v.generationMode))
    && ['EF_ST_AGENT_DRAFT_V2_1','EF_FOUNDATION_AGENT_1'].includes(String(v.engine))
    && text(v.modelRef) && text(v.configurationRef) && v.sessionsPerDay === 5
    && v.expectedGptCalls === (v.engine === 'EF_ST_AGENT_DRAFT_V2_1' ? 41 : 0)
}

export function isPrototypeDay(v: unknown, childId: string): v is PrototypeDay {
  return record(v) && v.schemaVersion === 'EF_DAY_STATUS_P1' && v.childId === childId && v.timezone === 'Asia/Seoul'
    && typeof v.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.localDate)
    && (v.programDay === null || integer(v.programDay, 1, 30))
    && typeof v.state === 'string' && ['NOT_PREPARED','GENERATING','PENDING_APPROVAL','MEDIA_PREPARING','READY','IN_PROGRESS','COMPLETED'].includes(v.state)
    && [v.jobId,v.releaseId,v.planId].every(x => x === null || uuid(x))
    && integer(v.completedCount,0,5) && v.totalCount === 5 && typeof v.canGenerate === 'boolean' && typeof v.canLaunch === 'boolean'
}

export function isDayPreview(v: unknown, jobId: string): v is DayPreview {
  return record(v) && isAgentJobDetail(v.job) && v.job.jobId === jobId && v.job.state === 'RESULT_READY'
    && typeof v.dayDraftHash === 'string' && /^[0-9a-f]{64}$/.test(v.dayDraftHash)
    && Array.isArray(v.summaryRefs) && v.summaryRefs.length === 5
    && v.summaryRefs.every((x,i) => record(x) && x.slot === i+1 && uuid(x.summaryId))
    && new Set(v.summaryRefs.map(x => x.summaryId)).size === 5
    && Array.isArray(v.webPreview) && v.webPreview.length === 5
    && v.webPreview.every((x,i) => record(x) && x.slot === i+1 && text(x.title) && text(x.summary)
      && ['JungHoon','MainPlayer'].includes(String(x.npcId)) && text(x.place))
}

export function isDayRelease(v: unknown, jobId: string, releaseId?: string): v is DayRelease {
  if (!record(v) || !uuid(v.releaseId) || v.jobId !== jobId || (releaseId && v.releaseId !== releaseId)
    || !integer(v.revision,1) || typeof v.state !== 'string'
    || !['HELD','CONFIRMED_MEDIA_PENDING','MEDIA_RUNNING','READY','MEDIA_FAILED','OUTCOME_UNKNOWN'].includes(v.state)
    || !(v.planId === null || uuid(v.planId)) || !(v.error === null || (record(v.error) && text(v.error.message)))
    || !record(v.mediaProgress)) return false
  const m = v.mediaProgress
  return integer(m.totalSentences,0) && integer(m.readySentences,0,Number(m.totalSentences))
    && Array.isArray(m.failedAssetIds) && m.failedAssetIds.every(uuid)
    && (v.state !== 'READY' || (uuid(v.planId) && m.totalSentences > 0 && m.readySentences === m.totalSentences))
}
