import { Card, EmptyState, PageHeader } from '../components/ui'
const pages: Record<string, { title: string; description: string }> = {
  create: { title: '학습 만들기', description: '생성 결과는 검토·승인 후에만 아동이 사용할 수 있어요.' },
  review: { title: '콘텐츠 검토', description: '모든 선택 경로와 아동에게 사용할 내용을 확인합니다.' },
  plan: { title: '오늘 계획', description: '계획 승인과 발행은 각각 확인합니다.' },
  records: { title: '학습 기록', description: '정규 학습의 근거와 기록을 확인합니다.' },
  settings: { title: '동의와 기기 관리', description: '아동의 연결 기기와 정보 사용을 관리합니다.' },
}
export function PlaceholderPage({ page }: { page: string }) {
  const content = pages[page]
  if (page === 'review' || page === 'records' || page === 'plan') return <><PageHeader title={page === 'review' ? '콘텐츠 검토' : page === 'records' ? '학습 결과·기록' : '학습 세션'} description="아동을 선택한 뒤 실제 서버에 저장된 콘텐츠와 학습 상태를 확인해 주세요." /><Card><EmptyState title="관리할 아동을 선택해 주세요" description="내 계정으로 로그인한 뒤 접근 가능한 아동을 선택하면 콘텐츠 검토·학습 세션·결과·기록 관리 화면을 열 수 있습니다." action={<a className="button button--primary" href="#/workspace/children">학습 아동 선택</a>} /></Card></>
  return <><PageHeader title={content?.title ?? '페이지를 찾을 수 없어요'} description={content?.description} /><Card><EmptyState title={content ? '공통 레이아웃이 준비되었어요' : '주소를 확인해 주세요'} description={content ? '현재는 공통 UI 구현 단계입니다. 이 메뉴의 개별 기능은 아직 연결하지 않았습니다.' : '요청한 화면이 없습니다. 개요로 이동해 주세요.'} action={<a className="button button--secondary" href={content ? '#/components' : '#/overview'}>{content ? '공통 컴포넌트 확인' : '개요로 이동'}</a>} /></Card></>
}
