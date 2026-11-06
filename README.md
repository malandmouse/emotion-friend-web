# 나의 표정 친구 · 보호자·치료사용 웹

React 19 / TypeScript / Vite 기반의 공통 UI와 회원·역할, 아동 등록·치료사 연결·동의, 콘텐츠 검토·학습 세션·결과·기록 관리 API 연결을 제공합니다.

## 실행과 확인

```sh
npm install
npm run dev
npm run build
npm run lint
```

## 화면

- `/#/overview`: PDF A03 개요. 예시 수치를 사용한 공통 레이아웃.
- `/#/profile`: PDF A02 프로필. 필수 가명·성별 검사, 오류 포커스, 처리 중·완료 안내.
- `/#/login`, `/#/signup`: PDF A00 로그인·가입 레이아웃 및 입력 검사.
- `/#/verify-email`: 메일 링크 확인 화면. 로그인 후 복귀, 명시적 확인, 만료·잘못된 계정 복구를 제공합니다.
- `/#/account`: 서버 `/me`에서 확인한 내 계정·신청 역할·승인 상태와 로그아웃. 기본 진입점이며 비로그인 시 로그인으로 이동합니다.
- `/#/workspace/children`: 승인된 보호자·치료사의 접근 가능한 아동 목록.
- `/#/workspace/children/new`: 보호자의 아동 등록 및 보호 관계 확인.
- `/#/workspace/children/{childId}/profile`: 서버 권한에 따른 프로필 조회·수정. 치료사는 읽기 전용.
- `/#/workspace/children/{childId}/consents`: 관리 보호자의 6개 목적별 동의 부여·철회.
- `/#/workspace/children/{childId}/connections`: 보호자의 치료사 초대·취소·연결 해제와 아동 비활성화.
- `/#/workspace/children/{childId}/review`: 생성된 주제·요약 조회, 상태 필터·페이지 이동, 1~5개 일괄 확인·보류.
- `/#/workspace/children/{childId}/sessions`: 세션 목록·상태 필터, 관리 보호자의 Day 1 시작·동일 기기 복원.
- `/#/workspace/children/{childId}/sessions/{sessionId}`: 5슬롯 완료·별 상태, 슬롯별 receipt 조회·복구, 보호자의 직접 입력 확정·실행 결과 연결.
- `/#/workspace/children/{childId}/records`: 전체 수락된 완료 기록과 기간별 완료·별 집계, 기록에서 receipt로 이동.
- `/#/workspace/invitations`: 치료사 본인의 초대 수락·거절. 수락 전에 아동 정보를 표시하지 않습니다.
- `/#/workspace/members`: 운영자의 회원 목록·승인·반려·정지·보호자/치료사 역할 변경.
- `/#/components`: 모든 입력·버튼·안내·로딩·스켈레톤·오류 재시도·빈 상태 미리보기.
- 그 외 메뉴는 공통 레이아웃만 제공하며 개별 기능은 아직 연결하지 않았습니다.

인증·이메일 확인 API와 `workspace/` 경로는 실제 서버를 사용합니다. 기존 개요·프로필과 컴포넌트 갤러리는 **예시 데이터를 사용하는 UI 미리보기**입니다. 미리보기의 콘텐츠 검토·오늘 계획·학습 기록 메뉴는 실제 아동 선택 진입점을 제공합니다. 미리보기의 별이·역할·수치는 실제 로그인 계정의 아동·권한·성과를 나타내지 않습니다. 실제 기능은 내 계정의 역할별 진입 버튼으로 엽니다. 승인 대기 계정의 로그인 성공은 아동 접근 권한을 부여하지 않습니다.

## 인증 API 연결

백엔드 소스·실행 Swagger와 `C:\r2026\emotion-friend\docs\backend\AUTH_IMPLEMENTATION.md`, `MEMBERS_AND_CHILDREN.md`를 기준으로 합니다. 과거 Core OpenAPI 스냅샷과 현재 계약이 다릅니다.

