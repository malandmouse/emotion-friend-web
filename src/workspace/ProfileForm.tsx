import { Alert, Card, Checkbox, SelectField, TextArea, TextField } from '../components/ui'
import { ApiFailure } from '../api/client'
import { ActionForm } from './ActionForm'
import type { Profile, ProfileInput } from './contracts'

function entries(data: FormData, field: string) {
  const result = String(data.get(field) ?? '').split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)
  if (result.length > 20 || result.some((entry) => entry.length > 256) || new Set(result).size !== result.length) throw new ApiFailure('INVALID_SCHEMA', 422)
  return result.length ? result : undefined
}
function buildProfile(data: FormData, original?: Profile): ProfileInput {
  const communicationModes = data.getAll('communicationModes').map(String)
  const supportPreferences = data.getAll('supportPreferences').map(String)
  if (!communicationModes.length || !supportPreferences.length) throw new ApiFailure('INVALID_SCHEMA', 422)
  const result: ProfileInput = {
    schemaVersion: '0.3.0', gender: data.get('gender') as ProfileInput['gender'], ageBand: data.get('ageBand') as ProfileInput['ageBand'], primaryLanguage: 'ko', receptiveSupport: 'UNKNOWN', recognitionSupport: data.get('recognitionSupport') as ProfileInput['recognitionSupport'], expressiveSupport: data.get('expressiveSupport') as ProfileInput['expressiveSupport'], communicationModes, supportPreferences,
    interests: entries(data, 'interests'), preferredActivities: entries(data, 'preferredActivities'), sensoryPreferences: entries(data, 'sensoryPreferences'), avoidTopics: entries(data, 'avoidTopics'),
  }
  if (original?.recentExperienceRef) result.recentExperienceRef = original.recentExperienceRef
  return result
}

export function ProfileForm({ pseudonym = '', profile, childId, onSuccess, onRecover }: { pseudonym?: string; profile?: Profile; childId?: string; onSuccess: (data: unknown) => Promise<void> | void; onRecover?: () => Promise<void> }) {
  return <ActionForm label={childId ? '프로필 저장' : '아동 등록'} onSuccess={onSuccess} onRecover={onRecover} prepare={(data) => {
    const name = String(data.get('pseudonym') || '').trim()
    if (!name || name.length > 40) throw new ApiFailure('INVALID_SCHEMA', 422)
    const input = buildProfile(data, profile)
    return childId ? { path: `/children/${childId}/profile`, method: 'PUT', expectedStatus: 200, body: { expectedProfileVersion: profile!.profileVersion, pseudonym: name, profile: input } } : { path: '/children', method: 'POST', expectedStatus: 201, body: { schemaVersion: '0.3.0', pseudonym: name, profile: input, guardianRelationshipConfirmed: data.get('guardianRelationshipConfirmed') === 'on' } }
  }}>
    <Card title="기본 정보"><div className="form-grid">
      <TextField label="아동 가명" name="pseudonym" required maxLength={40} defaultValue={pseudonym} placeholder="학습 화면에 사용할 가명" autoComplete="off" />
      <SelectField label="학습 아동 성별" name="gender" required defaultValue={profile?.gender ?? ''}><option value="">선택해 주세요</option><option value="BOY">남아</option><option value="GIRL">여아</option></SelectField>
      <SelectField label="연령 구간" name="ageBand" required defaultValue={profile?.ageBand ?? 'TARGET_8_TO_13'}><option value="TARGET_8_TO_13">8~13세</option><option value="ELEMENTARY_MIDDLE">초등 중학년</option></SelectField>
      <TextField label="주로 사용하는 언어" readOnly value="한국어" />
    </div><p className="form-note">성별은 필수이며 감정 얼굴 표시에 사용합니다. 아동용 이메일 계정은 만들지 않습니다.</p></Card>
    <Card title="도움이 필요한 정도"><div className="form-grid form-grid--three">
      <TextField label="이해 도움" readOnly value="확인 필요" />
      <SelectField label="감정 이해 도움" name="recognitionSupport" defaultValue={profile?.recognitionSupport ?? 'UNKNOWN'}><option value="UNKNOWN">확인 필요</option><option value="WITH_PICTURES">그림과 함께</option></SelectField>
      <SelectField label="표현 도움" name="expressiveSupport" defaultValue={profile?.expressiveSupport ?? 'UNKNOWN'}><option value="UNKNOWN">확인 필요</option><option value="SHORT_SENTENCES">짧은 문장으로</option></SelectField>
    </div><fieldset className="choice-group"><legend>사용할 수 있는 방식 · 하나 이상 선택</legend><p className="muted">아직 모르면 ‘확인 필요’만 선택해 주세요.</p><div className="row">{[['UNKNOWN', '확인 필요'], ['SPEECH', '말하기'], ['TEXT_EDIT', '글로 수정'], ['EXPRESSION_CARDS', '표현 카드']].map(([value, label]) => <Checkbox key={value} name="communicationModes" value={value} label={label} defaultChecked={(profile?.communicationModes ?? ['UNKNOWN']).includes(value)} />)}</div></fieldset>
      <fieldset className="choice-group"><legend>도움 선호 · 하나 이상 선택</legend><div className="row">{[['UNKNOWN', '확인 필요'], ['DEFAULT', '기본 도움']].map(([value, label]) => <Checkbox key={value} name="supportPreferences" value={value} label={label} defaultChecked={(profile?.supportPreferences ?? ['UNKNOWN']).includes(value)} />)}</div></fieldset>
      <details className="optional-fields"><summary>관심사·감각 선호·피할 소재 (선택)</summary><p className="muted">한 줄에 하나씩, 항목별 최대 20개·각 256자까지 입력할 수 있어요.</p><div className="form-grid">{[['interests', '관심사'], ['preferredActivities', '선호 활동'], ['sensoryPreferences', '감각 선호'], ['avoidTopics', '피할 소재']].map(([name, label]) => <TextArea key={name} label={label} name={name} defaultValue={(profile?.[name as 'interests'] ?? []).join('\n')} />)}</div></details>
    </Card>
    <Card title="보호자 확인">{!childId && <Checkbox label="이 아동의 보호 관계를 확인하고 등록합니다." name="guardianRelationshipConfirmed" required />}<p className="form-note">프로필 등록과 목적별 동의는 별도입니다. AI가 프로필을 자동으로 변경하지 않습니다.</p>{childId && <Alert>다른 곳에서 수정된 경우 최신 프로필을 확인한 뒤 다시 저장해 주세요.</Alert>}</Card>
  </ActionForm>
}
