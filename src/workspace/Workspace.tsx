import type { IconName } from '../components/ui/Icon'
import { AppShell } from '../components/layout/AppShell'
import { Card, EmptyState, LoadingState } from '../components/ui'
import { useAuth } from '../auth/useAuth'
import { AccountPage } from '../pages/AccountPage'
import { ChildrenPage } from './ChildrenPage'
import { ChildProfilePage, NewChildPage } from './ChildProfilePage'
import { ConnectionsPage } from './ConnectionsPage'
import { ConsentsPage } from './ConsentsPage'
import { InvitationsPage } from './InvitationsPage'
import { MembersPage } from './MembersPage'
import { ReviewPage } from './ReviewPage'
import { RecordsPage, SessionsPage } from './LearningPages'
import { SessionPage } from './SessionPage'
import { isActive, roleLabels } from './contracts'

export function Workspace({ path }: { path: string }) {
  const auth = useAuth()
  const member = auth.member
  if (auth.status === 'loading') return <main className="fatal-error"><LoadingState label="계정 권한을 확인하고 있어요" /></main>
  if (!member || !isActive(member)) return <AccountPage />
  const role = member.role!
  const [route, search = ''] = path.split('?')
  const parts = route.split('/').filter(Boolean).slice(1)
  const section = parts[0] ?? (role === 'ADMIN' ? 'members' : 'children')
  const childId = section === 'children' && parts[1] && parts[1] !== 'new' ? parts[1].toLowerCase() : undefined
  const childSection = parts[2] ?? 'profile'
  const currentPage = childId ? childSection : section === 'children' && parts[1] === 'new' ? 'new' : section
  const navigation: { id: string; label: string; icon: IconName; href: string }[] = role === 'ADMIN' ? [{ id: 'members', label: '회원·역할 관리', icon: 'people', href: '#/workspace/members' }] : [
    { id: 'children', label: role === 'GUARDIAN' ? '학습 아동' : '연결된 아동', icon: 'people', href: '#/workspace/children' },
    ...(role === 'GUARDIAN' ? [{ id: 'new', label: '아동 등록', icon: 'book-plus' as const, href: '#/workspace/children/new' }] : [{ id: 'invitations', label: '받은 초대', icon: 'inbox' as const, href: '#/workspace/invitations' }]),
  ]
  if (childId && role !== 'ADMIN') {
    navigation.push({ id: 'profile', label: '아동 프로필', icon: 'profile', href: `#/workspace/children/${childId}/profile` })
    navigation.push({ id: 'review', label: '콘텐츠 검토', icon: 'clipboard-check', href: `#/workspace/children/${childId}/review` }, { id: 'sessions', label: '학습 세션', icon: 'calendar', href: `#/workspace/children/${childId}/sessions` }, { id: 'records', label: '학습 결과·기록', icon: 'chart', href: `#/workspace/children/${childId}/records` })
    if (role === 'GUARDIAN') navigation.push({ id: 'consents', label: '목적별 동의', icon: 'shield', href: `#/workspace/children/${childId}/consents` }, { id: 'connections', label: '치료사 연결', icon: 'link', href: `#/workspace/children/${childId}/connections` })
  }
  navigation.push({ id: 'account', label: '내 계정', icon: 'account', href: '#/account' })
  let content
  if (section === 'members' && parts.length <= 1 && role === 'ADMIN') content = <MembersPage member={member} />
  else if (section === 'invitations' && parts.length <= 1 && role === 'THERAPIST') content = <InvitationsPage />
  else if (section === 'children' && role !== 'ADMIN' && parts.length <= 1) content = <ChildrenPage member={member} />
  else if (section === 'children' && parts[1] === 'new' && parts.length === 2 && role === 'GUARDIAN') content = <NewChildPage />
  else if (childId && parts.length <= 3 && role !== 'ADMIN' && childSection === 'profile') content = <ChildProfilePage id={childId} member={member} />
  else if (childId && parts.length === 3 && role === 'GUARDIAN' && childSection === 'consents') content = <ConsentsPage id={childId} />
  else if (childId && parts.length === 3 && role === 'GUARDIAN' && childSection === 'connections') content = <ConnectionsPage id={childId} />
  else if (childId && parts.length === 3 && role !== 'ADMIN' && childSection === 'review') content = <ReviewPage id={childId} />
  else if (childId && parts.length === 3 && role !== 'ADMIN' && childSection === 'records') content = <RecordsPage id={childId} />
  else if (childId && parts.length === 3 && role !== 'ADMIN' && childSection === 'sessions') content = <SessionsPage id={childId} member={member} />
  else if (childId && parts.length === 4 && role !== 'ADMIN' && childSection === 'sessions') {
    const slot = Number(new URLSearchParams(search).get('receipt'))
    content = <SessionPage id={childId} sessionId={parts[3].toLowerCase()} initialReceipt={Number.isInteger(slot) && slot >= 1 && slot <= 5 ? slot : undefined} member={member} />
  }
  else content = <Card><EmptyState title="이 화면을 사용할 수 없어요" description="현재 승인된 계정 역할과 접근 가능한 아동 범위를 확인해 주세요." action={<a className="button button--secondary" href={role === 'ADMIN' ? '#/workspace/members' : '#/workspace/children'}>사용 가능한 목록으로</a>} /></Card>
  return <AppShell preview={false} currentPage={currentPage} navigation={navigation} childName="" roleLabel={roleLabels[role]} accountLabel={member.displayName} brandHref={role === 'ADMIN' ? '#/workspace/members' : '#/workspace/children'}>{content}</AppShell>
}