| 동작 | API | 요청 / 처리 |
| --- | --- | --- |
| 가입 신청 | `POST /api/v1/auth/signup` | `email`, `displayName`, `password`, `requestedRole`; 201 응답 후 로그인 안내 |
| 로그인 | `POST /api/v1/auth/login` | `loginId`, `password`; 반환된 `credential.accessToken`으로 본인 조회 |
| 내 계정 | `GET /api/v1/me` | Bearer; 실제 계정 상태 표시 |
| 토큰 갱신 | `POST /api/v1/auth/refresh` | `refreshToken`만 전송; Bearer 없음; 응답 토큰으로 회전 |
| 로그아웃 | `POST /api/v1/auth/logout` | 같은 세션의 Bearer + `refreshToken`; 204 확인 후 브라우저 자격 제거 |

- 가입 신청 역할은 보호자(`GUARDIAN`) 또는 치료사(`THERAPIST`)입니다. 승인 역할은 서버 응답을 따릅니다.
- 비밀번호는 가입 15~128자, 로그인 1~128자, 이름은 80자, 이메일은 254자 이내입니다. 비밀번호를 trim하지 않습니다.
- 이메일 중복 확인 전용 API는 없으므로 중복 확인 버튼을 제거하고 가입의 409 `ACCOUNT_ALREADY_EXISTS` 응답을 안내합니다.
- 신규 회원은 `PENDING`, `role=null`, `emailVerified=false`입니다. 이메일 확인 후 운영자가 신청 역할을 검토합니다. 최초 운영자는 백엔드의 명시적인 bootstrap 설정으로만 생성하며 공개 가입으로 운영자 역할을 요청할 수 없습니다. 운영자는 `requestedRole=null`일 수 있습니다.
- 내 계정에서 이메일 확인 메일을 요청(202)하고, 받은 링크의 `/#/verify-email` 화면에서 같은 계정으로 로그인한 뒤 명시적으로 확인(204)합니다. 백엔드 EF_MAIL_ENABLED 설정으로 Resend 전송을 활성화합니다. 링크의 인증 정보는 fragment에서 읽은 뒤 주소창에서 제거하며 현재 탭의 sessionStorage/메모리에 최대 15분만 보관하고 완료 시 삭제합니다. localStorage와 로그에는 저장하지 않습니다.
- 오류 응답을 한국어 안내로 매핑하고 입력을 유지합니다. API 호출 중 중복 제출을 차단하며, 가입·로그인·refresh·로그아웃 요청은 자동 재시도하지 않습니다.

### 실행 서버

개발·preview 서버는 `/api`를 기본 `http://127.0.0.1:8080`으로 프록시합니다. 브라우저에서 같은 출처를 호출하므로 현재 CORS 비활성 백엔드 설정을 바꾸지 않습니다. 대상 변경 시 `.env.example`을 참고해 `.env.local`을 만들고 Vite를 재시작하세요.

```dotenv
EF_API_TARGET=http://127.0.0.1:8080
VITE_API_BASE_URL=/api/v1
```

프로덕션 정적 빌드에는 Vite 개발 프록시가 포함되지 않습니다. 이 프로젝트의 `vercel.json`은 `/api/:path*`를 `https://my-expression-friend-api.onrender.com/api/:path*`로 전달하고 API 응답에 `Cache-Control: no-store`를 설정합니다. Vercel 환경변수는 `VITE_API_BASE_URL=/api/v1`로 지정한 뒤 재배포합니다. 브라우저가 프론트와 같은 출처로 요청하므로 현재 CORS 비활성 백엔드와 연결할 수 있습니다. Render 직접 주소를 `VITE_API_BASE_URL`에 넣으면 이 프록시를 사용하지 않으므로 별도 CORS 허용이 필요합니다. 백엔드 호스트가 바뀌면 `vercel.json`의 destination도 변경합니다. DB·JWT 키는 프런트 환경 변수에 넣지 않습니다.

