// 목록 API는 작업 식별/상태만 반환합니다. 상세 API의 발행 관련 필드를
// 목록에 요구하지 않고, 단일 작업 응답에서는 기존 조건을 계속 확인합니다.
export interface AgentJobSummary {
  jobId: string
  state: string
  version: number
  mode: 'MOCK' | 'LIVE'
  paidCalls?: number
}

export interface AgentJobDetail extends AgentJobSummary {
  publicationAllowed: false
}

const states = ['QUEUED', 'RUNNING', 'RESULT_READY', 'HELD', 'FAILED', 'CANCELLED', 'OUTCOME_UNKNOWN']
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isAgentJobSummary(raw: unknown): raw is AgentJobSummary {
  return isRecord(raw)
    && typeof raw.jobId === 'string' && /^[0-9a-f-]{36}$/i.test(raw.jobId)
    && typeof raw.state === 'string' && states.includes(raw.state)
    && Number.isSafeInteger(raw.version) && Number(raw.version) >= 1
    && (raw.mode === 'MOCK' || raw.mode === 'LIVE')
    && (raw.paidCalls === undefined || (Number.isSafeInteger(raw.paidCalls) && Number(raw.paidCalls) >= 0))
    && (raw.publicationAllowed === undefined || raw.publicationAllowed === false)
}

export function isAgentJobDetail(raw: unknown): raw is AgentJobDetail {
  return isAgentJobSummary(raw) && 'publicationAllowed' in raw && raw.publicationAllowed === false
}

export function isAgentJobList(raw: unknown): raw is { items: AgentJobSummary[] } {
  return isRecord(raw) && Array.isArray(raw.items) && raw.items.every(isAgentJobSummary)
}
