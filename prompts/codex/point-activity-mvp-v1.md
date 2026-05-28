# Codex 작업 지시서

## 작업 이름

참여 활동 포인트 지급 MVP v1

## 목표

프로젝트 리디파인 디스코드 봇의 여정 포인트 시스템에 참여 활동 기반 포인트 지급 기능을 추가한다.

현재 구현된 포인트 운영 MVP는 `/포인트`, `/상점`, `/교환`, `/포인트관리`, `/교환관리`, `/포인트로그` 중심이다.

이번 작업에서는 참여자가 포인트를 얻을 수 있는 기본 흐름을 만든다.

이번 작업에서 추가할 기능은 아래와 같다.

* `/체크인`
* `/미션`
* `/인증`
* `/인증관리`
* 미션 데이터 저장소
* 인증 제출 데이터 저장소
* 체크인 중복 지급 방지
* 인증 승인 시 포인트 지급
* 운영자 채널 인증 알림
* 관련 문서 보강
* smoke test 추가

이번 작업에서는 Google Sheets 연동, PostgreSQL 연동, 웹 대시보드, MEE6 연동은 구현하지 않는다.

## 현재 전제

현재 프로젝트에는 아래 기능이 이미 있다.

* `/안내`
* `/채널안내`
* `/질문`
* `/공지`
* `/리디`
* `/포인트`
* `/상점`
* `/교환`
* `/포인트관리`
* `/교환관리`
* `/포인트로그`
* `src/pointsStore.js`
* `src/pointsRepository.js`
* `scripts/test-points-store.js`
* `scripts/test-points-repository.js`
* `data/points.example.json`
* `data/shop-items.example.json`
* `data/redemptions.example.json`
* `data/missions.example.json`
* `data/submissions.example.json`
* `docs/journey-point-system-plan.md`
* `docs/point-data-structure-plan.md`
* `docs/operation-guide.md`

기존 local JSON repository 구조를 유지한다.

## 중요 운영 정책

### `/체크인`

* 참여자가 오늘의 체크인을 남기고 여정 포인트를 받을 수 있는 명령어다.
* 하루 1회만 포인트를 지급한다.
* 날짜 기준은 한국 시간 기준으로 한다.
* 체크인은 경쟁이나 출석 압박이 아니라, 가벼운 참여 기록으로 안내한다.
* 응답은 ephemeral 권장.
* 체크인 포인트는 기본값을 10P로 둔다.
* 향후 운영진이 기준을 조정할 수 있음을 문서에 남긴다.

### `/미션`

* 현재 참여 가능한 미션 목록을 보여준다.
* active 상태의 미션만 보여준다.
* 미션 ID 또는 신청 코드를 함께 표시한다.
* 참여자가 `/인증`에서 어떤 미션 ID를 입력해야 하는지 알 수 있게 한다.
* 응답은 ephemeral 권장.
* 미션은 강제 과제가 아니라 선택형 활동으로 안내한다.

### `/인증`

* 참여자가 미션 수행 내용을 제출하는 명령어다.
* 제출 즉시 포인트를 자동 지급하지 않는다.
* 제출 상태는 pending으로 저장한다.
* 운영자 채널에 인증 검토 요청 알림을 보낸다.
* 운영자가 `/인증관리`로 승인하면 포인트를 지급한다.
* 운영자가 반려하면 포인트를 지급하지 않는다.
* 인증 내용에는 개인정보를 과도하게 요구하지 않는 방향으로 안내한다.
* 응답은 ephemeral 권장.

### `/인증관리`

* 운영자가 인증 제출을 승인 또는 반려하는 명령어다.
* 운영자 전용 명령어다.
* 승인 시 해당 미션의 rewardPoints만큼 포인트를 지급한다.
* 이미 approved 또는 rejected 상태인 제출은 중복 처리하지 않는다.
* 승인 시 pointTransactions에 earn 거래를 남긴다.
* 반려 시 포인트를 지급하지 않는다.
* 반려 사유는 운영 메모로 남길 수 있다.
* 참여자를 평가하거나 낙인찍는 문구는 피한다.

## 중요 주의사항

