import { Card, PageHeader, Spinner } from '../components/ui'

export function OverviewPage() {
  return <>
    <PageHeader title="별이의 오늘" description="오늘의 학습 준비와 진행을 한눈에 확인하세요." />
    <div className="stack">
      <Card title="오늘의 학습">
        <dl className="metrics"><div className="metric"><dt>완료한 이야기</dt><dd>2 / 5</dd></div><div className="metric"><dt>사용 가능한 이야기</dt><dd>7개</dd></div><div className="metric"><dt>이야기 연결 확인</dt><dd>5 / 5</dd></div></dl>
        <div className="row overview-actions"><a className="button button--primary" href="#/plan">오늘 계획 보기</a><a className="button button--secondary" href="#/settings">아동 기기 관리</a></div>
      </Card>
      <Card title="확인이 필요한 일">
        <div className="task-row"><span>새 이야기 2개</span><span className="task-status">검토 대기</span><a href="#/review">콘텐츠 검토로</a></div>
        <div className="task-row"><span>다음 학습 생성</span><span className="task-status"><Spinner />처리 중</span><a href="#/create">작업 상태 보기</a></div>
      </Card>
      <Card title="최근 학습 기록" className="record-card"><p className="record-summary">이번 주 완료한 이야기 8개 · 도움을 사용한 이야기 3개</p><p className="record-note">감정 선택은 정답률이나 진단 점수로 해석하지 않습니다.</p><a className="button button--secondary" href="#/records">기록 자세히 보기</a></Card>
    </div>
  </>
}
