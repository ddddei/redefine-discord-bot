# Codex 작업 지시서

## 작업 이름

관리자 웹 대시보드 MVP v1

## 목표

프로젝트 리디파인 디스코드 봇에 읽기 전용 관리자 웹 대시보드 MVP를 추가한다.

현재 봇은 Discord 안에서 참여자용 `/안내`, 운영자용 `/운영현황`, 포인트, 상점, 교환, 미션, 인증, 반응 승인, 운영 내보내기 기능을 제공한다. 하지만 Discord 채팅형 UI만으로는 운영자가 전체 상태를 한눈에 보기 어렵다.

이미 `docs/admin-dashboard-mvp-plan.md`에 관리자 웹 대시보드 MVP 설계 문서가 작성되어 있다. 이번 작업에서는 해당 설계 문서를 기반으로, 실제로 브라우저에서 확인 가능한 읽기 전용 `/admin` 대시보드를 구현한다.

핵심 목표:

- 봇 프로젝트 안에 간단한 관리자 웹 서버를 추가한다.
- `/admin` 페이지에서 운영 요약을 카드형으로 볼 수 있게 한다.
- 교환 대기, 인증 대기, 최근 포인트 로그, 미션 상태, 상점 상태, 반응 승인 기록을 조회할 수 있게 한다.
- 관리자 비밀번호로 보호한다.
- 기본값은 관리자 대시보드 비활성화로 둔다.
- 쓰기 기능은 구현하지 않는다.
- 기존 Discord 봇 기능은 깨지지 않게 유지한다.
- 새 Slash Command는 추가하지 않는다.
- Google Sheets 연동, PostgreSQL 연동은 구현하지 않는다.

## 참고 문서

먼저 아래 문서를 읽고 현재 설계 방향을 반영한다.

- docs/admin-dashboard-mvp-plan.md
- docs/operator-dashboard-guide.md
- docs/operation-guide.md
- README.md

## 현재 전제

현재 운영 데이터는 local JSON 기반 repository/store 구조를 사용한다.

예상 데이터:

- users
- pointTransactions
- redemptions
- missions
- submissions
- shopItems
- reactionApprovals

현재 운영자 기능:

- /운영현황
- /포인트관리
- /교환관리
- /인증관리
- /포인트로그
- /미션관리
- /상점관리
- /운영내보내기

현재 웹 대시보드는 아직 구현되어 있지 않다.

## 중요 구현 원칙

### 1. 읽기 전용으로 구현한다

이번 MVP에서는 아래 기능만 제공한다.

- 운영 요약 조회
- 교환 대기 목록 조회
- 인증 대기 목록 조회
- 최근 포인트 로그 조회
- 미션 상태 조회
- 상점 상태 조회
- 반응 승인 기록 조회
- 내보내기 안내 표시
- 운영 체크리스트 표시

이번 작업에서 아래 기능은 구현하지 않는다.

- 교환 승인/거절/완료
- 인증 승인/반려
- 포인트 지급/차감
- 미션 추가/수정/삭제
- 상점 항목 추가/수정/삭제
- Google Sheets 연동
- PostgreSQL 연동
- 관리자 계정 관리
- OAuth 로그인

### 2. 새 npm dependency는 가급적 추가하지 않는다

먼저 현재 `package.json`을 확인한다.

- express가 이미 설치되어 있으면 express를 사용해도 된다.
- express가 없다면 Node 기본 `http` 모듈로 구현한다.
- package.json, package-lock.json 수정은 가능하면 피한다.
- 새로운 의존성 추가가 반드시 필요하다고 판단되면 작업 전에 이유를 요약하고, 최소 변경으로 진행한다.

추천: 이번 MVP는 Node 기본 `http` 모듈로 구현한다.

### 3. 기존 봇 실행을 깨지 않는다

현재 Discord 봇이 Railway에서 정상 실행 중이다.

주의:

- 기존 `src/index.js`의 봇 로그인 흐름을 깨지 않는다.
- 웹 서버 오류가 봇 전체 종료로 이어지지 않게 한다.
- 관리자 대시보드가 비활성화되어도 봇은 정상 실행되어야 한다.
- 포트는 `process.env.PORT`를 우선 사용한다.
- 로컬 기본 포트는 3000 또는 8787 등을 사용할 수 있다.
- 웹 서버 시작 실패는 `console.warn`으로 처리하고 봇 실행은 유지한다.