### 로그인 상태 유지

- 기본 로그인은 액세스·리프레시 토큰을 메모리에만 보관합니다. 새로고침하거나 창을 닫으면 다시 로그인합니다. 비밀번호는 앱 저장소에 저장하지 않습니다.
- 로그인 상태 유지를 선택하면 **리프레시 토큰만** `localStorage`의 `emotion-friend.auth.v1`에 저장합니다. 액세스 토큰·회원 정보는 저장하지 않습니다. 서버가 토큰을 JSON으로 반환하는 현재 계약에 맞춘 구현이며 HttpOnly 쿠키 방식은 아닙니다.
- 복원 시 refresh 1회 → `/me`로 확인합니다. Web Locks로 같은 출처의 여러 탭 요청을 직렬화하고 잠금 안에서 최신 리프레시 값을 다시 읽습니다. Web Locks 또는 저장소를 사용할 수 없으면 상태 유지 로그인을 거부하고 선택 해제를 안내합니다.
- 갱신 응답 유실·실패 시 리프레시를 재전송하지 않고 저장된 세션을 제거해 재로그인을 요구합니다. 서버 세션의 절대 만료는 최대 30일이며 갱신으로 연장하지 않습니다.
- 다른 탭의 로그아웃·로그인 교체는 storage 이벤트로 반영합니다. 통신 실패로 로그아웃이 확인되지 않으면 계정 화면에서 명시적으로 다시 시도할 수 있습니다.

## 회원·역할, 아동·동의·연결 관리

- `ACTIVE + emailVerified + 승인된 role`을 확인한 뒤 역할별 실제 화면을 제공합니다. 운영자에게 아동 조회 메뉴를 주지 않고, 치료사에게 보호자 관리 메뉴·회원 관리 메뉴를 주지 않습니다. 직접 주소로 접근해도 허용되지 않은 API를 호출하지 않습니다. 서버도 매 요청 권한을 검사합니다.
- 아동별 목록 응답의 `capabilities`를 확인합니다. `VIEW_PROFILE`, `EDIT_PROFILE`, `MANAGE`를 구분하고 미등록·철회된 아동 ID의 데이터는 표시하지 않습니다. 화면 재진입·새로 확인·브라우저 focus 때 권한과 상태를 다시 조회하며 403/404 등 실패 시 이전 데이터를 제거합니다.
- 아동 등록은 `guardianRelationshipConfirmed=true`를 별도로 확인하고 서버가 소유자를 정합니다. 가명은 40자 이내이며 현재 서버가 받는 성별·연령 구간·언어·도움 값만 제공합니다. 선택 정보는 항목당 최대 20개, 각 256자까지입니다.
- 프로필 PUT에 현재 `expectedProfileVersion`을 보내며 409 충돌 시 덮어쓰지 않습니다. 치료사 화면에는 저장 동작이 없습니다.
- 동의는 서버의 6개 목적·현재 안내 버전과 실제 동의 기록으로 표시하며 초기값은 기본 거부입니다. 전체 안내·보관 정책은 서버의 짧은 목적 요약과 별도로 운영 게시가 필요합니다. 기본 동의 철회 시 치료사 연결·미완료 초대가 철회되고 재동의만으로 자동 복구되지 않음을 설명합니다.
- 초대 202는 접수이며 회원 존재·메일 도착·연결 성공을 뜻하지 않습니다. 치료사는 받은 초대의 최소 정보만 보고 실제 관계 확인 체크와 재인증 후 수락합니다. 수락 후 권한은 프로필·요약 조회이며 콘텐츠 승인·동의·연결 관리 권한을 자동 부여하지 않습니다.
- 운영자 변경에는 검토 사유·근거 식별자·재인증이 필요합니다. 신청 역할 승인, 반려, 정지, GUARDIAN/THERAPIST 간 역할 변경만 제공하며 운영자 자신·다른 운영자는 변경할 수 없습니다. 이메일 확인 전 승인은 비활성화합니다. 서버 상태 충돌과 소유 아동이 있는 보호자의 역할 변경 거부를 처리합니다.
- 아동 비활성화는 접근·연결 차단이며 물리적인 정보 삭제 완료로 표시하지 않습니다. 아동 기기 연결과 AI 생성·발행 연동은 후속 범위입니다.

