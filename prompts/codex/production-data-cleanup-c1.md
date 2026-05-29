# Codex 작업 지시서

## 작업 이름

운영 환경 데이터 정리 v1

## 목표

프로젝트 리디파인 디스코드 봇의 관리자 웹 대시보드 MVP가 배포되어 `/admin` 페이지에서 운영 데이터를 확인할 수 있게 되었다.

현재 `/admin` 페이지는 정상적으로 열리지만, 운영 환경에서도 `user_example`, `rd_example_pending`, `2030년`, `청년동 포인트 전환권 100P` 같은 예시 데이터가 운영 데이터처럼 보이고 있다.

이번 작업에서는 실제 운영 전 혼선을 줄이기 위해 다음 3가지를 정리한다.

1. 관리자 대시보드에 예시 데이터가 실제 운영 데이터처럼 노출되지 않게 처리한다.
2. Railway 운영 환경변수 문서를 정리한다.
3. 실제 운영 전 초기화/점검 가이드를 보강한다.

이번 작업은 운영 안정화 작업이며, 새 Slash Command나 쓰기 기능을 추가하지 않는다.

## 현재 전제

현재 프로젝트에는 아래 유형의 데이터 파일이 존재할 수 있다.

- data/points.example.json
- data/redemptions.example.json
- data/submissions.example.json
- data/missions.example.json
- data/shop-items.example.json
- data/*.local.json

example 파일은 테스트와 샘플 확인을 위한 데이터다.  
local 파일은 실제 운영 또는 로컬 테스트 데이터일 수 있다.

현재 문제는 관리자 대시보드에서 example 데이터가 실제 운영 데이터처럼 보일 수 있다는 점이다.

## 핵심 원칙

### 1. example 데이터는 운영 대시보드에서 기본적으로 제외한다

관리자 웹 대시보드 `/admin`과 `/api/admin/*` 응답에서는 example/demo/sample 데이터가 실제 운영 데이터처럼 보이지 않아야 한다.

제외 대상으로 볼 수 있는 예시:

- id에 `example`이 포함된 데이터
- userId에 `user_example`이 포함된 데이터
- 신청 ID가 `rd_example`로 시작하는 데이터
- 제출 ID가 `submission_example`로 시작하는 데이터
- 거래 ID가 `tx_example`로 시작하는 데이터
- mission ID가 `mission_example`로 시작하는 데이터
- item ID가 `item_example`로 시작하는 데이터
- 사유나 설명에 “예시”가 명확히 들어간 테스트 데이터
- 2030년처럼 명백히 샘플용 미래 날짜를 가진 데이터

단, 기존 테스트/검증을 위해 example 파일 자체를 삭제하지 않는다.

### 2. 테스트 데이터 파일은 유지한다

아래 파일들은 삭제하지 않는다.

- data/*.example.json
- test-questions.json
- FAQ/Knowledge 관련 테스트 데이터

기존 테스트가 example 파일을 사용한다면 그대로 유지한다.

이번 작업의 목표는 example 데이터를 제거하는 것이 아니라, **운영 관리자 대시보드에서 실제 데이터처럼 보이지 않게 하는 것**이다.

### 3. local 데이터는 커밋하지 않는다

`data/*.local.json`은 커밋하지 않는다.

이번 작업 중 로컬 테스트로 local 파일이 변경되거나 생성되면 커밋 대상에서 제외한다.

### 4. 기존 Discord 기능을 깨지 않는다

아래 기능은 그대로 유지한다.

- /안내
- /포인트
- /상점
- /교환
- /체크인
- /미션
- /인증
- /운영현황
- /포인트관리
- /교환관리
- /인증관리
- /포인트로그
- /미션관리
- /상점관리
- /운영내보내기
- 미션 인증 채널 반응 승인
- 관리자 웹 대시보드 `/admin`

### 5. 새 기능은 최소화한다

이번 작업에서는 아래 기능을 구현하지 않는다.

- Google Sheets 연동
- PostgreSQL 연동
- 웹에서 승인/반려/수정 기능
- 관리자 계정 관리
- 새 Slash Command
- 새로운 봇 명령어
- 앱 또는 별도 프론트엔드 프로젝트

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

- src/adminApi.js
- src/adminServer.js
- src/adminDashboard.js
- public/admin/admin.js
- public/admin/index.html
- public/admin/admin.css
- src/pointsRepository.js
- src/pointsStore.js
- src/logging.js
- scripts/test-admin-dashboard-flow.js
- scripts/check-release.js
- .env.example
- README.md
- docs/admin-dashboard-mvp-plan.md
- docs/operator-dashboard-guide.md
- docs/operation-guide.md
- docs/prelaunch-qa-checklist.md
- docs/production-data-reset-guide.md
- docs/railway-env-guide.md
- prompts/codex/production-data-cleanup-v1.md

새 문서 생성 권장:

- docs/production-data-reset-guide.md
- docs/railway-env-guide.md

## 작업 1. 관리자 대시보드 example 데이터 노출 방지

관리자 API에서 운영 데이터 목록과 요약을 만들 때 example/demo/sample 데이터를 제외한다.

대상 API:

- /api/admin/summary
- /api/admin/redemptions
- /api/admin/submissions
- /api/admin/point-transactions
- /api/admin/missions
- /api/admin/shop-items
- /api/admin/reaction-approvals

권장 구현:

- `src/adminApi.js`에 example 데이터 판별 helper를 추가한다.
- 또는 admin API 전용 filter helper를 만든다.

함수 후보:

- isExampleLikeValue(value)
- isExampleLikeRecord(record)
- filterOperationalRecords(records)
- buildExampleDataNotice(originalCount, filteredCount)

판별 기준 예시:

- 문자열에 `example` 포함
- 문자열에 `sample` 포함
- 문자열에 `demo` 포함
- id/userId/itemId/missionId/submissionId/redemptionId/transactionId가 example 계열
- 날짜가 2030년 이상인 명백한 샘플 데이터
- description/reason/title/name에 “예시”가 들어간 테스트성 데이터

주의:

- 너무 공격적으로 필터링해서 실제 운영 데이터까지 지우지 않도록 한다.
- 필터는 관리자 대시보드 조회용에 우선 적용한다.
- 기존 테스트 데이터나 example 파일 자체는 삭제하지 않는다.
- 실제 운영 데이터가 없으면 0건/빈 목록으로 표시한다.

## 작업 2. 대시보드 화면에 데이터 상태 안내 추가

관리자 대시보드 상단 또는 운영 요약 영역에 현재 데이터 상태를 짧게 표시한다.

권장 문구:

- 읽기 전용 데이터입니다.
- example 데이터는 운영 대시보드에서 제외됩니다.
- 현재 저장 방식: local JSON
- 실제 운영 전에는 Railway 환경변수와 초기 데이터 상태를 확인해 주세요.

너무 길게 넣지 말고, 작게 안내한다.

예시:

```txt
읽기 전용 · local JSON · example 데이터 제외
```

주의:

- 화면을 복잡하게 만들지 않는다.
- 운영자가 “왜 example 데이터가 안 보이지?”라고 헷갈리지 않게만 한다.

## 작업 3. 빈 데이터 표시 개선

example 데이터가 제외되면 실제 운영 전에는 대부분의 목록이 비어 있을 수 있다.

빈 상태 문구를 자연스럽게 수정한다.

예시:

교환 대기:

```txt
현재 교환 대기 항목이 없습니다.
실제 신청이 접수되면 이곳에 표시됩니다.
```

인증 대기:

```txt
현재 인증 대기 항목이 없습니다.
참여자가 /인증으로 제출하면 이곳에 표시됩니다.
```

최근 포인트 로그:

```txt
아직 표시할 포인트 로그가 없습니다.
체크인, 미션 승인, 교환 처리 후 기록이 표시됩니다.
```

미션 상태:

```txt
등록된 운영 미션이 없습니다.
운영 전 /미션관리 명령어로 미션을 등록해 주세요.
```

상점 상태:

```txt
등록된 운영 상점 항목이 없습니다.
운영 전 /상점관리 명령어로 항목을 등록해 주세요.
```

반응 승인 기록:

```txt
아직 반응 승인 기록이 없습니다.
미션 인증 채널에서 운영자가 승인/반려하면 이곳에 표시됩니다.
```

## 작업 4. 관리자 API 응답에 필터링 메타 정보 추가

가능하다면 API 응답에 필터링 메타 정보를 추가한다.

예시:

```json
{
  "data": [],
  "meta": {
    "exampleRecordsExcluded": 3,
    "storageMode": "local-json",
    "readOnly": true
  }
}
```

summary API에도 아래 값 중 가능한 것을 추가한다.

- exampleRecordsExcluded
- storageMode
- readOnly
- generatedAt

주의:

- 기존 프론트엔드가 깨지지 않도록 기존 필드는 유지한다.
- meta는 추가 필드로만 제공한다.
- 복잡하면 summary에만 meta를 추가해도 된다.

## 작업 5. .env.example 정리

`.env.example`에 운영 환경변수를 정리한다.

반드시 포함할 항목:

```env
# Discord Bot
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=

# Core Channels
LOG_CHANNEL_ID=

# Mission / Activity Review
MISSION_SUBMISSION_CHANNEL_ID=
ACTIVITY_REVIEW_CHANNEL_ID=
MISSION_REACTION_REWARD_POINTS=20
MISSION_APPROVE_EMOJI=✅
MISSION_REJECT_EMOJI=❌

# Point / Redemption
POINT_REDEEM_CHANNEL_ID=

# Admin Dashboard
ADMIN_DASHBOARD_ENABLED=false
ADMIN_DASHBOARD_PASSWORD=
ADMIN_DASHBOARD_TITLE=리디파인 운영 대시보드
```

주의:

- 실제 값은 넣지 않는다.
- 이미 존재하는 변수는 중복 없이 정리한다.
- 기존 변수명을 바꾸지 않는다.
- 코드에서 실제 사용하는 변수명을 기준으로 맞춘다.
- `POINT_REDEEM_CHANNEL_ID`가 코드에서 사용 중이라면 반드시 추가한다.

## 작업 6. README 운영 환경변수 섹션 보강

README.md에 아래 내용을 보강한다.

포함 내용:

- 관리자 대시보드 접속 경로: `/admin`
- Railway Public Domain 생성 후 `https://도메인/admin`으로 접속
- 관리자 대시보드는 기본 비활성화
- 활성화에 필요한 환경변수
- 로그/알림 채널 환경변수
- example 데이터는 대시보드에서 제외된다는 점
- 실제 운영 전 local 데이터 초기화 확인 필요

권장 설명:

```md
### 관리자 웹 대시보드

관리자 대시보드는 읽기 전용 운영 확인 페이지입니다.

Railway에서 Public Domain을 생성한 뒤 아래 주소로 접속할 수 있습니다.

https://Railway-도메인/admin

필수 환경변수:

- ADMIN_DASHBOARD_ENABLED=true
- ADMIN_DASHBOARD_PASSWORD=관리자_비밀번호
- ADMIN_DASHBOARD_TITLE=리디파인 운영 대시보드

운영 로그 채널:

- LOG_CHANNEL_ID
- ACTIVITY_REVIEW_CHANNEL_ID
- POINT_REDEEM_CHANNEL_ID

대시보드는 example 데이터가 실제 운영 데이터처럼 보이지 않도록 제외합니다.
```

## 작업 7. Railway 환경변수 가이드 문서 생성

새 문서 `docs/railway-env-guide.md`를 생성한다.

구성:

1. 문서 목적
2. Railway Variables 설정 위치
3. 필수 환경변수
4. 관리자 대시보드 환경변수
5. 채널/로그 환경변수
6. Public Domain 생성 방법
7. Redeploy 방법
8. 확인 순서
9. 문제 해결

포함할 내용:

### Railway Variables 위치

```txt
Railway 프로젝트 → 서비스 선택 → Variables
```

### Public Domain 생성

```txt
Railway 프로젝트 → 서비스 선택 → Settings → Networking → Public Networking → Generate Domain
```

### 관리자 대시보드 접속

```txt
https://생성된-Railway-도메인/admin
```

### 필수 변수

```env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
LOG_CHANNEL_ID=
ADMIN_DASHBOARD_ENABLED=true
ADMIN_DASHBOARD_PASSWORD=
ADMIN_DASHBOARD_TITLE=리디파인 운영 대시보드
```

### 권장 변수

```env
MISSION_SUBMISSION_CHANNEL_ID=
ACTIVITY_REVIEW_CHANNEL_ID=
POINT_REDEEM_CHANNEL_ID=
MISSION_REACTION_REWARD_POINTS=20
MISSION_APPROVE_EMOJI=✅
MISSION_REJECT_EMOJI=❌
```

### 채널 ID 가져오는 방법

```txt
Discord 설정 → 고급 → 개발자 모드 ON
채널 우클릭 → 채널 ID 복사
```

### 알림 채널 권장 구조

```txt
LOG_CHANNEL_ID
- 기본 운영 로그
- fallback 로그
- 답변 실패 질문

ACTIVITY_REVIEW_CHANNEL_ID
- 미션 인증 검토
- 반응 승인/반려 처리 로그

POINT_REDEEM_CHANNEL_ID
- 교환 신청 알림
- 포인트 교환 처리 알림
```

## 작업 8. 운영 전 데이터 초기화 가이드 문서 생성

새 문서 `docs/production-data-reset-guide.md`를 생성한다.

구성:

1. 문서 목적
2. example 데이터와 운영 데이터의 차이
3. 운영 전 확인해야 할 데이터 파일
4. local JSON 파일 주의사항
5. 관리자 대시보드에서 확인할 것
6. Discord에서 확인할 것
7. 운영 전 최소 세팅 순서
8. 운영 시작 전 체크리스트
9. 운영 중 백업 주의사항

중요 안내:

- `data/*.example.json`은 삭제하지 않는다.
- `data/*.local.json`은 커밋하지 않는다.
- 실제 운영 전 관리자 대시보드에 example 사용자가 보이면 안 된다.
- `/admin`에서 교환 대기, 인증 대기, 포인트 로그가 실제 운영 데이터 기준으로 비어 있거나 정상 데이터만 보여야 한다.
- 실제 운영용 미션/상점은 `/미션관리`, `/상점관리`로 등록한다.
- 테스트용으로 생성한 local 데이터는 운영 전 정리한다.
- 운영 시작 후에는 `/운영내보내기`로 주기적으로 백업한다.

운영 전 체크리스트 예시:

```md
## 운영 시작 전 체크리스트

- [ ] Railway Variables에 필수 환경변수를 모두 입력했다.
- [ ] Public Domain을 생성했다.
- [ ] `/admin` 접속과 Basic Auth 로그인을 확인했다.
- [ ] 관리자 대시보드에 example 데이터가 보이지 않는다.
- [ ] `/운영현황`이 정상 작동한다.
- [ ] `/안내`가 정상 작동한다.
- [ ] `/미션관리`로 운영용 미션을 등록했다.
- [ ] `/상점관리`로 운영용 상점 항목을 등록했다.
- [ ] 미션 인증 채널에서 ✅/❌ 반응 승인을 테스트했다.
- [ ] 교환 신청 알림 채널을 확인했다.
- [ ] 운영 데이터 백업 방법을 확인했다.
```

## 작업 9. 기존 운영 문서 보강

### docs/operation-guide.md

추가 내용:

- 실제 운영 전 `/admin`에서 example 데이터가 보이지 않는지 확인한다.
- 운영자는 `/운영현황`과 `/admin`을 함께 확인한다.
- `/admin`은 읽기 전용이고 실제 처리는 Discord 명령어로 진행한다.
- 알림 채널 환경변수 3종을 확인한다.
  - LOG_CHANNEL_ID
  - ACTIVITY_REVIEW_CHANNEL_ID
  - POINT_REDEEM_CHANNEL_ID

### docs/prelaunch-qa-checklist.md

추가 항목:

- 관리자 대시보드에 example 데이터가 노출되지 않는지
- Railway Public Domain이 생성되었는지
- `/admin` 접속이 되는지
- Basic Auth가 동작하는지
- LOG_CHANNEL_ID가 설정되었는지
- ACTIVITY_REVIEW_CHANNEL_ID가 설정되었는지
- POINT_REDEEM_CHANNEL_ID가 설정되었는지
- 빈 데이터 상태에서도 대시보드가 자연스럽게 보이는지
- 실제 운영용 미션/상점 등록 전후 표시가 정상인지

### docs/admin-dashboard-mvp-plan.md

구현 상태 섹션에 추가:

- v1에서 읽기 전용 대시보드 구현
- 운영 대시보드에서 example 데이터 제외
- Railway 환경변수 필요
- 향후 실제 데이터 저장소 안정화 필요

## 작업 10. 테스트 보강

`scripts/test-admin-dashboard-flow.js`를 보강한다.

테스트 항목:

- example-like record 판별
- example record 필터링
- example 데이터만 있을 때 summary가 0 또는 빈 목록으로 반환되는지
- 실제 데이터와 example 데이터가 섞여 있을 때 실제 데이터만 반환되는지
- 빈 데이터에서도 admin API helper가 오류 없이 동작하는지
- meta.exampleRecordsExcluded가 가능하면 정상 계산되는지
- ADMIN_DASHBOARD_ENABLED=false 기본값 확인
- ADMIN_DASHBOARD_PASSWORD 미설정 시 비활성 처리
- Basic Auth parser 기존 테스트 유지

성공 메시지:

```txt
admin dashboard flow smoke test passed
```

## 작업 11. check-release 유지

`scripts/check-release.js`에 `node scripts/test-admin-dashboard-flow.js`가 이미 포함되어 있으면 유지한다.

없다면 추가한다.

기존 테스트는 제거하지 않는다.

## 검증

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

- npm run deploy는 실행하지 않는다.
- 새 Slash Command는 추가하지 않았으므로 npm run deploy는 필요 없다.
- git commit, git push는 하지 않는다.

## 작업 후 로컬 확인

로컬 `.env`에 아래가 있을 때:

```env
ADMIN_DASHBOARD_ENABLED=true
ADMIN_DASHBOARD_PASSWORD=원하는비밀번호
ADMIN_DASHBOARD_TITLE=리디파인 운영 대시보드
```

서버 실행 후 아래 주소에서 확인한다.

```txt
http://localhost:3000/admin
```

확인할 것:

- example 사용자/신청/로그가 운영 데이터처럼 보이지 않는지
- 카드 숫자가 example 데이터 기준으로 올라가지 않는지
- 빈 데이터 문구가 자연스러운지
- 상단에 읽기 전용/local JSON/example 데이터 제외 안내가 보이는지
- 실제 local 데이터가 있으면 실제 데이터만 보이는지

## 완료 후 요약

완료 후 아래 내용을 요약한다.

- 변경된 파일 목록
- example 데이터 노출 방지 방식
- admin API 필터링 방식
- summary 카드 변화
- 빈 데이터 문구 개선 내용
- `.env.example` 보강 내용
- README 보강 내용
- docs/railway-env-guide.md 생성 여부
- docs/production-data-reset-guide.md 생성 여부
- operation-guide 보강 내용
- prelaunch QA 체크리스트 보강 내용
- admin dashboard plan 보강 내용
- 기존 Discord 명령어 유지 여부
- 새 Slash Command는 추가하지 않았다는 점
- npm run deploy는 실행하지 않았다는 점
- 테스트 결과 전체