### 4. 기본값은 비활성화

환경변수:

- ADMIN_DASHBOARD_ENABLED=false
- ADMIN_DASHBOARD_PASSWORD=
- ADMIN_DASHBOARD_TITLE=리디파인 운영 대시보드

동작:

- `ADMIN_DASHBOARD_ENABLED`가 `"true"`일 때만 `/admin` 서버를 활성화한다.
- `ADMIN_DASHBOARD_PASSWORD`가 비어 있으면 관리자 페이지를 활성화하지 않는다.
- 비활성화 상태에서는 봇만 실행된다.
- `.env` 파일은 수정하지 않는다.
- `.env.example`에 placeholder만 추가한다.

### 5. 관리자 인증

초기 MVP에서는 간단한 HTTP Basic Auth 또는 단일 비밀번호 방식으로 구현한다.

권장:

- HTTP Basic Auth 사용
- username은 `admin`으로 고정하거나 아무 값이나 허용
- password는 `ADMIN_DASHBOARD_PASSWORD`와 일치해야 함

주의:

- API endpoint도 동일하게 인증 보호한다.
- 인증 실패 시 401 응답.
- 비밀번호를 로그에 남기지 않는다.
- 실제 비밀번호를 코드나 문서에 작성하지 않는다.

### 6. 개인정보 최소 표시

관리자 페이지이지만 개인정보는 과도하게 표시하지 않는다.

기본 표시:

- 사용자 표시명 또는 userId
- 필요 시 userId 일부만 표시
- Discord 멘션 형태는 웹에서는 그대로 노출하지 않아도 된다.

금지:

- 토큰
- 실제 환경변수
- 민감한 개인정보
- 불필요하게 긴 내부 ID 전체 노출

단, 운영 확인을 위해 신청 ID/제출 ID/거래 ID는 필요한 범위에서 표시 가능하다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

- src/index.js
- src/adminServer.js
- src/adminDashboard.js
- src/adminApi.js
- src/adminAuth.js
- src/pointsRepository.js
- src/pointsStore.js
- src/logging.js
- public/admin/index.html
- public/admin/admin.css
- public/admin/admin.js
- scripts/test-admin-dashboard-flow.js
- scripts/check-release.js
- .env.example
- docs/admin-dashboard-mvp-plan.md
- docs/operator-dashboard-guide.md
- docs/operation-guide.md
- docs/prelaunch-qa-checklist.md
- README.md
- prompts/codex/admin-dashboard-mvp-v1.md

새 파일 생성 권장:

- src/adminServer.js
- src/adminApi.js
- src/adminAuth.js
- public/admin/index.html
- public/admin/admin.css
- public/admin/admin.js
- scripts/test-admin-dashboard-flow.js

## 작업 1. 관리자 서버 추가

`src/adminServer.js`를 생성한다.

역할:

- 관리자 대시보드 서버 시작
- `/health` 응답
- `/admin` 페이지 제공
- `/admin/` 정적 파일 제공
- `/api/admin/summary` 제공
- `/api/admin/redemptions` 제공
- `/api/admin/submissions` 제공
- `/api/admin/point-transactions` 제공
- `/api/admin/missions` 제공
- `/api/admin/shop-items` 제공
- `/api/admin/reaction-approvals` 제공

함수 후보:

- startAdminServer(options)
- isAdminDashboardEnabled()
- getAdminDashboardPort()

동작:

- `ADMIN_DASHBOARD_ENABLED !== "true"`면 서버 시작하지 않음
- `ADMIN_DASHBOARD_PASSWORD`가 없으면 서버 시작하지 않음
- 서버 시작 실패 시 `console.warn` 처리
- 봇 실행 자체를 죽이지 않음

## 작업 2. index.js에서 관리자 서버 시작

`src/index.js`에서 봇 시작 로직을 유지하면서 관리자 서버를 선택적으로 시작한다.

주의:

