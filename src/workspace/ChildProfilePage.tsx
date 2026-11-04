import { useCallback, useState } from 'react'
import type { Member } from '../auth/contracts'
import { Alert, Button, Card, PageHeader } from '../components/ui'
import { loadProfile } from './api'
import { object, uuid } from './contracts'
import type { Profile } from './contracts'
import { useResource } from './useResource'
import { ActionDialog } from './ActionDialog'
import { ProfileForm } from './ProfileForm'
import { Capabilities, ResourceState } from './shared'

export function NewChildPage() {
  return <><PageHeader title="아동 등록" description="학습에 필요한 정보와 보호 관계를 확인해 주세요." /><ProfileForm onSuccess={(raw) => { const result = object<Profile>(raw); uuid(result.childId); window.location.hash = `/workspace/children/${result.childId}/consents` }} /></>
}

export function ChildProfilePage({ id, member }: { id: string; member: Member }) {
  const load = useCallback((signal: AbortSignal) => loadProfile(id, signal), [id])
  const resource = useResource(load)
  const [notice, setNotice] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const canEdit = member.role === 'GUARDIAN' && resource.data?.child.capabilities.includes('EDIT_PROFILE')
  const profile = resource.data?.profile
  return <>
    <PageHeader title={!resource.loading && resource.data ? `${resource.data.child.pseudonym}의 프로필` : '아동 프로필'} description="현재 아동의 프로필과 부여된 권한을 확인합니다." action={<Button variant="secondary" loading={resource.loading} onClick={() => void resource.reload()}>최신 프로필 확인</Button>} />
    {notice && <div className="section-notice"><Alert tone="success">프로필을 저장했습니다.</Alert></div>}
    <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload}>
      {resource.data && profile && <div className="stack"><Capabilities values={resource.data.child.capabilities} />
        {canEdit ? <ProfileForm key={`${id}:${profile.profileVersion}`} childId={id} profile={profile} pseudonym={resource.data.child.pseudonym} onRecover={resource.reload} onSuccess={async () => { setNotice(true); await resource.reload() }} /> : <>
          <Alert>프로필 보기 권한만 있습니다. 변경은 관리 보호자가 진행합니다.</Alert>
          <Card title="기본 정보"><dl className="detail-grid"><div><dt>아동 가명</dt><dd>{resource.data.child.pseudonym}</dd></div><div><dt>학습 아동 성별</dt><dd>{profile.gender === 'BOY' ? '남아' : '여아'}</dd></div><div><dt>연령 구간</dt><dd>{profile.ageBand === 'ELEMENTARY_MIDDLE' ? '초등 중학년' : '8~13세'}</dd></div><div><dt>언어</dt><dd>한국어</dd></div></dl></Card>
          <Card title="도움 정보"><dl className="detail-grid"><div><dt>이해 도움</dt><dd>확인 필요</dd></div><div><dt>감정 이해 도움</dt><dd>{profile.recognitionSupport === 'WITH_PICTURES' ? '그림과 함께' : '확인 필요'}</dd></div><div><dt>표현 도움</dt><dd>{profile.expressiveSupport === 'SHORT_SENTENCES' ? '짧은 문장으로' : '확인 필요'}</dd></div><div><dt>사용할 수 있는 방식</dt><dd>{profile.communicationModes.map((value) => ({ UNKNOWN: '확인 필요', SPEECH: '말하기', TEXT_EDIT: '글로 수정', EXPRESSION_CARDS: '표현 카드' })[value] ?? value).join(' · ')}</dd></div><div><dt>도움 선호</dt><dd>{profile.supportPreferences.map((value) => value === 'DEFAULT' ? '기본 도움' : value === 'UNKNOWN' ? '확인 필요' : value).join(' · ')}</dd></div></dl><details className="optional-fields"><summary>추가 정보 보기</summary>{[['interests', '관심사'], ['preferredActivities', '선호 활동'], ['sensoryPreferences', '감각 선호'], ['avoidTopics', '피할 소재']].map(([key, label]) => <p key={key}><strong>{label}</strong> {(profile[key as 'interests'] ?? []).join(' · ') || '등록된 정보 없음'}</p>)}</details></Card>
        </>}
        {member.role === 'THERAPIST' && <Card title="내 치료사 연결 종료"><p className="muted">연결을 종료하면 이 아동의 프로필과 기록을 조회할 수 없습니다.</p><div className="form-actions"><Button variant="secondary" onClick={() => setDisconnectOpen(true)}>연결 종료 내용 확인</Button></div></Card>}
        {member.role === 'THERAPIST' && disconnectOpen && <ActionDialog title={`${resource.data.child.pseudonym} · 내 치료사 연결 종료`} onClose={() => setDisconnectOpen(false)} intro={<Alert tone="warning">연결을 종료하면 이 아동의 프로필과 기록을 조회할 수 없습니다. 다시 연결하려면 보호자의 초대가 필요합니다.</Alert>} label="내 연결 종료" danger confirmation="연결을 종료하면 이 아동의 프로필과 기록을 조회할 수 없음을 확인했습니다." prepare={() => ({ path: `/children/${id}/therapists/${member.id}`, method: 'DELETE', expectedStatus: 204 })} onSuccess={() => { window.location.hash = '/workspace/children' }} onRecover={async () => { setDisconnectOpen(false); await resource.reload() }} />}
      </div>}
    </ResourceState>
  </>
}
