import { StrictMode, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { AppShell } from '../components/layout/AppShell'
import { Alert, Badge, Button, Card, Checkbox, PageHeader, SelectField } from '../components/ui'
import { GuardianDashboardView } from '../workspace/GuardianDashboard'
import { DailyEventFields, ScenarioSettingsFields } from '../workspace/ScenarioSettingsFields'
import { StoryPreviewCard, WorkflowSteps } from '../workspace/CareComponents'
import type { DailyEvent, Settings } from '../workspace/ScenarioInputsPage'
import type { DayPreviewItem, PrototypeDay } from '../workspace/prototypeContracts'
import type { LearningDayReport } from '../workspace/prototypeDashboardData'
import '../index.css'
import '../workspace/workspace.css'
import '../components/ui/ui.css'
import '../App.css'
import '../styles/care.css'

// 실제 계정·아동·원고가 아닌 디자인 확인용 예시입니다.
// 인증 초기화/useResource/ActionForm을 실행하지 않고 API를 호출하지 않습니다.
const stories: DayPreviewItem[] = [
  { slot: 1, title: '준이 이름을 붙인 만화 주인공', summary: '준이 새로 그린 만화 주인공을 소개해요. 서로 마음에 드는 이름을 이야기하고, 좋아하는 것을 나눌 때의 마음을 살펴봐요.', npcId: 'JungHoon', place: 'Class' },
  { slot: 2, title: '나래가 발견한 공원의 새 친구', summary: '나래가 공원에서 본 강아지 이야기를 들려줘요. 반가웠던 순간을 떠올리고, 아이도 만나고 싶은 친구를 이야기해요.', npcId: 'MainPlayer', place: 'Park' },
  { slot: 3, title: '내가 좋아하는 점심 메뉴', summary: '준과 좋아하는 급식 메뉴에 관해 이야기해요. 같은 음식에도 서로 다른 마음이 들 수 있음을 알아가요.', npcId: 'JungHoon', place: 'Canteen' },
  { slot: 4, title: '비 오는 날에 듣고 싶은 소리', summary: '나래가 창밖의 빗소리를 듣다가 떠오른 생각을 나눠요. 아이가 느끼는 분위기와 마음에도 귀 기울여요.', npcId: 'MainPlayer', place: 'School' },
  { slot: 5, title: '다음에 또 들려주고 싶은 이야기', summary: '준이 오늘 제일 기억에 남는 순간을 이야기해요. 아이도 자기 마음을 표현하고 다음에 나누고 싶은 이야기를 골라요.', npcId: 'JungHoon', place: 'Class' },
]
const profile: Settings = { ageBands: ['TARGET_8_TO_13'], caregiverObservedAt: null, experienceNarrative: 'CAUSE_RESULT', emotionExpression: ['EMOTION_WORDS', 'FEELING_CAUSE'], understanding: { informationAmount: 'SEQUENTIAL_EVENTS', causeExplanation: 'EXPLICIT_LINK', personReference: 'NAMES_EXPLICIT' }, priorityGoals: ['EMOTION_CAUSE', 'SELF_FEELING'], expressionExamples: [{ text: '기다리던 친구를 만나서 반가웠어.', context: null, source: 'CAREGIVER_REPORTED_CHILD_UTTERANCE', recordedAt: null }], characterPreference: 'BOTH' }
const sampleDay: PrototypeDay = { localDate: '2026-11-06', programDay: 2, state: 'IN_PROGRESS', jobId: null, releaseId: null, planId: null, completedCount: 2, canGenerate: false, canLaunch: true }
const report: LearningDayReport = { localDate: sampleDay.localDate, programDay: 2, completedCount: 2, stars: 2, slots: stories.map(story => ({ slot: story.slot, title: story.title, status: story.slot <= 2 ? 'COMPLETED' : story.slot === 3 ? 'IN_PROGRESS' : 'NOT_STARTED' })), recognition: { validFirstResponses: 2, correctFirstResponses: 1, replayUsed: 1 }, expression: { originalCount: 1, aiComposedCount: 1 }, limitations: [], nextTraining: { priorityGoals: ['EMOTION_CAUSE', 'SELF_FEELING'], explanationHint: '예시' } }
const initialEvents: DailyEvent[] = [{ eventId: 'preview-1', version: 1, occurredOn: '2026-11-06', text: '오랜만에 만난 친구와 쉬는 시간에 이야기를 나눴어요. 다음에도 같은 자리에서 만나기로 했대요.', reportedFeeling: '다시 만나서 반가웠어' }, { eventId: 'preview-2', version: 1, occurredOn: '2026-11-05', text: '아이가 집에서 그린 만화를 보여 주며 주인공 이름을 같이 정해 달라고 했어요.', reportedFeeling: '내 이야기를 들어 줘서 좋았어' }]
const pages = ['dashboard', 'scenario-settings', 'daily-events', 'agent']
function readPage() { const page = window.location.hash.slice(2); return pages.includes(page) ? page : 'dashboard' }
const href = (page: string) => `#/${pages.includes(page) ? page : 'dashboard'}`

export function Preview() {
  const [page, setPage] = useState(readPage), [notice, setNotice] = useState('')
  const [events, setEvents] = useState(initialEvents), [editing, setEditing] = useState<DailyEvent | undefined>()
  const [stage, setStage] = useState('review')
  useEffect(() => {
    const changed = () => { setPage(readPage()); setNotice(''); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    if (values.getAll('priorityGoals').length > 2) { setNotice('연습 목표는 최대 두 개를 선택해 주세요.'); return }
    setNotice('예시 입력을 확인했어요. 디자인 미리보기이므로 서버에는 저장하지 않았어요.')
    window.scrollTo(0, 0)
  }
  function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const next: DailyEvent = { eventId: editing?.eventId ?? `preview-${Date.now()}`, version: (editing?.version ?? 0) + 1, occurredOn: String(values.get('occurredOn')), text: String(values.get('text')), reportedFeeling: String(values.get('reportedFeeling')) || null }
    setEvents(previous => editing ? previous.map(item => item.eventId === editing.eventId ? next : item) : [next, ...previous]); setEditing(undefined); event.currentTarget.reset(); setNotice('이 미리보기 안에서만 경험을 반영했어요. 서버 저장은 없어요.')
  }
  let content
  if (page === 'dashboard') content = <GuardianDashboardView childName="하루" day={sampleDay} report={report} href={href} action={<Button variant="ghost" size="sm" onClick={() => setNotice('디자인 확인용 예시 데이터예요. 실제 학습 기록은 조회하지 않았어요.')}>새로고침</Button>} />
  else if (page === 'scenario-settings') content = <><PageHeader title="AI 대화 설정" description="아이에게 익숙한 말과 편안한 설명으로, 더 가까운 대화를 준비해요." /><WorkflowSteps current={0} /><form className="action-form" onSubmit={saveSettings}><ScenarioSettingsFields profile={profile} /><div className="row" style={{ justifyContent: 'flex-end' }}><a className="button button--secondary" href={href('daily-events')}>최근 경험 보기</a><Button type="submit">설정 저장</Button></div></form></>
  else if (page === 'daily-events') content = <><PageHeader title="최근 경험" description="아이의 일상에서 다음 이야기의 실마리를 찾아요." action={<a className="button button--primary" href={href('agent')}>이야기 제작으로</a>} /><WorkflowSteps current={1} /><div className="care-events-layout"><div className="stack"><Card title={editing ? '경험 수정' : '오늘, 어떤 일이 있었나요?'} description="아이의 말과 경험을 짧게 남겨 주세요."><form key={editing?.eventId ?? 'new'} className="action-form" onSubmit={saveEvent}><DailyEventFields event={editing} /><div className="row">{editing && <Button variant="secondary" onClick={() => setEditing(undefined)}>취소</Button>}<Button type="submit">{editing ? '경험 수정' : '경험 저장'}</Button></div></form></Card><Alert>아동이 답변할 때 꺼낼 수 있는 후보로 참고합니다. 캐릭터의 경험으로 바꾸지 않으며, 저장만으로 유료 호출하지 않습니다.</Alert></div><div className="stack"><div className="care-list-heading"><h2>저장한 경험</h2><span>예시 데이터 · 제작에서 최대 5개 선택</span></div>{events.map(item => <Card className="care-event-card" key={item.eventId} title={item.occurredOn}><p className="care-event-text">{item.text}</p>{item.reportedFeeling && <p className="care-feeling-tag">{item.reportedFeeling}</p>}<div className="care-event-actions"><Button variant="secondary" onClick={() => { setEditing(item); window.scrollTo(0, 0) }}>수정</Button><Button variant="ghost" onClick={() => { setEvents(items => items.filter(value => value.eventId !== item.eventId)); setNotice('예시 목록에서만 삭제했어요. 실제 기록은 바꾸지 않았어요.') }}>삭제 (예시)</Button></div></Card>)}</div></div></>
  else content = <><PageHeader title="하루 대화 제작" description="아이가 선택하며 이어가는 다섯 이야기. 주제와 요약부터 살펴보세요." action={<SelectField label="미리보기 상태" value={stage} onChange={e => setStage(e.target.value)}><option value="start">준비 전</option><option value="running">제작 중</option><option value="review">요약 확인</option><option value="media">목소리 준비</option><option value="ready">iPad 준비 완료</option></SelectField>} /><WorkflowSteps current={stage === 'ready' ? 3 : stage === 'media' ? 2 : stage === 'review' ? 1 : 0} labels={['이야기 제작', '주제·요약 확인', '목소리 준비', 'iPad 학습']} /><div className="stack"><Card className="care-generation-card" title="Day 2 · 오늘의 다섯 이야기" action={<span className="care-date">2026-11-06</span>}><Alert>디자인 확인용 예시입니다. 제작·확정 버튼을 눌러도 GPT·Typecast·Jev를 호출하지 않습니다.</Alert><p><a href={href('scenario-settings')}>AI 대화 설정 수정</a> · <a href={href('daily-events')}>최근 경험 등록·수정</a></p><form className="action-form" onSubmit={e => { e.preventDefault(); setStage('review'); setNotice('미리 작성한 예시 다섯 편을 표시했어요. 실제 생성 요청은 없어요.') }}><fieldset className="form-fieldset stack"><fieldset><legend>아동 답변에 참고할 경험 (선택, 최대 다섯 개)</legend>{events.map(item => <Checkbox key={item.eventId} label={`${item.occurredOn} · ${item.text}`} />)}</fieldset></fieldset><div className="row"><Button type="submit" disabled={stage !== 'start'}>하루 다섯 편 제작 (예시)</Button></div></form></Card>
    {stage === 'running' && <Card title="이야기를 만들고 있어요"><p role="status">제작 중 화면 예시입니다. 현재는 요청을 보내지 않습니다.</p></Card>}
    {['review', 'media', 'ready'].includes(stage) && <><div className="care-list-heading"><h2>오늘 만날 다섯 이야기</h2><Badge tone="info">미리 작성한 예시 원고</Badge></div><div className="care-story-grid">{stories.map(story => <StoryPreviewCard key={story.slot} story={story} />)}</div><Card className="care-approval-card" title="이 다섯 편 확인">{stage === 'review' ? <form className="action-form" onSubmit={e => { e.preventDefault(); if (new FormData(e.currentTarget).get('decision') === 'HOLD') { setNotice('보류 화면 선택을 확인했어요. 실제 작업은 바꾸지 않았어요.'); return } setStage('ready'); setNotice('확정 후 준비 완료 화면의 예시예요. 실제 확정·합성·발행은 하지 않았어요.') }}><p>다섯 주제와 요약을 읽고 오늘 사용할 이야기인지 확인해 주세요.</p><SelectField label="검토 결과" name="decision" defaultValue="CONFIRM"><option value="CONFIRM">이 다섯 편으로 확정</option><option value="HOLD">보류</option></SelectField><Checkbox required label="이 다섯 편을 아동의 학습에 사용하는 데 동의합니다." /><p className="care-note">실제 서비스에서는 확정 후 문장별 Typecast 음원 준비와 발행이 이어집니다.</p><div><Button type="submit">선택 저장 (예시)</Button></div></form> : <Alert tone={stage === 'ready' ? 'success' : 'info'}>{stage === 'ready' ? '학습 준비 완료 화면입니다. 실제 서비스에서는 연결한 iPad에서 오늘의 이야기를 시작해요.' : '문장별 목소리를 준비하는 화면입니다. 완료되면 iPad에서 시작할 수 있어요.'}</Alert>}</Card></>}
  </div></>
  const navigation = [{ id: 'dashboard', label: '대시보드', icon: 'home' as const }, { id: 'scenario-settings', label: 'AI 대화 설정', icon: 'profile' as const }, { id: 'daily-events', label: '최근 경험', icon: 'calendar' as const }, { id: 'agent', label: '하루 대화 제작', icon: 'book-plus' as const }].map(item => ({ ...item, href: href(item.id) }))
  return <><div className="care-preview-banner"><strong>DESIGN PREVIEW</strong><span>화면 스타일 확인용 · 모든 내용은 예시 · 서버 저장·유료 호출 없음</span></div><AppShell appearance="care" currentPage={page} childName="하루" accountLabel="하루의 보호자" brandHref={href('dashboard')} navigation={navigation}>{notice && <p className="care-preview-notice" role="status">{notice}</p>}{content}</AppShell></>
}

createRoot(document.getElementById('root')!).render(<StrictMode><Preview /></StrictMode>)