- 실제 프로젝트의 module 방식에 맞춘다.
- repository 인스턴스가 있다면 재사용한다.
- 없다면 기존 store/repository helper를 admin server 내부에서 안전하게 생성한다.
- 봇 로그인 흐름을 변경하지 않는다.
- 관리자 서버가 꺼져 있거나 실패해도 봇은 정상 실행되어야 한다.

## 작업 3. 관리자 API 구현

`src/adminApi.js`를 생성한다.

필요 함수:

- buildAdminSummary(repository)
- listPendingRedemptions(repository, limit)
- listPendingSubmissions(repository, limit)
- listRecentPointTransactions(repository, limit)
- listMissionStatus(repository, limit)
- listShopItemStatus(repository, limit)
- listRecentReactionApprovals(repository, limit)

summary 응답에 포함할 값:

- usersCount
- pointTransactionsCount
- todayPointTransactionsCount
- todayEarnedPoints
- pendingRedemptionsCount
- pendingSubmissionsCount
- activeMissionsCount
- activeShopItemsCount
- todayReactionApprovalsCount

주의:

- 데이터가 없으면 0 또는 빈 배열 반환
- local JSON 구조가 다르더라도 안전하게 처리
- repository helper가 없으면 기존 데이터 접근 방식에 맞춰 최소 helper 추가
- API에서 오류가 나도 JSON error 응답을 반환

## 작업 4. 관리자 인증 구현

`src/adminAuth.js`를 생성한다.

필요 함수:

- isAdminAuthConfigured()
- requireAdminAuth(req, res)
- parseBasicAuthHeader(req)
- safeComparePassword(input, expected)

동작:

- Basic Auth header 검사
- 비밀번호가 맞으면 통과
- 틀리면 401 + `WWW-Authenticate` header 반환
- 비밀번호 비교는 가능하면 `timingSafeEqual` 사용
- 환경변수 값은 로그로 출력하지 않음

## 작업 5. 관리자 페이지 UI 구현

아래 파일을 생성한다.

- public/admin/index.html
- public/admin/admin.css
- public/admin/admin.js

디자인 방향:

- 외부 라이브러리 없이 HTML/CSS/JS로 구현
- 모바일에서도 읽기 가능
- 어두운 배경 + 카드형 레이아웃
- 과하게 화려하지 않게
- 운영자가 빠르게 볼 수 있게 숫자와 상태 중심

화면 구성:

1. 상단 헤더
   - 리디파인 운영 대시보드
   - 마지막 갱신 시간
   - 새로고침 버튼

2. 운영 요약 카드
   - 사용자 수
   - 오늘 포인트 거래
   - 오늘 지급 포인트
   - 교환 대기
   - 인증 대기
   - 활성 미션
   - 활성 상점 항목
   - 오늘 반응 승인

3. 처리 필요 섹션
   - 교환 대기
   - 인증 대기

4. 최근 운영 로그 섹션
   - 최근 포인트 로그
   - 최근 반응 승인

5. 운영 상태 섹션
   - 미션 상태
   - 상점 상태

6. 내보내기 안내
   - `/운영내보내기` 사용법

7. 운영 체크리스트
   - 운영 전/중/후 확인 항목

주의:

- 화면이 비어 있으면 “현재 대기 항목이 없습니다” 표시
- API 실패 시 “데이터를 불러오지 못했습니다” 표시
- 너무 긴 ID는 CSS 또는 JS에서 줄임 처리
- 새로고침 버튼은 API를 다시 호출

## 작업 6. API fetch 연결

`public/admin/admin.js`에서 아래 endpoint를 호출한다.

- `/api/admin/summary`
- `/api/admin/redemptions?status=pending&limit=10`
- `/api/admin/submissions?status=pending&limit=10`
- `/api/admin/point-transactions?limit=10`
- `/api/admin/missions?limit=10`
- `/api/admin/shop-items?limit=10`
- `/api/admin/reaction-approvals?limit=10`

주의:

- 모든 API는 같은 Basic Auth 세션으로 접근 가능해야 한다.
- fetch 실패 시 화면에 안내
- 로딩 상태 표시
- JSON 파싱 오류 방어

## 작업 7. 문서 보강

### README.md

보강 내용:

