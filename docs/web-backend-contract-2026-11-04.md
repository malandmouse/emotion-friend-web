# 보호자 웹 API 대응표와 검증 기록

## 확인 기준

- 프론트 `C:\r2026\emotion-friend-web`, `main`, 시작 HEAD `a0438972e0d394865b3d996bfdf06ebec36224d2`. 시작 시 Git 변경 없음. 적용할 저장소 `AGENTS.md` 없음.
- 백엔드 `C:\r2026\emotion-friend`, `feat/backend-foundation`. 시작 시 HEAD `e1d9f12b230a37d0391db53d0cc9e51d869ef0c7`과 작업 트리 변경을 관측했다. 이후 HEAD `b4391cd9a247e6952b1055152138e74dac66805f` 및 clean 상태를 확인했다. 두 커밋의 차이는 현재 권한·동의·발행·버전 재검증, 내부 ORIGINAL 완료 및 artifact 검증 경계와 관련 테스트다. 컨트롤러·공개 DTO·보안 설정 파일은 동일하다.
- 현재 컨트롤러·DTO·권한 검사·원장 코드와 `docs/backend/web-handoff-20261104` 6종, `CLIENT_BACKEND_BASELINE_2026-11-03.md`를 대조했다. 11월 3일 문서의 과거 HEAD와 v2 예시는 참고 자료다. 연결 대상 빌드 식별 정보와 해당 빌드의 OpenAPI는 제공되지 않았다. 아래 표는 로컬 소스 기준이다.

## 현재 웹과 공개 v1 계약

경로는 `/api/v1` 기준이다. `C`는 `/children/{childId}`, `S`는 `/learning-sessions/{sessionId}`, `L`은 `S/slots/{slot}`이다. 업무 요청은 성인 Bearer를 사용한다. 업무 화면의 기준은 `ACTIVE` + 이메일 확인 + 서버 승인 역할이다. `관리`는 소유 보호자의 `MANAGE`, `요약`은 보호자 또는 활성 연결 치료사의 `VIEW_SUMMARY`와 `CORE_PROFILE_LEARNING` 동의를 뜻한다. 치료사 프로필 접근에도 같은 동의가 필요하다.