* `/교환`, `/포인트관리`, `/교환관리`, `/포인트로그` 기존 동작을 깨지 않는다.
* `/포인트`, `/상점`은 계속 ephemeral 유지.
* `/체크인`, `/미션`, `/인증`도 가능하면 ephemeral 유지.
* 실제 Discord 토큰, 실제 채널 ID, 실제 참여자 개인정보는 작성하지 않는다.
* .env 파일은 수정하지 않는다.
* package.json, package-lock.json은 수정하지 않는다.
* Railway, GitHub 설정은 변경하지 않는다.
* npm run deploy는 실행하지 않는다.
* git commit, git push는 하지 않는다.
* Slash Command가 추가되므로 작업 완료 후 사용자가 직접 npm run deploy를 실행해야 한다.
* data/*.local.json은 커밋하지 않는다.
* JSON local repository는 MVP용이며 장기 운영 저장소가 아님을 문서에 남긴다.
* Google Sheets 연동은 이번 작업에서 하지 않는다.
* PostgreSQL 연동은 이번 작업에서 하지 않는다.
* 웹 대시보드는 이번 작업에서 만들지 않는다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

* src/deploy-commands.js
* src/handlers.js
* src/embeds.js
* src/pointsStore.js
* src/pointsRepository.js
* src/logging.js
* scripts/test-points-store.js
* scripts/test-points-repository.js
* scripts/test-point-activity-flow.js
* scripts/check-release.js
* docs/journey-point-system-plan.md
* docs/point-data-structure-plan.md
* docs/operation-guide.md
* .gitignore
* .env.example
* prompts/codex/point-activity-mvp-v1.md

.env.example은 실제 값 없이 placeholder만 추가할 수 있다.

## 작업 1. Slash Command 추가

src/deploy-commands.js에 아래 명령어를 추가한다.

### `/체크인`

설명 예시:

오늘의 체크인을 남기고 여정 포인트를 받습니다.

옵션:

* 내용: string, optional

  * 오늘의 짧은 상태나 한마디를 남길 수 있다.

### `/미션`

설명 예시:

현재 참여 가능한 미션을 확인합니다.

옵션:

* 없음

### `/인증`

설명 예시:

미션 수행 내용을 인증합니다.

옵션:

* 미션id: string, required
* 내용: string, required

### `/인증관리`

설명 예시:

운영자가 미션 인증을 승인 또는 반려합니다.

옵션:

* 제출id: string, required
* 처리: string, required

  * choices: 승인, 반려
* 메모: string, optional

주의:

* `/인증관리`는 운영자 전용 명령어다.
* ManageMessages 권한 또는 Administrator 권한이 있는 사용자만 실행 가능하게 한다.
* `setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)`를 적용한다.

## 작업 2. missions/submissions repository 보강

src/pointsRepository.js를 보강한다.

추가 local JSON 기본 경로:

* data/missions.local.json
* data/submissions.local.json

환경변수 후보:

* MISSIONS_DATA_PATH
* SUBMISSIONS_DATA_PATH
* ACTIVITY_REVIEW_CHANNEL_ID

환경변수가 없으면 local JSON 경로를 기본값으로 사용한다.

local 파일이 없으면 example JSON을 기준으로 초기 구조를 만든다.

단, 실제 참여자 정보는 임의로 example에서 가져오지 않는다.

추가 또는 보강할 함수 후보:

* getMissionsData()
* saveMissionsData(missionsData)
* getSubmissionsData()
* saveSubmissionsData(submissionsData)
* listActiveMissions()
* findMission(missionId)
* createCheckin(user, content)
* hasCheckedInToday(userId)
* createMissionSubmission(user, missionId, content)
* findSubmission(submissionId)
* reviewSubmissionById(submissionId, action, reviewer, note)
* approveSubmissionById(submissionId, reviewer, note)
* rejectSubmissionById(submissionId, reviewer, note)
* listRecentSubmissions(limit)
* listPendingSubmissions(limit)

날짜 기준:

* 한국 시간 기준 날짜 문자열을 생성하는 helper를 둔다.
* 예: YYYY-MM-DD
* 체크인 중복 여부는 userId와 checkinDate 기준으로 확인한다.

## 작업 3. `/체크인` 구현

src/handlers.js에 `/체크인` 처리 함수를 추가한다.

흐름:

1. interaction.user 기준으로 사용자 record를 확인하거나 생성한다.
2. 오늘 한국 시간 기준 체크인 여부를 확인한다.
3. 이미 체크인했다면 중복 지급하지 않고 안내한다.
4. 처음 체크인이라면 10P를 지급한다.
5. pointTransactions에 earn 기록을 남긴다.
6. 체크인 기록을 submissions 또는 별도 checkin record 구조로 저장한다.
7. 사용자에게 체크인 완료 안내를 ephemeral로 응답한다.

응답 예시 방향:

제목: 오늘의 체크인이 기록됐어요

내용:

* 지급 포인트: 10P
* 현재 보유 포인트
* 오늘 남긴 한마디
* 체크인은 참여를 돕는 가벼운 기록이라는 안내

중복 체크인 응답:

* 오늘은 이미 체크인을 완료했어요.
* 내일 다시 체크인할 수 있어요.
* 중복 포인트는 지급되지 않아요.

## 작업 4. `/미션` 구현

src/handlers.js에 `/미션` 처리 함수를 추가한다.

흐름:

1. missions data를 읽는다.
2. active 상태의 미션만 필터링한다.
3. 미션 ID, 제목, 설명, 지급 포인트, 인증 필요 여부를 표시한다.
4. active 미션이 없으면 안내한다.
5. 응답은 ephemeral로 한다.

응답 예시 방향:

제목: 오늘 참여 가능한 미션

각 미션 표시:

* 미션 ID
* 제목
* 설명
* 지급 포인트
* 인증 필요 여부
* `/인증 미션id:... 내용:...`으로 제출 가능 안내

주의:

* 미션은 선택형 활동이라고 안내한다.
* 포인트를 얻기 위한 압박처럼 보이지 않게 한다.

## 작업 5. `/인증` 구현

src/handlers.js에 `/인증` 처리 함수를 추가한다.

흐름:

1. 사용자가 미션id와 내용을 입력한다.
2. 미션이 존재하는지 확인한다.
3. 미션이 active 상태인지 확인한다.
4. 이미 같은 미션에 대해 pending 또는 approved 제출이 있는지 확인한다.
5. 중복 제출이면 안내한다.
6. 정상 제출이면 submissions에 pending으로 저장한다.
7. 운영자 채널에 인증 검토 알림을 보낸다.
8. 사용자에게 제출 접수 안내를 ephemeral로 응답한다.

중요:

* `/인증` 단계에서는 포인트를 지급하지 않는다.
* 운영자 승인 후 포인트를 지급한다.
* 제출 내용이 너무 길면 적절히 잘라 표시한다.
* 개인정보를 과도하게 적지 말라는 안내를 포함한다.

운영자 채널 알림 기준:

* ACTIVITY_REVIEW_CHANNEL_ID가 있으면 우선 사용
* 없으면 LOG_CHANNEL_ID fallback
* 둘 다 없으면 console.warn만 남긴다.

운영자 알림 내용:

* 제출 ID
* 제출자 표시명
* 미션 ID
* 미션 제목
* 지급 예정 포인트
* 제출 내용 요약
* 제출 시간
* `/인증관리 제출id:... 처리:승인` 또는 `/인증관리 제출id:... 처리:반려` 안내

## 작업 6. `/인증관리` 구현

src/handlers.js에 `/인증관리` 처리 함수를 추가한다.

운영자 전용이다.

권한 확인은 기존 운영자 helper를 재사용한다.

### 승인

흐름:

1. 제출 ID를 찾는다.
2. 제출 상태가 pending인지 확인한다.
3. 연결된 mission을 찾는다.
4. mission.rewardPoints만큼 포인트를 지급한다.
5. pointTransactions에 earn 기록을 남긴다.
6. submission 상태를 approved로 변경한다.
7. rewardTransactionId를 연결한다.
8. 운영자에게 승인 완료 안내를 ephemeral로 보여준다.

### 반려

흐름:

1. 제출 ID를 찾는다.
2. 제출 상태가 pending인지 확인한다.
3. submission 상태를 rejected로 변경한다.
4. reviewedBy, reviewedAt, note를 기록한다.
5. 포인트는 지급하지 않는다.
6. 운영자에게 반려 완료 안내를 ephemeral로 보여준다.

주의:

* approved/rejected 상태인 제출은 다시 처리하지 않는다.
* 중복 포인트 지급을 막는다.
* 반려 문구는 평가적이지 않게 한다.
* 참여자에게 자동 DM 발송은 이번 작업에서 구현하지 않는다.

## 작업 7. Embed 보강

필요하다면 src/embeds.js에 아래 helper를 추가한다.

* createCheckinResultEmbed
* createMissionListEmbed
* createSubmissionReceivedEmbed
* createSubmissionReviewLogEmbed
* createSubmissionAdminResultEmbed

기존 embed 톤과 색상을 유지한다.

문구는 추후 다듬을 수 있으므로, 이번 작업에서는 기능 흐름이 명확한 수준으로 작성한다.

## 작업 8. logging 보강

필요하다면 src/logging.js에 인증 검토 알림 함수를 추가한다.

예시 이름:

* sendMissionSubmissionReviewAlert

알림 채널 기준:

1. ACTIVITY_REVIEW_CHANNEL_ID
2. LOG_CHANNEL_ID
3. 없으면 console.warn

주의:

* 채널 ID가 없어도 봇이 죽지 않게 한다.
* 알림 실패 시 사용자 응답이 실패하지 않게 한다.
* console.error 또는 console.warn으로 요약만 남긴다.

## 작업 9. 테스트 스크립트 추가

scripts/test-point-activity-flow.js 파일을 새로 만든다.

역할:

* 임시 디렉터리에서 체크인, 미션, 인증, 인증관리 흐름을 테스트한다.
* 실제 data/*.local.json은 만들지 않는다.
* os.tmpdir() 아래 테스트용 파일만 사용한다.
* Node 기본 assert만 사용한다.
* 외부 테스트 라이브러리는 추가하지 않는다.

테스트 항목:

* active mission 목록 조회
* 체크인 최초 1회 성공
* 체크인 중복 방지
* 체크인 포인트 지급 확인
* 미션 인증 pending 제출 생성
* 같은 미션 중복 제출 방지
* 인증 승인 시 포인트 지급
* 인증 승인 후 중복 승인 방지
* 인증 반려 처리
* 반려 시 포인트 미지급
* 최근 제출 목록 조회

성공 시 출력:

point activity flow smoke test passed

## 작업 10. check-release 반영

scripts/check-release.js에 아래 파일 문법 검사 또는 smoke test를 반영한다.

* scripts/test-point-activity-flow.js

가능하다면 check-release에서 아래 테스트도 실행하도록 한다.

* node scripts/test-points-store.js
* node scripts/test-points-repository.js
* node scripts/test-point-activity-flow.js

기존 validate:data, test:questions 흐름은 유지한다.

## 작업 11. 문서 보강

아래 문서를 필요한 만큼 보강한다.

### docs/journey-point-system-plan.md

보강 내용:

* `/체크인`, `/미션`, `/인증`, `/인증관리` MVP 흐름
* 체크인은 하루 1회 포인트 지급
* 미션 인증은 제출 후 운영자 승인 시 지급
* 포인트는 참여 강제 장치가 아니라 선택형 동기부여 장치

### docs/point-data-structure-plan.md

보강 내용:

* missions.local.json, submissions.local.json 저장소 메모
* 체크인 중복 지급 방지 기준
* submissions 상태값 pending, approved, rejected
* approved 시 rewardTransactionId 연결
* JSON local 저장소는 MVP용이며 장기 운영에는 한계가 있음

### docs/operation-guide.md

보강 내용:

* 참여자는 `/체크인`으로 하루 1회 체크인 가능
* 참여자는 `/미션`으로 미션 확인 가능
* 참여자는 `/인증`으로 미션 수행 내용을 제출 가능
* 인증 제출은 운영자 승인 후 포인트 지급
* 운영자는 `/인증관리`로 승인 또는 반려 처리
* 개인정보가 포함된 인증을 요구하지 않도록 주의
* 세부 지급 기준은 운영진 안내를 우선함

## 작업 12. .env.example 보강

.env.example에 실제 값 없이 placeholder만 추가할 수 있다.

추가 후보:

* MISSIONS_DATA_PATH=
* SUBMISSIONS_DATA_PATH=
* ACTIVITY_REVIEW_CHANNEL_ID=

주의:

* 실제 값은 절대 넣지 않는다.
* .env 파일은 수정하지 않는다.

## 작업 13. 검증

작업 완료 후 아래 명령어를 실행한다.

* node scripts/test-points-store.js
* node scripts/test-points-repository.js
* node scripts/test-point-activity-flow.js
* npm run validate:data
* npm run test:questions
* npm run check:release

주의:

* npm run deploy는 실행하지 않는다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

* 변경된 파일 목록
* 추가된 Slash Command 목록
* `/체크인` 동작 요약
* `/미션` 동작 요약
* `/인증` 동작 요약
* `/인증관리` 동작 요약
* 체크인 중복 지급 방지 방식
* 인증 승인 시 포인트 지급 방식
* 운영자 채널 알림 방식
* 실제 Google Sheets나 PostgreSQL 연동은 하지 않았다는 점
* data/*.local.json은 커밋하지 않는다는 점
* node scripts/test-points-store.js 결과
* node scripts/test-points-repository.js 결과
* node scripts/test-point-activity-flow.js 결과
* npm run validate:data 결과
* npm run test:questions 결과
* npm run check:release 결과
* npm run deploy는 실행하지 않았다는 점
* 작업 후 사용자가 직접 npm run deploy를 실행해야 한다는 점