## 콘텐츠 검토·학습 세션·결과·기록

현재 백엔드의 `LEARNING_MANAGEMENT.md`, `LearningController`·`LearningContracts`를 기준으로 연결했습니다. 기존 디자인 PDF의 전체 원고·미디어 승인과 현재 서버의 주제·요약 확인은 서로 다른 작업이며, 현재 화면은 실제 서버가 제공하는 범위만 다룹니다.

- 보호자와 수락된 치료사는 아동의 `VIEW_SUMMARY` 권한으로 주제·요약을 조회하고 확인·보류합니다. 치료사에게 전역 `CONTENT_REVIEW` 권한이 없어도 현재 API 계약의 주제·요약 검토는 가능합니다. 기본 목록은 미확인·보류이고 확인 완료는 별도 필터에서 조회합니다. 한 번에 최대 5개를 원자 처리하며, 버전 충돌 시 상태를 다시 조회합니다. 확인 완료를 발행 승인으로 표시하지 않습니다.
- 운영자는 학습 API를 호출하지 않습니다. 관리 보호자의 세션 시작·복원은 `MANAGE`가 필요합니다. 신규 201과 기존 세션 복원 200을 모두 처리합니다. 준비되지 않은 자료의 `MATERIAL_NOT_READY`를 안내하며 자동 콘텐츠나 합성 발행 데이터를 앱에 삽입하지 않습니다.
- 세션 상세의 5슬롯·완료·별은 서버 값을 사용합니다. 별을 수동 지급하거나 기록을 수정·삭제하는 동작은 없습니다. 완료 요청에는 확정 참조·입력 버전·실제 선택 경로·마지막 장면·감정·session/world revision·clientCommitId만 전송하고 서버가 완료와 별을 정합니다.
- 보호자용 「실행 결과 연결」의 접힌 상세에서 직접 입력을 아동 확인 후 확정하고, **외부 학습 실행 화면에서 받은 식별자**로 완료를 연결할 수 있습니다. 원문과 확정 참조는 브라우저 저장소에 남기지 않습니다. 참조 만료·서버 재시작 시 최신 입력 버전을 확인하고 더 큰 버전으로 재확정합니다. 이야기 재생 API가 없어 선택지·경로를 임의 생성하지 않습니다. 이 기능은 현재 성인 인증 adapter이며 아동 기기 학습 화면을 대신하지 않습니다.
- 응답 유실 시 입력을 잠그고 같은 Idempotency-Key·본문·clientCommitId를 사용해 수동으로 결과를 재확인합니다. 별을 낙관적으로 올리지 않습니다. 슬롯의 저장된 receipt를 직접 복구할 수도 있습니다. receipt 누적 값은 수락 당시 스냅샷으로 표시하고 최신 누적 값은 세션 GET으로 다시 확인합니다. 보상 날짜 만료 뒤 신규 완료는 거절되어도 기존 receipt는 조회합니다.
- 목록 재진입·focus·새로 확인 시 아동 접근을 다시 검사합니다. 세션 응답이 선택한 아동과 일치하는지, receipt의 세션·계획·슬롯이 일치하는지 검사하고 잘못된 응답을 표시하지 않습니다. 접근 철회·조회 실패 시 이전 데이터를 제거합니다.
- 결과는 수락된 receipt만 표시합니다. 전체 기록은 서버 cursor 순서를 유지하며 기간 집계와 별도입니다. 집계 날짜 입력은 **한국 시간의 시작일·종료일 포함**을 UTC `from` 포함·`to` 제외로 변환하며 최대 366일입니다. 기본값은 서버의 최근 30일입니다. 인식·도움 미수집과 진단 점수가 아니라는 제한을 한국어로 표시하고 snapshot hash를 확인할 수 있습니다.

