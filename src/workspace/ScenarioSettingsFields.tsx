import type { ReactNode } from 'react'
import { Checkbox, SelectField, TextArea, TextField } from '../components/ui'
import type { DailyEvent, Settings } from './ScenarioInputsPage'

const narrativeKo = { KEY_POINT: '핵심 내용을 짧게 말해요', SEQUENCE: '일어난 순서대로 말해요', CAUSE_RESULT: '이유와 결과를 연결해 말해요', BACKGROUND_THOUGHT: '배경이나 생각도 덧붙여 말해요', VARIABLE: '상황에 따라 달라요' }
const feelings = { BROAD_FEELING: '좋아·싫어처럼 넓은 느낌', EMOTION_WORDS: '기쁨·슬픔 같은 감정 낱말', SIMILAR_FEELING_WORDS: '비슷한 감정의 차이', FEELING_CAUSE: '감정과 그 이유', INTENSITY_OR_MIXED: '감정의 세기나 섞인 마음', SELF_FEELING_DIFFICULT: '자기 마음을 말하기 어려울 때가 있어요' }
const goals = { EMOTION_CONTEXT: '상황에서 감정 알아차리기', EMOTION_CAUSE: '감정의 이유 이해하기', DIFFERENT_FEELINGS: '서로 다른 마음 이해하기', SIMILAR_EMOTIONS: '비슷한 감정 구별하기', SELF_FEELING: '내 감정 표현하기', SELF_CAUSE: '내 감정의 이유 말하기', INTENSITY_MIXED: '감정의 세기·섞임 표현하기', THOUGHT_WISH: '내 생각·바람 표현하기' }
import { understanding } from './scenarioSettingsOptions'

function choices(values: Record<string, string>) { return Object.entries(values).map(([id, text]) => <option key={id} value={id}>{text}</option>) }
function FormSection({ number, title, description, children }: { number: string; title: string; description: string; children: ReactNode }) {
  return <section className="care-form-section"><header><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></header><div className="stack">{children}</div></section>
}
// 실제 저장 폼과 디자인 미리보기가 같은 필드/선택지/name을 사용합니다.
// 서버 요청과 저장은 기존 SettingsEditor/ActionForm만 담당합니다.
export function ScenarioSettingsFields({ profile: p }: { profile: Settings }) {
  return <div className="care-settings-grid">
    <FormSection number="01" title="이야기를 나누는 모습" description="평소 관찰한 모습을 골라 주세요.">
      <fieldset><legend>연령 구간 (복수 선택)</legend><div className="care-option-grid">{Object.entries({ ELEMENTARY_MIDDLE: '초등 중학년', TARGET_8_TO_13: '8~13세' }).map(([value, label]) => <Checkbox key={value} name="ageBands" value={value} label={label} defaultChecked={p.ageBands.includes(value)} />)}</div></fieldset>
      <SelectField label="경험을 말로 전하는 형태" name="experienceNarrative" defaultValue={p.experienceNarrative ?? ''}><option value="">아직 모름</option>{choices(narrativeKo)}</SelectField>
      <fieldset><legend>평소 감정을 표현하는 모습 (복수 선택)</legend><div className="care-option-grid">{Object.entries(feelings).map(([value, label]) => <Checkbox key={value} name="emotionExpression" value={value} label={label} defaultChecked={p.emotionExpression?.includes(value)} />)}</div></fieldset>
    </FormSection>
    <FormSection number="02" title="편하게 이해하는 방식" description="대사의 길이와 설명 방식을 조절해요.">
      {Object.entries(understanding).map(([key, item]) => <SelectField key={key} label={item.label} name={key} defaultValue={p.understanding[key] ?? ''}><option value="">아직 모름</option>{choices(item.values)}</SelectField>)}
      <p className="care-note">기본 프로필의 관심사·피할 소재도 함께 참고해요. 모르는 항목은 비워 두어도 괜찮아요.</p>
    </FormSection>
    <FormSection number="03" title="함께 연습할 마음 표현" description="감정 이해·표현 목표는 최대 두 개예요.">
      <fieldset><legend>연습하고 싶은 감정 이해·표현 (최대 두 개)</legend><div className="care-option-grid">{Object.entries(goals).map(([value, label]) => <Checkbox key={value} name="priorityGoals" value={value} label={label} defaultChecked={p.priorityGoals.includes(value)} />)}</div></fieldset>
    </FormSection>
    <FormSection number="04" title="대화할 친구와 익숙한 표현" description="아이가 사용하는 말에 한 걸음 더 가깝게.">
      <SelectField label="대화할 캐릭터" name="characterPreference" defaultValue={p.characterPreference}><option value="RECOMMEND">추천</option><option value="JUN">준</option><option value="NARA">나래</option><option value="BOTH">준·나래 (각 편은 1대1)</option></SelectField>
      <TextArea label="아동이 실제 사용한 표현 예시 (선택)" name="examples" maxLength={2004} defaultValue={p.expressionExamples.map(e => e.text).join('\n')} hint="한 줄에 한 예시, 최대 5개·각 400자. 아동 답변과 카드의 표현을 조절하는 데 참고합니다." />
    </FormSection>
  </div>
}
export function DailyEventFields({ event }: { event?: DailyEvent }) {
  return <><TextField label="경험한 날짜" name="occurredOn" type="date" required defaultValue={event?.occurredOn ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())} /><TextArea label="이야기할 만한 경험" name="text" required maxLength={500} defaultValue={event?.text} placeholder="아이가 오늘 나누고 싶었던 이야기를 남겨 주세요." /><TextField label="아동이 말한 느낌 (선택)" name="reportedFeeling" maxLength={120} defaultValue={event?.reportedFeeling ?? ''} placeholder="예: 다시 만나서 반가웠대요" /></>
}
