import assert from 'node:assert/strict'
import test from 'node:test'
import { isAgentJobDetail, isAgentJobList } from '../src/workspace/agentJobContracts.ts'

// AgentJobService.list()의 SELECT가 반환하는 실제 필드 구성입니다.
// 목록에 작업이 없을 때만 우연히 통과하던 기존 오류를 재현합니다.
const listedJob = {
  jobId: 'f4478a95-53e8-43f0-a470-e4031848941c', state: 'RESULT_READY',
  version: 3, deadline: '2026-11-05T08:00:00Z', mode: 'MOCK',
}

test('accepts a populated server job list without detail-only publication fields', () => {
  assert.equal(isAgentJobList({ items: [listedJob] }), true)
  assert.equal(isAgentJobList({ items: [] }), true)
})

test('detail still requires publicationAllowed=false', () => {
  assert.equal(isAgentJobDetail(listedJob), false)
  assert.equal(isAgentJobDetail({ ...listedJob, publicationAllowed: false, paidCalls: 0 }), true)
  assert.equal(isAgentJobDetail({ ...listedJob, publicationAllowed: true }), false)
})

test('rejects malformed list entries and envelopes', () => {
  for (const raw of [null, [], { items: null }, { items: [null] },
    { items: [{ ...listedJob, jobId: 'other-child' }] },
    { items: [{ ...listedJob, state: 'UNRECOGNIZED' }] },
    { items: [{ ...listedJob, version: 0 }] },
    { items: [{ ...listedJob, mode: 'UNRECOGNIZED' }] },
    { items: [{ ...listedJob, publicationAllowed: true }] }]) {
    assert.equal(isAgentJobList(raw), false)
  }
})