실제 생성기·독립 검수·발행 시스템, 콘텐츠 재생·캐릭터 반응, 아동 기기 인증은 백엔드에 아직 연결되지 않았습니다. 빈 DB에서는 검토·세션·기록이 비어 있거나 시작이 거절되는 것이 정상입니다. 이 웹 구현이나 합성 브라우저 검증을 실제 생성·발행·학습 재생의 종단 검증으로 해석하지 않습니다.

### 민감 작업과 재시도

재인증은 현재 세션의 비밀번호를 `/auth/reauthenticate`로 검증합니다. 보호자 초대·동의·아동 비활성화, 치료사 수락, 운영자 변경에서 수행하며 동의 본문에는 같은 세션에서 받은 `guardianVerificationRef`를 넣습니다. 비밀번호 오류의 401은 액세스 만료와 구분하여 무조건 로그아웃하거나 재시도하지 않습니다.

도메인 쓰기는 작업별 `Idempotency-Key`를 생성합니다. 응답 유실 시 입력을 잠그고 **같은 키·같은 본문**으로 결과를 재확인할 수 있습니다. 자동 재전송하지 않습니다. 내용 변경이나 새로고침 전에 현재 목록을 확인하도록 안내하며, 재인증·권한이 변경되어 재생할 수 없으면 상태 조회 후 새로 검토합니다. 민감한 작업 본문과 재인증 증빙은 메모리에만 보관합니다.

## 구성

```text
src/styles/tokens.css         색상, 간격, 모서리, 폰트, 레이아웃 기준
src/components/ui/           Button, TextField, SelectField, TextArea, Checkbox,
                             Card, PageHeader, Alert, Badge, Spinner,
                             LoadingState, Skeleton, EmptyState, ErrorState
src/components/layout/       AppShell, AuthLayout
src/components/ErrorBoundary.tsx  예상하지 못한 화면 렌더링 오류
src/api/client.ts            JSON 요청·15초 제한·오류 안내 (자동 재시도 없음)
src/auth/                    인증 계약, 토큰 회전·저장·여러 탭 동기화, 인증 상태
src/workspace/               역할별 실제 화면, 아동별 권한, 재인증·멱등 쓰기, 동의·연결 관리
src/hooks/usePreviewAction.ts 로컬 미리보기의 중복 실행 차단 및 타이머 정리
src/pages/                   공통 UI 적용 예시
```

공통 컴포넌트는 `src/components/ui`에서 가져오며 네이티브 HTML 속성을 지원합니다. 버튼은 기본 `type="button"`이고 `loading` 동안 비활성화됩니다. 입력은 고유 ID와 라벨·도움말·오류 메시지를 연결합니다. 오류 알림은 `role="alert"`, 로딩은 `role="status"`를 사용합니다.

## 디자인 기준

사용자가 제공한 `C:\r2026\FINAL 02 · 보호자·치료사용 웹` PDF 내보내기, UI baseline v1 (2026-10-21)을 기준으로 구현했습니다. Figma 원본은 연결 도구의 권한 오류로 조회하지 못했습니다.

