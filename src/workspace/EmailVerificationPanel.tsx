import { useState } from 'react'
import { Alert } from '../components/ui'
import { ActionForm } from './ActionForm'

export function EmailVerificationPanel() {
  const [requested, setRequested] = useState(false)
  return <details className="optional-fields email-verification"><summary>이메일 소유 확인 진행</summary><div className="stack">
    <p>가입한 이메일로 확인 메일을 요청하고, 받은 메일의 링크를 열어 주세요. 확인 정보는 요청 후 15분 동안 사용할 수 있어요.</p>
    {requested && <Alert tone="success">확인 메일 요청을 접수했어요. 받은 편지함과 스팸함을 확인해 주세요. 다시 요청하면 이전 링크는 사용할 수 없어요.</Alert>}
    <ActionForm label={requested ? '이메일 확인 메일 다시 요청' : '이메일 확인 요청'} idempotent={false} prepare={() => ({ path: '/auth/email-verifications', method: 'POST', expectedStatus: 202 })} onSuccess={() => setRequested(true)} />
  </div></details>
}