- 관리자 웹 대시보드 MVP가 추가되었다는 점
- 기본값은 비활성화라는 점
- Railway Variables에 아래 값이 필요하다는 점
  - ADMIN_DASHBOARD_ENABLED=true
  - ADMIN_DASHBOARD_PASSWORD=원하는_관리자_비밀번호
  - ADMIN_DASHBOARD_TITLE=리디파인 운영 대시보드
- 접근 경로: `/admin`
- 초기 MVP는 읽기 전용이라는 점
- 승인/거절/수정은 아직 Discord 명령어에서 처리한다는 점

### docs/admin-dashboard-mvp-plan.md

필요하면 구현 상태 섹션 추가:

- v1 구현 범위
- 읽기 전용 구현
- 향후 액션 기능은 후속 단계

### docs/operator-dashboard-guide.md

보강 내용:

- `/운영현황`은 Discord 안에서 간단 확인용
- `/admin`은 브라우저에서 한눈에 보는 용도
- 교환/인증 처리는 여전히 Discord 명령어로 진행

### docs/operation-guide.md

보강 내용:

- 운영 전 관리자 대시보드 접속 확인
- 운영 중 대시보드로 대기 건 확인
- 운영 후 `/운영내보내기`로 백업

### docs/prelaunch-qa-checklist.md

보강 항목:

- ADMIN_DASHBOARD_ENABLED=false일 때 서버가 열리지 않는지
- ADMIN_DASHBOARD_PASSWORD 없을 때 서버가 열리지 않는지
- `/admin` 접근 시 인증이 필요한지
- 비밀번호가 맞으면 대시보드가 보이는지
- summary 카드가 보이는지
- 대기 목록이 보이는지
- 데이터가 없어도 화면이 깨지지 않는지
- 기존 Discord 명령어가 정상 작동하는지

## 작업 8. 테스트 추가

`scripts/test-admin-dashboard-flow.js`를 생성한다.

테스트 항목:

- admin dashboard enabled 판별
- password 미설정 시 비활성 처리
- summary builder가 빈 데이터에서도 안전하게 동작
- pending redemptions list가 배열 반환
- pending submissions list가 배열 반환
- point transactions list가 배열 반환
- missions list가 배열 반환
- shop items list가 배열 반환
- reaction approvals list가 배열 반환
- Basic Auth parser 테스트
- 잘못된 비밀번호 reject
- 올바른 비밀번호 accept

성공 시 출력:

admin dashboard flow smoke test passed

## 작업 9. check-release 반영

`scripts/check-release.js`에 아래 테스트를 포함한다.

- node scripts/test-admin-dashboard-flow.js

기존 테스트는 유지한다.

## 작업 10. 검증

작업 완료 후 아래 명령어를 실행한다.

- node scripts/test-points-store.js
- node scripts/test-points-repository.js
- node scripts/test-point-activity-flow.js
- node scripts/test-admin-management-flow.js
- node scripts/test-operation-export-flow.js
- node scripts/test-participant-ux-flow.js
- node scripts/test-reaction-approval-flow.js
- node scripts/test-operator-hub-flow.js
- node scripts/test-admin-dashboard-flow.js
- npm run validate:data
- npm run test:questions
- npm run check:release

주의:

- 존재하지 않는 테스트 파일은 만들거나, 만들지 않았다면 생략 사유를 요약한다.
- npm run deploy는 실행하지 않는다.
- 새 Slash Command는 추가하지 않았으므로 npm run deploy는 필요 없다.
- Git commit, git push는 하지 않는다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

- 변경된 파일 목록
- 관리자 서버 추가 여부
- `/admin` 페이지 구현 여부
- Basic Auth 또는 비밀번호 보호 방식
- 추가된 API 목록
- 운영 요약 카드 구성
- 교환 대기 목록 구성
- 인증 대기 목록 구성
- 최근 포인트 로그 구성
- 미션/상점 상태 구성
- 반응 승인 기록 구성
- 내보내기 안내 구성
- 운영 체크리스트 구성
- `.env.example` 추가 항목
- README 보강 내용
- 문서 보강 내용
- 기존 Discord 명령어 유지 여부
- 새 Slash Command는 추가하지 않았다는 점
- npm run deploy는 실행하지 않았다는 점
- 테스트 결과 전체