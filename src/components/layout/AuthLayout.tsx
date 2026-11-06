import type { ReactNode } from 'react'
import { Icon } from '../ui/Icon'
import './auth-care.css'

// 로그인 표시만 선택적으로 바꿉니다. 계정/이메일 확인 화면의 기본 레이아웃은 유지합니다.
export function AuthLayout({ children, variant = 'login', appearance = 'default' }: { children: ReactNode; variant?: 'login' | 'signup'; appearance?: 'default' | 'care' }) {
  const care = appearance === 'care'
  return <div className={`auth-layout auth-layout--${variant}${care ? ' auth-layout--care' : ''}`}>
    {care && <header className="auth-care-header"><a className="auth-care-brand" href="#/account"><span className="auth-care-mark" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(n => <i key={n} style={{ transform: `rotate(${n * 60}deg) translateY(-8px)` }} />)}</span>나의 표정 친구</a><span>마음을 나누는 매일의 대화</span></header>}
    <aside className="auth-visual" aria-label="나의 표정 친구 소개">
      {care ? <>
        <div className="auth-care-intro"><span className="auth-care-eyebrow">EXPRESSION FRIEND</span><h2>아이의 하루를 듣고,<br />마음을 나누는 시간.</h2><p>작은 일상 이야기에서 시작해요.<br />준·나래와 함께 오늘의 마음을 표현해요.</p></div>
        <div className="auth-care-conversation" aria-hidden="true"><div className="auth-care-bubble"><span className="auth-care-bubble-avatar"><Icon name="people" size={23} /></span><p>오늘은 어떤 마음이었어?</p></div><div className="auth-care-bubble auth-care-bubble--reply"><p>내 이야기를 들어 줘서 좋았어.</p><span className="auth-care-bubble-avatar"><Icon name="profile" size={23} /></span></div><span className="auth-care-orbit" /><span className="auth-care-orbit auth-care-orbit--small" /></div>
        <div className="auth-care-footnote"><Icon name="book-plus" size={19} /><span>이야기 준비부터 하루의 학습 기록까지</span></div>
      </> : <><div className="auth-visual__shapes" aria-hidden="true"><span /><span /></div><div className="auth-visual__copy"><h2>나의 표정 친구<br />감정과 표현을<br />함께 연습해요</h2><p>보호자·치료사 학습 도구</p></div></>}
    </aside>
    <div className="auth-content">{!care && <a className="auth-brand" href="#/account">Emotion Friend</a>}{children}<footer className="auth-footer"><a href="#/overview">개요 미리보기</a><span>·</span><a href="#/components">공통 컴포넌트</a></footer></div>
  </div>
}
