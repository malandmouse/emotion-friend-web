import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button, ErrorState } from './ui'
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('화면 렌더링 오류', error, info.componentStack) }
  render() {
    if (this.state.hasError) return <main className="fatal-error"><ErrorState title="화면을 표시하지 못했어요" description="화면을 새로고침해 다시 시도해 주세요." action={<Button onClick={() => window.location.reload()}>새로고침</Button>} /></main>
    return this.props.children
  }
}