| 화면·행동 | endpoint · 요청 → 응답 | 역할·범위 | 상태·주요 오류 | 복구 |
| --- | --- | --- | --- | --- |
| 가입 | `POST /auth/signup` `SignupRequest(email, displayName, password, requestedRole)` → 201 `MemberView` | 공개. 신청 역할은 보호자·치료사 | `PENDING`, 승인 역할 없음. `ACCOUNT_ALREADY_EXISTS`, `INVALID_SCHEMA`, `RATE_LIMITED` | 쓰기 자동 재전송 없음. 응답 유실 시 로그인으로 가입 여부 확인 |
| 로그인·내 계정 | `POST /auth/login` `LoginRequest(loginId,password)` → `Credentials(credential{accessToken,expiresAt},refreshToken)`. `GET /me` → `MemberView` | 로그인은 공개. `/me`는 본인 | `PENDING`, `ACTIVE`, `REJECTED`, `SUSPENDED`. `AUTH_REQUIRED`, `TOKEN_EXPIRED`, `RATE_LIMITED`. 정지 세션 인증 차단 | 로그인 쓰기는 자동 재전송 없음. `/me`로 권한 판정. 업무 화면에서 포커스·재접속 시 재확인 |
| 갱신·로그아웃 | `POST /auth/refresh` `RefreshRequest(refreshToken)` → `Credentials`. `POST /auth/logout` 같은 세션 Bearer + `RefreshRequest` → 204 | 갱신에 Bearer 없음. 로그아웃은 해당 세션 | 유효 갱신마다 토큰 회전. 소비 토큰 재사용은 세션 폐기. 실패·응답 유실 시 재로그인 | 동일 탭 동시 요청은 갱신 공유. 유지 로그인은 Web Locks 안에서 최신 저장 토큰 사용. 만료된 조회만 갱신 후 한 번 재시도. 쓰기 및 갱신 자동 재전송 없음. 로그아웃 통신 실패 시 명시적 재시도 |
| 이메일·재인증 | `POST /auth/email-verifications` → 202 `Accepted`, `POST /auth/email-verifications/confirm` `VerifyEmailRequest(verificationId,token)` → 204. `POST /auth/reauthenticate` `PasswordRequest(password)` → `Reauthentication(verificationRef,expiresAt)` | 로그인한 본인. 이메일 링크와 계정 일치. 재인증은 현재 세션에 결속 | `VERIFICATION_INVALID`, `AUTH_REQUIRED`, `REAUTH_REQUIRED`, `RATE_LIMITED` | 성공 후 `/me`. 비밀번호 오류를 액세스 만료와 구분. 자동 재전송 없음 |
| 운영자 회원 관리 | `GET /admin/members?status&cursor&limit` → 회원 페이지. `POST /admin/members/{id}/{approve,reject,suspend,role}` `ReviewRequest(reason,reviewReference)` 또는 `RoleChangeRequest`(+`role`) → `MemberView` | 활성 운영자. 변경에 최근 재인증. 승인 대상 이메일 확인 | 승인 대기·활성·반려·정지, 역할 변경. `ROLE_FORBIDDEN`, `MEMBER_STATE_CONFLICT`, `REAUTH_REQUIRED` | 쓰기 키 적용. 목록 재조회 |
| 아동 목록·등록 | `GET /children?cursor&limit` → `Children(items: Summary[],nextCursor)`. `POST /children` `CreateChildRequest(schemaVersion,pseudonym,profile,guardianRelationshipConfirmed)` → 201 아동 요약 | 소유 보호자 또는 동의가 유효한 활성 연결 치료사 목록. 등록은 보호자 | 빈 목록, 관계·입력 검증, `ROLE_FORBIDDEN`, `INVALID_SCHEMA` | 쓰기 키 적용. 새로고침·재접속 후 목록 확인 |
| 프로필·비활성화 | `GET C/profile` → `ProfileVersion`. `PUT C/profile` `UpdateProfileRequest(expectedProfileVersion,pseudonym,profile)` → `ProfileVersion`. `DELETE C` → 204 | `VIEW_PROFILE`로 조회, 소유 보호자 `EDIT_PROFILE`로 수정, 관리 + 재인증으로 비활성화 | `RESOURCE_STATE_CONFLICT`, `RESOURCE_NOT_FOUND`, `CHILD_ACCESS_DENIED`, `CONSENT_REQUIRED`, `REAUTH_REQUIRED` | 쓰기 키 적용. 충돌 시 최신 버전 확인. 비활성화 후 아동 목록 확인 |
| 목적별 동의 | `GET /consent-notices` → 목적·안내 버전 목록. `GET C/consents` → `Consents`. `POST C/consents` `ConsentChangeRequest(schemaVersion,scope,granted,noticeVersion,guardianVerificationRef)` → `Consent` | 동의 기록은 관리. 쓰기는 같은 세션의 재인증 증빙 필요 | 6개 목적별 부여·철회. `CONSENT_NOTICE_CHANGED`, `REAUTH_REQUIRED`, `VERIFICATION_INVALID`, 아동 범위 오류 | 쓰기 키 적용. 안내·동의 재조회. 기본 동의 철회 후 치료사 연결·미완료 초대는 재동의만으로 복구되지 않음 |
| 치료사 연결·초대 | `GET/POST C/therapist-invitations` → `SentInvitations` / `InvitationRequest(therapistEmail)` → 202 `Accepted`. `GET C/therapists` → `Therapists`. `DELETE C/therapist-invitations/{id}`, `DELETE C/therapists/{id}` → 204 | 보호자 관리. 초대는 최근 재인증과 기본 동의. 연결 해제는 해당 치료사 본인도 가능 | 대기·수락·거절·만료·취소. 202는 접수. `INVITATION_STATE_CONFLICT`, `CONSENT_REQUIRED`, 아동 범위·재인증 오류 | 쓰기 키 적용. 실제 지원되는 초대 취소·연결 해제만 제공. 연결·초대 재조회 |
| 받은 초대 | `GET /me/therapist-invitations` → `Inbox`. `POST /therapist-invitations/{id}/accept` `AcceptInvitationRequest` 또는 `.../decline` 빈 본문 → 204 | 활성 대상 치료사. 수락은 최근 재인증과 실제 관계 확인, 기본 동의 재검사 | `INVITATION_STATE_CONFLICT`, `RESOURCE_NOT_FOUND`, `CONSENT_REQUIRED`, `REAUTH_REQUIRED`. 수락 전 응답에 아동 ID·프로필 없음 | 쓰기 키 적용. 받은 초대와 연결 아동 목록 재조회 |
| 주제·요약 확인·보류 | `GET C/learning-material-summaries?status&cursor&limit` → `Page<SummaryItem>(childId,items,nextCursor)`. `POST C/learning-material-confirmations` `ConfirmationRequest(summaryIds[1..5], decision=CONFIRM/HOLD)` → 변경된 `Page<SummaryItem>` | 요약 권한. 별도 발행 권한을 부여하지 않음 | `UNCONFIRMED`, `ON_HOLD`, `CONFIRMED`. `STALE_DRAFT`는 이전·철회 요약, `RESOURCE_NOT_FOUND`는 대상 없음. `CONSENT_REQUIRED`, `IDEMPOTENCY_CONFLICT`. 동일 현행 요약의 결정에 `expectedVersion` 필드 없음 | 쓰기 키 적용. 원자 처리, 응답의 아동·선택 ID·결정 확인. 충돌 시 새 목록. 응답 유실 시 동일 요청 재시도 또는 GET으로 현재 필터·이력 확인 |
| 세션 시작·목록·상세 | `GET C/learning-sessions?status&cursor&limit` → `Page<SessionItem>`. `POST C/learning-sessions` `SessionStart(schemaVersion,deviceId)` → 201 신규 / 200 동일 기기 복원 `Session`. `GET S` → `Session` | 조회는 요약 권한. 시작은 관리 + 기본 동의. 이미 배정된 Day 1과 신규 시작 시 발행된 5개 슬롯 필요 | `ACTIVE`, `COMPLETED`. `MATERIAL_NOT_READY`, `RESOURCE_STATE_CONFLICT`, `STALE_WORLD_STATE`, `REWARD_WINDOW_EXPIRED`, 접근·동의 오류 | 쓰기 키 적용. 목록·상세에서 기존 결과 확인. 시작은 명시적 요청. 세션 취소 API 없음 |
| 입력 확정·완료 저장 | `POST L/confirmed-expressions` `ExpressionRequest(text,draftVersion,inputSource=TYPED,childConfirmed=true)` → 201 `Expression(confirmedExpressionRef,expiresAt,draftVersion)`. `POST L/finalize` `FinalizeRequest`(확정 참조, 입력 버전, 실제 경로·마지막 장면·감정, `ORIGINAL`, session/world revision, `clientCommitId`) → 200 `Receipt` | 관리 + 기본 동의. 기존 성인 관리 어댑터에서 실제 실행 결과 연결 | 참조는 15분 유효. `STALE_DRAFT`, `STALE_CHECKPOINT`, `STALE_WORLD_STATE`, `INVALID_BRANCH_PATH`, `CONTENT_HASH_MISMATCH`, `REWARD_WINDOW_EXPIRED`, `IDEMPOTENCY_CONFLICT`. 완료·별은 원장 성공으로만 표시 | 쓰기 키와 동일한 `clientCommitId`/본문. 원문과 미확인 요청은 메모리에서만 유지. 새로고침 후 기존 완료 조회. 현재 확정 참조나 최신 입력 버전 전용 GET 없음 |
| 완료 복구·기록·집계 | `GET L/receipt` → `Receipt`. `GET C/learning-records?cursor&limit` → `Page<Result>` (`learning-results`는 서버 별칭). `GET C/learning-summary?from&to` → `LearningSummary` | 요약 권한 및 현재 동의. 보상 기한 이후에도 수락된 receipt 조회 | 현재 세션 슬롯에 저장된 완료가 없으면 빈 상태. 저장된 receipt의 ID·세션·플랜·슬롯이 다르면 응답을 표시하지 않음. `RESOURCE_NOT_FOUND`, `CONSENT_REQUIRED`, `INVALID_SCHEMA` | 조회만 사용. 포커스·재접속·새로고침 후 재조회. 수락 시점 수치와 현재 세션 수치 분리. 미수집 항목은 0점으로 표시하지 않음 |

