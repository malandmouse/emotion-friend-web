import { useState } from 'react'
import type { FormEvent } from 'react'
import { Alert, Button, Card, PageHeader, SelectField, TextArea, TextField } from '../components/ui'
import { usePreviewAction } from '../hooks/usePreviewAction'

export function ProfilePage() {
  const [name, setName] = useState('별이')
  const [gender, setGender] = useState('female')
  const [submitted, setSubmitted] = useState(false)
  const [saved, setSaved] = useState(false)
  const { pending, run } = usePreviewAction()
  const nameError = submitted && !name.trim() ? '아동 가명을 입력해 주세요.' : undefined
  const genderError = submitted && !gender ? '학습 아동 성별을 선택해 주세요.' : undefined

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setSaved(false)
    if (!name.trim() || !gender) {
      document.getElementById(!name.trim() ? 'child-name' : 'child-gender')?.focus()
      return
    }
    run(() => setSaved(true))
  }

  return <>
    <PageHeader title="별이의 프로필" description="자녀를 이해하는 데 필요한 정보만 등록해 주세요." />
    <form className="stack" onSubmit={submit} noValidate onChange={() => setSaved(false)}>
      <fieldset className="form-fieldset" disabled={pending}>
        <div className="stack">
          <Card title="기본 정보">
            <div className="form-grid">
              <TextField label="아동 가명" id="child-name" name="nickname" value={name} onChange={(e) => setName(e.target.value)} error={nameError} maxLength={30} required autoComplete="off" />
              <SelectField label="학습 아동 성별 · 필수" id="child-gender" name="gender" value={gender} onChange={(e) => setGender(e.target.value)} error={genderError} required><option value="">선택해 주세요</option><option value="female">여아</option><option value="male">남아</option></SelectField>
              <SelectField label="연령 구간" name="ageBand" defaultValue="middle"><option value="preschool">미취학</option><option value="lower">초등 저학년</option><option value="middle">초등 중학년</option><option value="upper">초등 고학년</option></SelectField>
              <TextField label="주로 사용하는 언어" name="language" defaultValue="한국어" />
            </div>
            <p className="form-note">성별은 필수 입력이며 감정 얼굴 표시에 사용합니다. 아동용 이메일 계정은 만들지 않습니다.</p>
          </Card>
          <Card title="도움이 필요한 정도">
            <div className="form-grid form-grid--three">
              <SelectField label="이해 도움" name="comprehension" defaultValue="check"><option value="check">확인 필요</option><option value="basic">기본 도움</option><option value="step">단계별로</option></SelectField>
              <SelectField label="감정 이해 도움" name="emotion" defaultValue="picture"><option value="check">확인 필요</option><option value="picture">그림과 함께</option><option value="word">말로 설명</option></SelectField>
              <SelectField label="표현 도움" name="expression" defaultValue="short"><option value="check">확인 필요</option><option value="short">짧은 문장으로</option><option value="card">표현 카드로</option></SelectField>
            </div>
            <div className="form-grid profile-secondary"><TextField label="사용할 수 있는 방식" name="methods" defaultValue="말하기 · 글로 수정 · 표현 카드" /><SelectField label="도움 선호" name="help" defaultValue="basic"><option value="basic">기본 도움</option><option value="check">확인 필요</option></SelectField></div>
            <p className="form-note">세 항목은 각각 설정합니다. 아직 모르면 ‘확인 필요’를 선택할 수 있어요.</p>
            <details className="optional-fields"><summary>관심사·감각 선호·피할 소재 (선택) 펼치기</summary><div className="form-grid"><TextArea label="관심사·감각 선호" name="interests" placeholder="좋아하는 활동이나 편안하게 느끼는 것을 적어 주세요" /><TextArea label="피할 소재" name="avoid" placeholder="학습에서 피하고 싶은 소재를 적어 주세요" /></div></details>
          </Card>
        </div>
      </fieldset>
      <Card title="보호자 확인"><p>등록된 정보는 학습 도움을 조절하는 데 사용합니다. AI가 프로필을 자동 변경하지 않습니다.</p>
        {(nameError || genderError) && <div className="form-feedback"><Alert tone="error">필수 입력 항목을 확인해 주세요. 입력 전에는 저장·학습 연결이 불가합니다.</Alert></div>}
        {saved && <div className="form-feedback"><Alert tone="success" title="입력 확인을 마쳤어요">미리보기 동작입니다. 정보가 서버에 저장되지는 않습니다.</Alert></div>}
        <div className="form-actions"><Button type="submit" loading={pending} loadingLabel="입력 확인 중">프로필 저장</Button></div>
      </Card>
    </form>
  </>
}
