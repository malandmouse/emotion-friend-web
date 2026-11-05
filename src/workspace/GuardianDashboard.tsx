import { useCallback } from 'react'
import type { ReactNode } from 'react'
import { Badge, Button, Card, EmptyState, Icon, PageHeader } from '../components/ui'
import { findChild } from './api'
import { loadPrototypeDay } from './prototypeDashboardData'
import type { LearningDayReport } from './prototypeDashboardData'
import type { PrototypeDay } from './prototypeContracts'
import { useResource } from './useResource'
import { ResourceState } from './shared'
import { dayStateNames, goalNames } from './careLabels'

export function GuardianDashboardView({ childName, day, report, href, action }: { childName: string; day: PrototypeDay; report: LearningDayReport | null; href: (section: string) => string; action?: ReactNode }) {
  const completed = day.completedCount
  const original = report?.expression.originalCount
  const expanded = report?.expression.aiComposedCount
  const total = (original ?? 0) + (expanded ?? 0)
  return <>
    <div className="care-eyebrow">A LITTLE CLOSER, EVERY DAY</div>
    <PageHeader title={`${childName}의 마음이 자라는 하루`} description="친구와 나눈 이야기, 오늘의 작은 표현을 함께 살펴보세요." action={<a className="button button--primary" href={href('agent')}><Icon name="book-plus" size={17} />오늘 이야기 준비</a>} />
    <div className="care-toolbar"><div className="care-date"><Icon name="calendar" size={16} />{day.localDate}<span>{day.programDay ? `Day ${day.programDay}` : '아직 시작 전'}</span></div><div className="row"><Badge tone={day.state === 'COMPLETED' || day.canLaunch ? 'success' : 'info'}>{dayStateNames[day.state] ?? day.state}</Badge>{action}</div></div>
    <div className="care-dashboard-grid">
      <Card title="오늘의 이야기" className="care-progress-card" action={<span className="care-card-kicker">DAILY 5</span>}>
        <div className="care-progress-ring" style={{ background: `conic-gradient(var(--care-blue) ${completed * 72}deg, #edf2fc 0deg)` }} role="img" aria-label={`오늘 이야기 ${completed}편 완료, 전체5편`}><div><strong>{completed}<small> / 5</small></strong><span>함께 나눈 이야기</span></div></div>
        <div className="care-stars" aria-label={report ? `획득한 별 ${report.stars}개` : '별 기록 준비 전'}>{[1, 2, 3, 4, 5].map(n => <span key={n} className={report && n <= report.stars ? 'is-filled' : ''} aria-hidden="true">★</span>)}</div>
        <p className="care-card-footnote">{completed === 5 ? '오늘의 다섯 이야기를 모두 나눴어요.' : '한 번의 대화가 소중한 한 걸음이 돼요.'}</p>
      </Card>
      <Card className="care-blue-card"><span className="care-light-tag">오늘의 학습 공간</span><div className="care-bubble-art" aria-hidden="true"><span>안녕!</span><i>☺</i></div><h2>친구와 조금 더<br />가까워지는 시간</h2><p>{day.canLaunch ? '오늘의 이야기가 준비됐어요. 연결한 iPad에서 친구를 만나 보세요.' : day.state === 'COMPLETED' ? '나눈 이야기와 마음을 기록했어요. 오늘의 작은 변화를 살펴보세요.' : '아이에게 맞는 이야기를 준비하고, 주제와 요약을 확인해 주세요.'}</p><a href={href(day.canLaunch ? 'device' : day.state === 'COMPLETED' ? 'records' : 'agent')}>{day.canLaunch ? 'iPad 연결 확인' : day.state === 'COMPLETED' ? '오늘 기록 살펴보기' : '이야기 준비하러 가기'}<Icon name="arrow" size={18} /></a></Card>
      <Card title="내 마음을 전한 방법" className="care-expression-card" action={<Icon name="chart" size={19} />}><p className="care-card-description">아동이 선택한 표현을 그대로 존중해요.</p><div className="care-expression-total"><strong>{report ? total : '—'}</strong><span>번의 자기표현</span></div>{[['내 말 그대로', original], ['카드와 함께', expanded]].map(([label, count], i) => <div className="care-expression-row" key={label}><div><span><i className={`care-dot care-dot--${i}`} />{label}</span><strong>{count ?? '—'}<small>회</small></strong></div><div className="care-meter"><span style={{ width: `${total ? Number(count) / total * 100 : 0}%` }} /></div></div>)}<a className="care-text-link" href={href('records')}>표현 기록 자세히 보기<Icon name="arrow" size={15} /></a></Card>
      <Card title="학습 준비하기" className="care-quick-card"><p className="care-card-description">오늘의 이야기를 위한 세 가지</p>{[{ icon: 'profile', label: '아이에게 맞는 대화', note: 'AI 대화 설정', section: 'scenario-settings' }, { icon: 'calendar', label: '최근 경험 남기기', note: '아이가 이야기할 소재', section: 'daily-events' }, { icon: 'book-plus', label: '하루 다섯 편 준비', note: '주제·요약 확인', section: 'agent' }].map(item => <a className="care-quick-link" href={href(item.section)} key={item.section}><span className="care-icon-box"><Icon name={item.icon as 'profile' | 'calendar' | 'book-plus'} size={19} /></span><span><strong>{item.label}</strong><small>{item.note}</small></span><Icon name="arrow" size={15} /></a>)}</Card>
      <Card title="오늘 함께 나눈 이야기" className="care-daily-card" action={<a className="care-small-link" href={href('records')}>전체 기록<Icon name="arrow" size={14} /></a>}>
        {report && report.slots.length > 0 ? <ol className="care-session-list">{report.slots.map(slot => <li key={slot.slot}><span className={`care-slot-icon ${slot.status === 'COMPLETED' ? 'is-complete' : ''}`}>{slot.status === 'COMPLETED' ? <Icon name="check" size={17} /> : `0${slot.slot}`}</span><div><strong>{slot.title}</strong><span>{slot.slot}번째 이야기</span></div><Badge tone={slot.status === 'COMPLETED' ? 'success' : slot.status === 'IN_PROGRESS' ? 'info' : 'neutral'}>{slot.status === 'COMPLETED' ? '완료' : slot.status === 'IN_PROGRESS' ? '진행 중' : '시작 전'}</Badge></li>)}</ol> : <EmptyState title="아직 준비된 이야기가 없어요" description="설정과 최근 경험을 바탕으로 오늘의 다섯 이야기를 준비할 수 있어요." action={<a className="button button--secondary" href={href('agent')}>이야기 준비하기</a>} />}
      </Card>
      <Card title="다음 대화에 이어갈 것" className="care-next-card" action={<span className="care-icon-box"><Icon name="inbox" size={19} /></span>}><p className="care-card-description">오늘 나눈 마음을 다음 이야기의 실마리로</p>{report?.nextTraining ? <><div className="care-goal-tags">{report.nextTraining.priorityGoals.map(goal => <span key={goal}>{goalNames[goal] ?? goal}</span>)}</div><p className="care-note">완료한 대화에서 관찰한 내용을 다음 제작에 참고해요. 보호자가 저장한 설정은 그대로 유지됩니다.</p></> : <p className="care-note">학습을 마치면 대화에서 관찰한 내용을 여기에 정리해요. 아직 기록이 없는 항목은 점수로 표시하지 않아요.</p>}<div className="care-divider" /><p className="care-observation">{report?.recognition.validFirstResponses != null ? `도움 없이 처음 응답한 감정 문제 ${report.recognition.validFirstResponses}회 중 일치 ${report.recognition.correctFirstResponses}회 · 다시 듣기 ${report.recognition.replayUsed}회` : '감정 문제 관찰이 아직 없어요.'}</p><p className="care-card-footnote">감정 선택은 진단 점수가 아닌 학습 관찰 기록이에요.</p>{report?.limitations.map((text, index) => <p key={index} className="care-card-footnote">{text}</p>)}<a className="care-text-link" href={href('scenario-settings')}>아이의 대화 설정 살펴보기<Icon name="arrow" size={15} /></a></Card>
    </div>
  </>
}

export function GuardianDashboard({ id }: { id: string }) {
  const load = useCallback(async (signal: AbortSignal) => {
    const [child, result] = await Promise.all([findChild(id, signal), loadPrototypeDay(id, '', signal)])
    return { child, ...result }
  }, [id])
  const resource = useResource(load)
  return <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload}>{resource.data && <GuardianDashboardView childName={resource.data.child.pseudonym} day={resource.data.day} report={resource.data.report} href={section => `#/workspace/children/${id}/${section}`} action={<Button variant="ghost" size="sm" loading={resource.loading} onClick={() => void resource.reload()}>새로고침</Button>} />}</ResourceState>
}