공통 오류는 서버의 `code`, HTTP 상태 및 `Retry-After`로 처리한다. 화면에는 자체 안내 문구를 표시한다. 서버가 보내는 오류 `details`나 원문을 출력하지 않는다. 표에서 ‘쓰기 키 적용’은 `Idempotency-Key`와 같은 본문으로 명시적 재시도가 가능하다는 뜻이다. 서버는 actor·method·path·key와 본문 지문을 확인하며, 기존 결과를 반환하기 전에도 현재 권한을 검사한다. 다른 본문은 `IDEMPOTENCY_CONFLICT`다. 취소된 브라우저 요청도 서버에서 저장됐을 수 있으므로 화면에 복귀하면 조회로 확인한다. 새로고침 이후에도 안전하게 같은 키를 재생할 수 있는 범위는 클라이언트에 해당 키·본문이 남아 있을 때로 한정된다.

## 공개 범위와 백엔드에 필요한 확인

| 기능 | 코드에서 확인한 범위 | 백엔드·운영 확인 사항 |
| --- | --- | --- |
| 전체 검수·아동 사용 승인·발행·배정 | `POST /core/validations/{id}/{full-review,child-use,publish}`는 `Evidence`, `ChildUse`, `Publish` → `evidenceId`. `POST C/core-plans`는 `Plan(dayIndex,timezone,publicationIds[5])` → `planId`. `POST /core/evidence/{id}/revoke`는 `Revoke(reason)` → 204. 전체 검수·발행은 별도 `ContentAuthority`가 필요하고 기본 거절, 아동 사용 허용도 기본 비활성. 보호자 요약 화면은 이 경로들을 호출하지 않는다 | 운영에서 검수 가능한 사람의 범위, 검증된 원고·분기·미디어를 공급하는 경로, 증거 버전·철회 상태와 반복 요청 처리. 보호자용 데이터는 최소 요약으로 제한 |
| 제작 작업 | `GenerationJobs`, `CurrentJobGuard`, `ArtifactAdmissionWorker`는 내부 경계다. 공개 제작 생성·상태·취소·capabilities REST 미확인 | 공개 경로, 요청·상태·결과 DTO, 실제 취소 가능 상태, 권한·동의·버전, 응답 유실과 `UNKNOWN` 이후 조회, 멱등 범위·보존 기간. 배포 전 source/settings 및 artifact 검증 정책 필요 |
| 카드·표현 확장 | `ExpressionCurrent` 등 내부 규칙. 공개 카드·확장·후보 조회 및 `AI_COMPOSED`/`NATURAL` 공개 완료 없음. 별도 보호자 승인 단계 없음 | 카드 요청·결과의 소비 권한, 선택 ref·버전·만료와 이전 후보 철회, 원문·기억 처리 목적 및 보관 정책. 재접속 후 현행 입력 버전·확정 참조를 원문 없이 조회할 수 있는지 확인 |
| 완료 후 반응·음성 | 공개 receipt에는 저장된 완료 정보가 있다. 내부 `OriginalCompletion`/`ReactionJobs`의 검수 반응 및 음성 예약은 운영 REST 경로와 결속 확인이 필요하다 | 동일 receipt에서 상태 조회와 명시적 합성 요청을 분리하는 경로와 DTO, `NOT_AVAILABLE`/`FAILED`/`UNKNOWN` 처리, receipt 키의 멱등·보존·재연결, 검수된 반응 ref/hash/화자·발행 버전 및 음원 제공 권한 |
| Unity 아동 실행 | `/child-sessions`, `/sessions`, `/daily-plans` 및 기기 연결 등은 별도 아동 자격과 계획 범위를 사용하는 공개 v1 어댑터. 웹의 성인 인증과 별개 | Unity 팀의 배포 대상 빌드와 런타임 계약. 성인 토큰이나 외부 서비스 키 없이 검증 |

