import type { ReactNode } from 'react'
export function AuthLayout({ children, variant = 'login' }: { children: ReactNode; variant?: 'login' | 'signup' }) {
  return <div className={`auth-layout auth-layout--${variant}`}>
    <aside className="auth-visual" aria-label="나의 표정 친구 소개">
      <div className="auth-visual__shapes" aria-hidden="true"><span /><span /></div>
      <div className="auth-visual__copy"><h2>나의 표정 친구<br />감정과 표현을<br />함께 연습해요</h2><p>보호자·치료사 학습 도구</p></div>
    </aside>
    <div className="auth-content"><a className="auth-brand" href="#/account">Emotion Friend</a>{children}<footer className="auth-footer"><a href="#/overview">개요 미리보기</a><span>·</span><a href="#/components">공통 컴포넌트</a></footer></div>
  </div>
}
