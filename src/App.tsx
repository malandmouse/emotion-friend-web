import { useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { AuthPage } from './pages/AuthPage'
import { EmailVerificationPage } from './pages/EmailVerificationPage'
import { captureEmailVerificationLink, postLoginHash } from './auth/emailVerification'
import { ComponentsPage } from './pages/ComponentsPage'
import { OverviewPage } from './pages/OverviewPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ProfilePage } from './pages/ProfilePage'
import { AccountPage } from './pages/AccountPage'
import { LoadingState } from './components/ui'
import { useAuth } from './auth/useAuth'
import { Workspace } from './workspace/Workspace'
import './workspace/workspace.css'
import './components/ui/ui.css'
import './App.css'

function readPage() { return window.location.hash.replace(/^#\/?/, '') || 'account' }
function App() {
  const [page, setPage] = useState(readPage)
  const auth = useAuth()
  useEffect(() => {
    const onHashChange = () => { captureEmailVerificationLink(); setPage(readPage()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  useEffect(() => {
    const titles: Record<string, string> = { account: '내 계정', 'verify-email': '이메일 확인', overview: '개요', profile: '아동 프로필', login: '로그인', signup: '회원가입', components: '공통 컴포넌트', create: '학습 만들기', review: '콘텐츠 검토', plan: '오늘 계획', records: '학습 기록', settings: '동의·기기' }
    const workspaceTitle = page.includes('/review') ? '콘텐츠 검토' : page.includes('/sessions') ? '학습 세션' : page.includes('/records') ? '학습 결과·기록' : '회원·아동 관리'
    document.title = `${page.startsWith('workspace') ? workspaceTitle : titles[page] ?? '페이지 없음'} · 나의 표정 친구`
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [page])
  useEffect(() => {
    if ((page === 'account' || page.startsWith('workspace')) && auth.status === 'anonymous') window.location.replace('#/login')
    if ((page === 'login' || page === 'signup') && auth.status === 'authenticated') window.location.replace(`#${postLoginHash()}`)
  }, [page, auth.status])
  if (page === 'verify-email') return <EmailVerificationPage />
  if (page === 'workspace' || page.startsWith('workspace/')) return <Workspace key={`${auth.member?.id}:${auth.member?.role}:${page}`} path={page} />
  if (page === 'account' || ((page === 'login' || page === 'signup') && auth.status === 'error')) return <AccountPage />
  if ((page === 'login' || page === 'signup') && auth.status === 'loading') return <main className="fatal-error"><LoadingState label="로그인 상태를 확인하고 있어요" /></main>
  if (page === 'login' || page === 'signup') return <AuthPage key={page} signup={page === 'signup'} />
  return <AppShell currentPage={page}>{page === 'overview' ? <OverviewPage /> : page === 'profile' ? <ProfilePage /> : page === 'components' ? <ComponentsPage /> : <PlaceholderPage page={page} />}</AppShell>
}
export default App
