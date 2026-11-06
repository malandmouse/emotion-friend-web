# 보호자 화면 디자인

보호자 Workspace는 `AppShell appearance="care"`와 `styles/care.css`를 사용한다. 기존 로그인·치료사·운영자 shell/권한은 유지한다. 상단에는 대시보드/AI설정/경험/제작을 두고 모든 기존 경로는 ‘전체 메뉴’에서 접근한다.

- `GuardianDashboard`: 기존 findChild/day-status/prototype-dashboard를 읽는 controller. `GuardianDashboardView`는 실제 데이터/예시 양쪽에서 사용하는 표현 전용 view다. 새 API·학습 점수·임의 별을 만들지 않는다.
- `ScenarioSettingsFields`/`DailyEventFields`: 기존 입력 name/선택지/제한을 공유한다. 실제 쓰기는 기존 ScenarioInputsPage의 ActionForm만 수행한다.
- `StoryPreviewCard`/`WorkflowSteps`: 기존 agent 결과/Day 상태의 화면 배치다. 제작/검토/음원/발행/불명 처리와 DTO는 그대로다.
- `design-preview/main.tsx`: 별도 예시 진입. 실제 useAuth/useResource/ActionForm을 mount하지 않으며 네트워크 요청 없이 예시 상태만 변경한다. 예시 주제는 실제 GPT 결과가 아니다.

## 예시 미리보기 빌드

기존 의존성이 설치된 frontend 폴더에서 다음을 실행한다. 필요하면 담당자가 `npm ci`로 lock 파일의 패키지를 먼저 설치한다.

```sh
node tools/build-design-preview.mjs /원하는/별도/출력폴더
python3 tools/serve-design-preview.py /원하는/별도/출력폴더/보호자\ 웹\ 디자인\ 미리보기.html --open
```

미리보기는 단일HTML에 폰트/코드를 포함하고 CSP `connect-src 'none'`으로 API 통신을 막는다. loopback5218에서 그 파일만 제공한다. 더블클릭으로도 볼 수 있다. 기존 서비스의 dist 폴더를 출력 대상으로 사용하지 않는다.

실제 앱은 기존 `npm run build`로 빌드한다. 제작·확정에 관한 실제 검증은 LIVE 비용 안내/기존 승인 흐름을 따라 별도로 수행한다. 디자인 재확인을 위해 유료 생성이나 기존 완료 초기화를 하지 않는다.

2026-11-06: TypeScript/ESLint/production build·예시4화면/390px·768px·실제 로컬4화면 읽기 조회를 확인했다. 기존9ActionForm 속성과14API 호출은 소스 비교에서 동일했다. 서버25/iPad를 재시작하지 않았고 실제 쓰기/유료 요청은 수행하지 않았다. 상세 근거는 현재 대화 outputs/guardian-web-design-20261106에 보존한다.

## 글자110% 보완

`:root:has(.care-shell)`에서만 `--care-font-scale:1.1`을 설정하고 공통 CSS의 기본값은1로 둔다. root에서 배율을 상속해 body portal 확인창도 동일하게 읽힌다. CSS `zoom`/transform으로 컴포넌트 전체를 확대하지 않는다. 모바일 상단/진행단계2열, 중간화면 메뉴 별도행, 제목/버튼 줄바꿈과 입력 아이콘 중앙 정렬을 적용했다. 실제46글자 표본과4화면×4너비의 가로/형제컴포넌트 겹침을 확인했다. 기능·API·Unity는 바꾸지 않았으며 자동배포 저장소/브랜치 확인 전 GitHub push는 하지 않는다.


## 2026-11-06 로컬 로그인 화면

`AuthLayout`의 선택적 `appearance="care"`로 로그인 화면만 보호자 스타일에 맞춘다. `AuthPage`의 로그인 분기에만 사용하며 회원가입·내계정·이메일확인 기본 레이아웃과 인증/요청 코드는 유지한다. 로그인의 루트 글자 배율도1.1이고 스타일은 `.auth-layout.auth-layout--care`에 한정한다.

로그인 HTML에 예시 대화 장식을 추가하지만 아동/학습 기록이나 실제 시나리오로 저장하지 않는다. 실제 로컬 Chrome의320/390/768/1024/1744px 빈 입력 오류 상태에서 가로 넘침/지정9그룹 겹침0, TypeScript/변경파일ESLint/프로덕션빌드를 확인했다. 새 실제 인증 제출/운영배포/iPad Safari 확인은 실행하지 않았다.