- Clinical Light: 주색 `#3a6db0`, 배경 `#fbfcfd`, 텍스트 `#18212f`, 240px 사이드바, 최대 1080px 본문.
- 기본 글꼴은 사용자 요청에 따라 Pretendard로 변경했습니다. 자체 제공 OTF로 사용 중인 400·500·600·700 굵기를 표시합니다. 해당 글꼴은 SIL Open Font License 1.1을 따릅니다.
- 1440px 데스크톱 기준. 1024px 미만에서 상단 메뉴로 전환하여 834px 기준을 포함합니다. 상세 입력은 한 열로 배치하고 글자 크기를 유지합니다. 600px 미만에서도 가로 넘침을 방지합니다.
- 로그인 장식은 PDF의 그라데이션·반투명 도형을 CSS로 구성했습니다. 내비게이션 아이콘은 일반 선형 SVG이며 Figma 원본 에셋을 추출한 것이 아닙니다.
- 오류·성공·경고 색상과 움직임은 PDF의 기본 스타일을 확장한 공통 상태 토큰입니다. 동작 줄이기 설정을 지원합니다.
- 목적별 동의·철회, 회원 승인·반려·정지·역할 변경, 치료사 초대·수락·거절·연결 종료, 아동 비활성화와 주제·요약 검토는 공통 모달 확인창을 사용합니다. 배경 조작·스크롤을 막고 키보드 초점을 창 안에 유지하며, 취소·닫기·Escape로 돌아오면 열었던 버튼으로 초점을 복원합니다. 처리 중이나 완료 여부가 불확실한 요청은 창을 닫기 전에 같은 요청 결과 또는 현재 상태를 확인해야 합니다. 좁거나 낮은 화면에서는 창 내부만 스크롤합니다.

## 검증

`npm run build`, `npm run lint`와 Playwright 브라우저 검증을 사용합니다. UI·실패 경로 테스트는 합성 응답으로 격리하고 실제 서버 연결은 별도로 실행합니다.

```sh
# 다른 터미널에서 npm run dev -- --host 127.0.0.1 실행
node scripts/verify-ui.mjs
node scripts/verify-auth.mjs
node scripts/verify-workspace.mjs
node scripts/verify-learning.mjs
# 실행 중인 로컬 API와 합성 계정 1개를 생성하여 실제 왕복 검증:
node scripts/verify-auth.mjs --live
# 새 임시 PostgreSQL과 현재 빌드된 백엔드 JAR로 전체 역할 흐름 검증:
node scripts/verify-workspace-live.mjs
```

기본값은 `http://127.0.0.1:5173` (`verify-workspace.mjs`는 5175)이며 `UI_BASE_URL`로 변경할 수 있습니다. Playwright가 프로젝트에 설치되지 않았다면 `PLAYWRIGHT_MODULE`에 설치된 `playwright/index.mjs`의 절대 경로를 지정할 수 있습니다. 설치된 Edge를 사용할 때는 `PLAYWRIGHT_CHANNEL=msedge`를 설정합니다. 검증 결과와 화면 캡처는 Git에서 제외된 `tmp/verification/`에 저장됩니다.

`verify-learning.mjs`는 현재 학습 API 계약의 합성 응답으로 확인·보류·상태 필터, 최대 5개 선택, 폐기 버전·잘못된 응답, 자료 미준비, 시작 201·복원 200, 확정만으로 별 미지급, 완료 응답 유실·같은 키 재전송, receipt 스냅샷·복구, 보상 날짜 만료, 5슬롯 순차 완료·최대 별 5개, 기록 페이지 이동·기간 변환, 치료사/운영자 경계, 다른 아동의 세션·권한 철회, 모바일 너비를 검사합니다. 실제 운영 DB나 콘텐츠 생성·발행은 이 검증에서 사용하지 않습니다.

실제 연결 검증은 가입 201 → 로그인·본인 조회 200 → 회전 refresh 200 → 로그아웃 204 → 기존 JWT 조회 401을 확인합니다. 신규 계정은 계속 PENDING이며 운영자 승인·DB 직접 변경을 하지 않습니다. 계정 삭제 API가 없어 `--live`의 합성 검증 계정은 DB에 남습니다. 응답 토큰·비밀번호는 로그나 검증 JSON에 기록하지 않습니다.

