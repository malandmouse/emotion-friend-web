import { useCallback, useState } from 'react'
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui'
import type { Member } from '../auth/contracts'
import { listChildren } from './api'
import { Capabilities, ResourceState } from './shared'
import { useResource } from './useResource'

export function ChildrenPage({ member }: { member: Member }) {
  const [cursor, setCursor] = useState<string | undefined>()
  const load = useCallback((signal: AbortSignal) => listChildren(cursor, signal), [cursor])
  const resource = useResource(load)
  const guardian = member.role === 'GUARDIAN'
  return <>
    <PageHeader title={guardian ? '학습 아동 선택' : '연결된 아동 선택'} description={guardian ? '등록한 아동과 현재 사용할 수 있는 기능을 확인해 주세요.' : '담당 아동과 부여된 권한만 표시합니다.'} action={<div className="row"><Button variant="secondary" loading={resource.loading} onClick={() => void resource.reload()}>목록 새로고침</Button>{guardian && <a className="button button--primary" href="#/workspace/children/new">아동 등록하기</a>}</div>} />
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload}>
      {resource.data && <div className="stack">
        {resource.data.items.length === 0 ? <Card><EmptyState title={guardian ? '등록된 아동이 없어요' : '현재 연결된 아동이 없어요'} description={guardian ? '아동 프로필을 등록한 뒤 목적별 동의와 치료사 연결을 진행할 수 있어요.' : '보호자의 초대를 수락하고 기본 프로필·학습 동의가 유지되면 아동을 확인할 수 있어요.'} action={guardian ? <a className="button button--primary" href="#/workspace/children/new">첫 아동 등록</a> : <a className="button button--secondary" href="#/workspace/invitations">받은 초대 확인</a>} /></Card> : resource.data.items.map((child) => <Card key={child.childId} title={child.pseudonym} action={<Badge>{guardian ? '관리 보호자' : '담당 치료사'}</Badge>}>
          <Capabilities values={child.capabilities} />
          {child.capabilities.includes('VIEW_SUMMARY') && <div className="row form-actions"><a className="button button--secondary" href={`#/workspace/children/${child.childId}/review`}>콘텐츠 검토</a><a className="button button--secondary" href={`#/workspace/children/${child.childId}/sessions`}>학습 세션</a><a className="button button--secondary" href={`#/workspace/children/${child.childId}/records`}>학습 결과·기록</a></div>}
          <div className="row form-actions"><a className="button button--primary" href={`#/workspace/children/${child.childId}/profile`}>이 아동 선택</a>{child.capabilities.includes('MANAGE') && <><a className="button button--secondary" href={`#/workspace/children/${child.childId}/consents`}>동의 관리</a><a className="button button--secondary" href={`#/workspace/children/${child.childId}/connections`}>치료사 연결</a></>}</div>
        </Card>)}
        <div className="row">{cursor && <Button variant="secondary" onClick={() => setCursor(undefined)}>처음 목록</Button>}{resource.data.nextCursor && <Button variant="secondary" onClick={() => setCursor(resource.data!.nextCursor!)}>다음 목록</Button>}</div>
      </div>}
    </ResourceState>
  </>
}
