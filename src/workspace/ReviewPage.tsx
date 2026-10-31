import { useCallback, useState } from 'react'
import { ApiFailure } from '../api/client'
import { Alert, Badge, Button, Card, Checkbox, EmptyState, PageHeader, SelectField } from '../components/ui'
import { ActionDialog } from './ActionDialog'
import { workspaceError } from './contracts'
import { childPath } from './api'
import { loadMaterials, materialLabels, needsLearningReload, parseMaterialConfirmation } from './learning'
import type { MaterialStatus } from './learning'
import { ResourceState } from './shared'
import { useResource } from './useResource'

export function ReviewPage({ id }: { id: string }) {
  const [filter, setFilter] = useState<MaterialStatus | ''>('')
  const [cursor, setCursor] = useState<string>()
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [formVersion, setFormVersion] = useState(0)
  const [reviewOpen, setReviewOpen] = useState(false)
  const load = useCallback(() => loadMaterials(id, cursor, filter || undefined), [id, cursor, filter])
  const resource = useResource(load)
  const visibleSelection = selected.filter((summaryId) => resource.data?.items.some((item) => item.summaryId === summaryId))
  async function reset() { setReviewOpen(false); setSelected([]); setFormVersion((value) => value + 1); await resource.reload() }
  return <>
    <PageHeader title={resource.data ? `${resource.data.child.pseudonym}의 콘텐츠 검토` : '콘텐츠 검토'} description="생성된 주제와 요약을 읽고 확인하거나 보류해 주세요." action={<Button variant="secondary" loading={resource.loading} onClick={() => void reset()}>목록 새로고침</Button>} />
    <div className="stack">
      <Alert>이 화면에서는 주제·요약만 확인합니다. 확인 완료는 전체 원고·모든 분기·음성·동작의 검수나 아동용 콘텐츠 발행을 뜻하지 않습니다.</Alert>
      {message && <Alert tone="success">{message}</Alert>}
      {failure && <Alert tone="error">{failure}</Alert>}
      <div className="filter-bar"><SelectField label="검토 상태" value={filter} onChange={(event) => { setFilter(event.target.value as MaterialStatus | ''); setCursor(undefined); setSelected([]); setMessage(''); setFormVersion((value) => value + 1) }}><option value="">검토 대기 (미확인·보류)</option><option value="UNCONFIRMED">미확인</option><option value="ON_HOLD">보류</option><option value="CONFIRMED">확인 완료</option></SelectField></div>
      <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload}>
        {resource.data && <>
          {resource.data.items.length === 0 ? <Card><EmptyState title="해당 상태의 콘텐츠가 없어요" description="생성 자료가 연결되면 주제와 요약을 여기에서 검토할 수 있어요. 상태 필터를 바꾸어 이전 검토도 확인할 수 있습니다." /></Card> : <Card title="주제·요약 검토" description="한 번에 1~5개를 선택해 같은 검토 결과를 적용할 수 있어요.">
              <div className="stack">{resource.data.items.map((item) => <article className="review-item" key={item.summaryId}>
                <div className="management-row"><Checkbox label={<strong>{item.subject}</strong>} checked={visibleSelection.includes(item.summaryId)} disabled={!visibleSelection.includes(item.summaryId) && visibleSelection.length >= 5} onChange={(event) => setSelected(event.target.checked ? [...visibleSelection, item.summaryId] : visibleSelection.filter((value) => value !== item.summaryId))} /><Badge tone={item.status === 'CONFIRMED' ? 'success' : item.status === 'ON_HOLD' ? 'warning' : 'neutral'}>{materialLabels[item.status]}</Badge></div>
                <p className="material-summary">{item.summary}</p>
              </article>)}</div>
              <p role="status">선택 {visibleSelection.length} / 5개</p>
              <div className="form-actions"><Button disabled={resource.loading || visibleSelection.length === 0} onClick={() => setReviewOpen(true)}>선택한 요약 검토하기</Button></div>
          </Card>}
          {reviewOpen && <ActionDialog key={formVersion} title="선택한 주제·요약 검토" onClose={() => setReviewOpen(false)} intro={<div className="stack"><Alert>선택한 주제·요약 {visibleSelection.length}개의 검토 결과를 적용합니다. 전체 콘텐츠 발행은 별도입니다.</Alert>{resource.data.items.filter((item) => visibleSelection.includes(item.summaryId)).map((item) => <article className="review-item" key={item.summaryId}><strong>{item.subject}</strong><p className="material-summary">{item.summary}</p></article>)}</div>} label="선택한 요약에 적용" disabled={resource.loading} prepare={(data) => {
              if (visibleSelection.length < 1 || visibleSelection.length > 5) throw new ApiFailure('REVIEW_SELECTION_REQUIRED', 422)
              return { path: `${childPath(id)}/learning-material-confirmations`, method: 'POST', expectedStatus: 200, body: { summaryIds: visibleSelection, decision: data.get('decision') } }
            }} onSuccess={async (raw) => { parseMaterialConfirmation(raw, id); setFailure(''); setMessage('선택한 주제·요약의 검토 결과를 저장했습니다.'); await reset() }} onRecover={reset} onFailure={async (error) => { if (needsLearningReload(error)) { setFailure(workspaceError(error)); await reset() } }}>
              <SelectField label="검토 결과" name="decision" defaultValue="" required><option value="">선택해 주세요</option><option value="CONFIRM">확인 완료</option><option value="HOLD">보류</option></SelectField>
              <Checkbox name="reviewed" required label="선택한 주제·요약을 읽고 검토 결과를 확인했습니다." />
          </ActionDialog>}
          <div className="row">{cursor && <Button variant="secondary" onClick={() => { setCursor(undefined); setSelected([]); setFormVersion((value) => value + 1) }}>처음 목록</Button>}{resource.data.nextCursor && <Button variant="secondary" onClick={() => { setCursor(resource.data!.nextCursor!); setSelected([]); setFormVersion((value) => value + 1) }}>다음 목록</Button>}</div>
        </>}
      </ResourceState>
    </div>
  </>
}
