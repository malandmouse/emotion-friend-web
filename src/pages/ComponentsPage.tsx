import { useState } from 'react'
import { Alert, Badge, Button, Card, Checkbox, EmptyState, ErrorState, Icon, LoadingState, Modal, PageHeader, SelectField, Skeleton, TextArea, TextField } from '../components/ui'
import { usePreviewAction } from '../hooks/usePreviewAction'

export function ComponentsPage() {
  const [buttonDone, setButtonDone] = useState(false)
  const [state, setState] = useState<'error' | 'loading' | 'ready'>('error')
  const [modalOpen, setModalOpen] = useState(false)
  const { pending, run } = usePreviewAction()
  const retry = usePreviewAction()
  return <div className="showcase">
    <PageHeader title="공통 컴포넌트" description="레이아웃, 입력, 버튼과 화면 상태를 한곳에서 확인하세요." />
    <div className="showcase-note"><Alert>Clinical Light · FINAL 02 기준의 UI 미리보기입니다. 실제 서버 요청은 실행하지 않습니다.</Alert></div>
    <div className="stack">
      <Card title="내용 확인 팝업" description="동의 선택, 회원 승인과 연결 변경에 사용하는 공통 확인창입니다.">
        <Button variant="secondary" onClick={() => setModalOpen(true)}>확인창 미리보기</Button>
        {modalOpen && <Modal title="내용 확인" onClose={() => setModalOpen(false)}><div className="stack"><Alert>안내를 확인하고 선택한 작업을 진행합니다.</Alert><p>목적별 동의와 회원 승인 등 확인이 필요한 작업은 이 창에서 진행합니다.</p><div className="row"><Button variant="secondary" onClick={() => setModalOpen(false)}>취소</Button><Button onClick={() => setModalOpen(false)}>확인</Button></div></div></Modal>}
      </Card>
      <Card title="버튼" description="기본 · 보조 · 텍스트 · 위험 동작 · 비활성 · 처리 중">
        <div className="row"><Button loading={pending} loadingLabel="확인 중" onClick={() => { setButtonDone(false); run(() => setButtonDone(true)) }}>동작 확인</Button><Button variant="secondary" onClick={() => { setButtonDone(false); run(() => setButtonDone(true)) }} disabled={pending}>보조 동작 확인</Button><a className="button button--ghost" href="#/overview">개요 보기<Icon name="arrow" size={16} /></a><Button variant="danger" onClick={() => { setButtonDone(false); run(() => setButtonDone(true)) }} disabled={pending}>위험 동작 예시</Button><Button disabled>사용할 수 없음</Button><Button loading loadingLabel="처리 중">처리 중</Button></div>
        <div className="form-feedback" role="status">{buttonDone && '미리보기 동작을 마쳤어요. 서버 요청은 실행하지 않았습니다.'}</div>
      </Card>
      <Card title="입력창" description="라벨과 안내 · 필수 입력 · 오류 · 읽기 전용 · 비활성">
        <div className="form-grid"><TextField label="아동 가명" placeholder="가명을 입력해 주세요" hint="학습 화면에 표시할 이름이에요." required /><TextField label="이메일 주소" type="email" defaultValue="sample@" error="올바른 이메일 주소를 입력해 주세요." /><SelectField label="학습 아동 성별" required defaultValue=""><option value="">선택해 주세요</option><option value="female">여아</option><option value="male">남아</option></SelectField><TextField label="읽기 전용" readOnly value="보호자가 등록한 정보를 확인합니다" /><TextField label="비활성 입력" disabled placeholder="수정 권한이 없어요" /><TextArea label="추가 안내" placeholder="필요한 내용을 적어 주세요" hint="선택 입력 항목입니다." /></div><div className="form-actions row"><Checkbox label="안내 내용을 확인했어요" /><Checkbox disabled label="선택할 수 없는 항목" /></div>
      </Card>
      <Card title="안내와 상태 표시"><div className="stack"><Alert title="안내">화면을 닫아도 진행 중인 작업은 계속됩니다.</Alert><Alert tone="success" title="입력 확인 완료">입력한 항목의 형식을 확인했어요.</Alert><Alert tone="warning" title="확인이 필요해요">선택하지 않은 필수 항목을 확인해 주세요.</Alert><Alert tone="error" title="요청을 처리하지 못했어요" action={<Button size="sm" variant="secondary" onClick={() => { setState('loading'); retry.run(() => setState('ready')) }} disabled={retry.pending}>재시도 예시</Button>}>입력한 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.</Alert><div className="row"><Badge>미선택</Badge><Badge tone="info">처리 중</Badge><Badge tone="success">확인 완료</Badge><Badge tone="warning">검토 대기</Badge><Badge tone="error">실패</Badge></div></div></Card>
      <div className="showcase-grid"><Card title="로딩 표시"><LoadingState /><Skeleton /></Card><Card title="오류와 재시도">{state === 'error' ? <ErrorState action={<Button variant="secondary" onClick={() => { setState('loading'); retry.run(() => setState('ready')) }}>다시 시도</Button>} /> : state === 'loading' ? <LoadingState /> : <div className="stack"><Alert tone="success">재시도 미리보기를 마쳤어요.</Alert><Button variant="secondary" onClick={() => setState('error')}>오류 상태 다시 보기</Button></div>}</Card></div>
      <Card title="빈 상태"><EmptyState title="아직 정규 학습 기록이 없어요" description="기록이 없는 상태는 0점이 아닙니다. 정규 학습을 완료하면 활동이 표시됩니다." action={<a className="button button--secondary" href="#/overview">개요로 돌아가기</a>} /></Card>
    </div>
  </div>
}