`verify-workspace.mjs`는 브라우저별 합성 응답으로 역할 경계·프로필 버전 충돌·잘못된 재인증·불확실 응답의 같은 키 재생·동의 철회 후 화면 제거를 검사합니다. `verify-workspace-live.mjs`는 별도 PostgreSQL 55447·API 18080·프런트 15175를 시작하고 종료합니다. 기존 애플리케이션 DB를 사용하지 않습니다. 격리된 발송 대기함만 테스트용 메일 어댑터로 복호화하여 실제 이메일 확인 API를 검증하며, 외부 메일 도달을 검증한 것은 아닙니다. 이메일 확인·운영자 승인·아동 등록·동의·치료사 수락·권한 철회·역할 변경·정지를 실제 API로 검사합니다. 역할·동의를 SQL로 조작하지 않습니다.

격리 검증은 로컬 PostgreSQL 17, Java 21, 현재 빌드된 백엔드 JAR가 필요합니다. 설치 경로는 스크립트 기본값 또는 `EF_TEST_POSTGRES_BIN`, `EF_TEST_JAVA`, `EF_TEST_BACKEND_JAR`로 지정합니다. 종료된 임시 DB 파일은 Git에서 제외한 `tmp/`에 남습니다. 부트스트랩 비밀번호·암호화 키·확인 토큰은 결과 파일에 남기지 않습니다.


## 이메일 확인 발송 연결

메일 API 키·발신 주소·웹 주소는 백엔드에만 설정합니다. Resend 도메인 인증 완료 후 백엔드에 EF_MAIL_ENABLED=true, EF_RESEND_API_KEY, EF_MAIL_FROM, EF_FRONTEND_BASE_URL을 공급합니다. 웹 주소는 이 리액트 앱의 HTTPS 기본 주소(로컬은 http://localhost:5173)이며 #/ 경로를 붙이지 않습니다. 프런트에 API 키를 넣지 않습니다.

프로덕션에서는 기존 안내대로 /api를 백엔드로 프록시하거나 API origin/CORS를 설정해야 합니다. 링크의 fragment는 웹 서버 요청 URL로 전달되지 않습니다. 메일 링크를 여는 것만으로 확인하지 않으며 ‘이메일 확인 완료’를 누르면 인증된 POST를 보냅니다. 새 메일을 요청하면 이전 링크는 무효화됩니다.

검증 스크립트: scripts/verify-email.mjs. UI_BASE_URL, PLAYWRIGHT_MODULE(외부 Playwright 모듈), PLAYWRIGHT_CHANNEL(예: msedge)을 지원합니다. 합성 API를 사용하며 실제 메일은 발송하지 않습니다. 기존 scripts/verify-workspace-live.mjs도 새 링크 흐름으로 갱신했습니다.

## 2026-11-05 foundation 이관 추가분

- 기준 웹 main d7c15059 / 백엔드 feat/backend-foundation b4391cd9.
- `/#/workspace/children/{childId}/agent`: 하루 5편 MOCK 제작 요청·상태·요약 검토 연결. 실제 GPT 호출 없음.
- `/#/workspace/children/{childId}/device`: 관리 보호자의 일회용 Unity 연결 코드. 최근 재인증이 필요할 수 있습니다.
- Agent 토큰/제공자 키를 VITE 변수에 넣지 않습니다. 브라우저는 foundation 성인 인증만 사용합니다.
- 개발 API는 기존 `EF_API_TARGET`, `VITE_API_BASE_URL` 설정을 따릅니다. 기본 `/api/v1`.
- `vercel.json`에는 팀의 기존 Render rewrite가 보존되어 있습니다. 배포 담당자가 대상 환경을 확인해야 합니다. 이번 작업에서 배포하지 않았습니다.
- 원고 요약 확인은 발행이 아닙니다. 새 Agent 원고는 의존 자산이 미연결인 DRAFT이며, 실제 아동 제공은 별도 기존 foundation 발행 요건을 만족해야 합니다.
- 정확한 lockfile로 `npm ci && npm run build && npm run lint`를 직접 검사한 뒤 통합하세요. 이번 환경에서는 기존 설치 React19.2/TS5.9/Vite7로 보조 타입 검사/번들링만 확인했습니다.
