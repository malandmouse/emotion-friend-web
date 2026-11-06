import type { ReactNode } from 'react'
import { Icon } from '../ui'
import type { IconName } from '../ui/Icon'

const defaultNavigation = [
  { id: 'overview', label: '개요', icon: 'home' },
  { id: 'profile', label: '아동 프로필', icon: 'profile' },
  { id: 'create', label: '학습 만들기', icon: 'book-plus' },
  { id: 'review', label: '콘텐츠 검토', icon: 'clipboard-check' },
  { id: 'plan', label: '오늘 계획', icon: 'calendar' },
  { id: 'records', label: '학습 기록', icon: 'chart' },
  { id: 'settings', label: '동의·기기', icon: 'shield' },
] satisfies { id: string; label: string; icon: IconName }[]

interface AppShellProps {
  children: ReactNode
  currentPage: string
  childName?: string
  roleLabel?: string
  accountLabel?: string
  navigation?: { id: string; label: string; icon: IconName; href?: string }[]
  preview?: boolean
  brandHref?: string
  appearance?: 'default' | 'care'
}

export function AppShell({ children, currentPage, childName = '별이', roleLabel = '보호자', accountLabel = '별이의 보호자', navigation = defaultNavigation, preview = true, brandHref = '#/overview', appearance = 'default' }: AppShellProps) {
  if (appearance === 'care') {
    const primaryIds = ['dashboard', 'scenario-settings', 'daily-events', 'agent']
    const primary = navigation.filter(item => primaryIds.includes(item.id))
    const more = navigation.filter(item => !primaryIds.includes(item.id))
    const link = ({ id, label, href }: typeof navigation[number]) => <a key={id} className={`care-nav-link ${currentPage === id ? 'care-nav-link--active' : ''}`} href={href ?? `#/${id}`} aria-current={currentPage === id ? 'page' : undefined}>{label}</a>
    return <div className="care-shell"><div className="care-frame">
      <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>본문으로 건너뛰기</a>
      <header className="care-header">
        <a className="care-brand" href={brandHref}><span className="care-brand-mark" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(n => <i key={n} style={{ transform: `rotate(${n * 60}deg) translateY(-8px)` }} />)}</span><span>나의 표정 친구</span></a>
        <nav className="care-navigation" aria-label="주요 학습 관리">{(primary.length ? primary : more.slice(0, 2)).map(link)}</nav>
        <div className="care-header-tools">
          <details className="care-more"><summary aria-label="전체 메뉴"><Icon name="chevron" /><span>전체 메뉴</span></summary><nav aria-label="전체 관리 메뉴">{navigation.map(link)}</nav></details>
          <a className="care-account" href={preview ? '#/dashboard' : '#/account'} aria-label={`${accountLabel} · 내 계정`}><span className="care-avatar" aria-hidden="true"><Icon name="profile" /></span><span>{accountLabel}<small>{roleLabel}</small></span></a>
        </div>
      </header>
      <div className="care-context"><a href={brandHref}><Icon name="people" size={15} />{childName ? `${childName}의 학습 공간` : '학습 아동 선택'}</a><span className="care-context-label">{preview ? '디자인 미리보기 · 예시 데이터' : '보호자 학습 관리'}</span></div>
      <div className="app-content"><main id="main-content" tabIndex={-1} key={currentPage}>{children}</main>
        <footer className="preview-footer"><span>Emotion Friend · 매일 조금씩, 마음을 나누는 친구</span><span>{preview ? '예시 입력은 서버에 저장되지 않아요' : <a href="#/account">내 계정·로그아웃</a>}</span></footer>
      </div>
    </div></div>
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>본문으로 건너뛰기</a>
    <aside className="sidebar" aria-label="주 메뉴">
      <a className="brand" href={brandHref}>나의 표정 친구<span className="brand__mobile">{childName && <> · {childName}</>} · {roleLabel}</span></a>
      <p className="sidebar__role">{roleLabel}</p>
      <nav className="navigation" aria-label="학습 관리">
        {navigation.map(({ id, label, icon, href }) => <a key={id} className={`nav-item ${currentPage === id ? 'nav-item--active' : ''}`} href={href ?? `#/${id}`} aria-current={currentPage === id ? 'page' : undefined}><Icon name={icon} size={18} /><span>{label}</span></a>)}
      </nav>
      <div className="account-card"><strong>{accountLabel}</strong><p>{preview ? '화면 미리보기' : '로그인 중'}</p><a href={preview ? '#/login' : '#/account'}>{preview ? '로그인 화면' : '내 계정·로그아웃'}</a></div>
    </aside>
    <div className="app-content">
      <main id="main-content" tabIndex={-1} key={currentPage}>{children}</main>
      <footer className="preview-footer"><span>{preview ? '화면 미리보기 · 예시 데이터' : 'Emotion Friend · 회원·아동 관리'}</span><div><a href="#/components" aria-current={currentPage === 'components' ? 'page' : undefined}>공통 컴포넌트</a><span aria-hidden="true">·</span><a href="#/account">내 계정</a>{preview && <><span aria-hidden="true">·</span><a href="#/login">로그인·가입</a></>}</div></footer>
    </div>
  </div>
}