실제 연결 전 공유 검증 서버 주소, 그 서버의 커밋·빌드 ID와 OpenAPI를 함께 확인해야 한다. 기존 overview·컴포넌트 등 예시 화면과 합성 브라우저 검사는 실제 생성·발행·플레이 성공의 근거가 아니다.

## 이번 검증

Playwright 합성 응답은 기존 `scripts/verify-*.mjs`의 격리된 브라우저에만 등록했다. 프론트는 루프백 Vite로 실행했고 API 프록시는 미사용 루프백 포트를 향하도록 지정했다. 실제 백엔드, 외부 제공자, Unity, 운영 DB, 실제 계정 시험은 `NOT_RUN`이다.

| 명령 | 결과 | 검증 범위 |
| --- | --- | --- |
| `npm run build`, `npm run lint`, `git diff --check` | PASS | TypeScript, Vite 번들, ESLint, diff 공백 검사 |
| `node scripts/verify-auth.mjs` | PASS 8그룹 | 승인 전 로그인, 동시·늦은 만료 응답의 단일 갱신, 다중 탭 회전, 갱신 응답 유실 후 재로그인, 저장 자동 재전송 방지, 로그아웃 전파 |
| `node scripts/verify-workspace.mjs` | PASS 9그룹 | 역할 제한, 프로필 버전 충돌, 치료사 동의 철회, 이동 시 재인증 요청 취소 및 후속 쓰기 차단, 동일 키 재생, 모달 포커스·키보드·모바일 |
| `node scripts/verify-learning.mjs` | PASS 17그룹 | 중복 제출 차단, 확인·보류·충돌, 지연 응답이 아동 전환 후 도착하는 경우, 재접속 중 동의 재검사, 원문·기억·원고·후보 비표시, 세션 및 receipt의 빈 상태·오류·복구, 새로고침·재접속이 조회만 수행함 |
| `node scripts/verify-email.mjs` | PASS 4그룹 | 이메일 링크 확인·만료·계정 오류·복구 |
| `node scripts/verify-ui.mjs` | PASS 6그룹 | 로딩·오류 UI, 포커스와 키보드 이동, 320~1440px 레이아웃 |
| 실제 빌드의 OpenAPI·서버 종단 시험 | NOT_RUN | 연결 대상 빌드·스냅샷 미제공. 기존 live 검사 옵션과 `verify-workspace-live.mjs` 미실행 |

합성 보고서와 스크린샷은 기존 Git 제외 경로 `tmp/verification/`에 생성했다. 브라우저 런타임은 설치된 Chrome을 사용했다.
