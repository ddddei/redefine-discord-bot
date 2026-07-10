# Codex 작업 지시서

## 작업 이름

운영 데이터 안전화 v1 — 빈 환경 초기화·Railway 영속 경로·백업 완결성

## 목표

프로젝트 리디파인 디스코드 봇이 완전히 빈 운영 환경에서도 example 데이터를 참여자에게 노출하거나 실제 local 파일로 복제하지 않고, Railway Volume 같은 영속 디렉터리에서 운영 데이터를 일관되게 읽고 쓸 수 있도록 한다.

상세 범위와 완료 기준은 **`docs/production-data-safety-v1-plan.md`가 기준 문서**다. 이 지시서와 계획서가 충돌하면 계획서를 우선하고, 충돌 지점과 선택한 해석을 최종 보고서에 남긴다.

이번 작업은 참여자 DM 실운영 준비의 선행 작업이다. 기능 추가보다 데이터 보존·example 격리·복구 가능성을 우선한다.

## 선행 조건

1. 최신 `main`을 확인하고 `main`에서 새 브랜치 `feat/production-data-safety-v1`을 만든다.
2. `main`에 직접 커밋하지 않는다.
3. 아래 문서와 코드를 먼저 읽고 현재 구현과 계획서 차이를 짧게 정리한 뒤 구현한다.

필독:

- `AGENTS.md`
- `src/AGENTS.md`
- `scripts/AGENTS.md`
- `data/AGENTS.md`
- `docs/AGENTS.md`
- `docs/production-data-safety-v1-plan.md`
- `docs/production-data-reset-guide.md`
- `docs/export-and-backup-guide.md`
- `docs/railway-env-guide.md`
- `src/pointsRepository.js`
- `src/pointsStore.js`
- `src/jsonStorage.js`
- `src/operationBackup.js`
- `src/dmChatRepository.js`
- `src/dungeonworld.js`
- `src/webgameRepository.js`
- `scripts/check-local-operation-data.js`
- `scripts/restore-operation-backup.js`

작업 시작 보고에 반드시 아래 출력 원문을 포함한다.

```bash
git branch --show-current
git log --oneline -3
git status --short
```

## 현재 확인된 재현 문제

local 파일이 하나도 없을 때 현재 `pointsRepository`는 `points.example.json`, `shop-items.example.json`, `redemptions.example.json`을 운영 상태 fallback으로 읽는다.

이 상태에서 확인된 문제:

- `/상점`에 example active 상품이 노출될 수 있음
- 첫 실제 포인트 변경 시 example 사용자·거래가 `points.local.json`에 복제됨
- example 상점·교환 기록이 각각의 local 파일에 복제됨
- 생성된 local 파일의 `isExample`이 `true`로 남을 수 있음

이 문제를 관리자 화면 필터만으로 숨기지 말고 저장소 초기화 단계에서 제거한다.

## 확정 구현 결정

### 1. example과 운영 상태 분리

- `*.example.json`은 테스트·문서·운영자 템플릿 후보 전용이다.
- 실제 포인트·상점·교환·미션·인증 상태는 example을 fallback으로 사용하지 않는다.
- local 파일이 없으면 `isExample: false`인 빈 운영 구조를 생성한다.
- `/상점`은 운영 상점 파일이 없을 때 자연스러운 빈 상태를 반환해야 한다.
- 첫 실제 쓰기 후 어떤 local 파일에도 example ID, `예시`, sample/demo 값, 2030년대 fixture가 들어가면 안 된다.
- 기존 local 파일에 `isExample: true` 또는 example-like 레코드가 있으면 자동 삭제하지 않는다. strict 모드에서는 시작을 차단하고, 비strict 모드에서는 명확한 오류 로그와 운영 점검 경고를 남긴다.

### 2. 미션 템플릿 처리

- `mission-templates.example.json`은 운영자에게 보이는 **읽기 전용 후보**로 유지할 수 있다.
- 후보를 실제 미션으로 만드는 것은 운영자의 명시적 버튼/명령 처리에서만 허용한다.
- example 템플릿 자체를 active 운영 미션으로 자동 게시하거나 참여자 `/미션`에 노출하지 않는다.
- 기존 명시적 템플릿 복사 흐름이 이미 이 조건을 만족하면 불필요한 데이터 파일 분리는 하지 않는다.

### 3. 공통 영속 경로

신규 `src/operationDataPaths.js`를 만들고 local 운영 파일 경로를 한곳에서 계산한다.

우선순위:

1. 기존 파일별 환경변수
2. `OPERATION_DATA_DIR/<기본 파일명>`
3. 저장소 `data/<기본 파일명>`

기존 파일별 환경변수는 하위 호환을 유지한다. 절대 경로와 상대 경로를 섞어 해석하지 말고, 빈 문자열은 미설정으로 취급한다.

공통 경로 대상:

- points, shopItems, redemptions
- missions, missionTemplates, submissions
- reactionApprovals, operatorSupport
- dailyMissionAnnouncements
- operationBackupState
- dmChatLogs, dmCleanupState, dmSafetyReviews(후속 파일 예약 가능)
- dungeonworldLogs, dungeonworldConfig
- webgameLinks, webgameScores, webgameSocial, webgameReplayMismatch

### 4. strict 시작 점검

`PRODUCTION_DATA_STRICT=true`일 때 Discord 로그인과 관리자 서버 시작 전에 다음을 검사한다.

- 운영 데이터 디렉터리 생성/쓰기/rename 가능
- 기존 local JSON 파싱 가능
- local 파일 최상위 `isExample !== true`
- 핵심 운영 컬렉션에 example-like 레코드 없음
- 동일 파일 경로가 실수로 서로 다른 데이터 종류에 중복 지정되지 않음

치명 항목은 프로세스 시작을 중단한다. 실제 경로 전체나 민감 데이터 원문을 오류 메시지에 과도하게 출력하지 않는다.

`PRODUCTION_DATA_STRICT` 기본값은 `false`다. 비strict 모드에서도 오류를 조용히 무시하지 않고 콘솔과 운영 점검에 경고한다.

### 5. 복수 파일 저장 안전망

`pointsRepository.saveState`가 포인트·상점·교환 파일을 차례로 바로 저장하지 않도록 `jsonStorage`에 그룹 저장 helper를 추가한다.

권장 동작:

1. 대상 파일 전체를 같은 디렉터리의 고유 tmp 파일에 먼저 기록
2. 기존 파일이 있으면 짧은 수명의 rollback 사본 준비
3. 모든 tmp 기록 성공 후 rename 단계 수행
4. rename 중 실패하면 가능한 범위에서 이전 파일 복원
5. 성공/실패 후 tmp·rollback 사본 정리
6. 실패 시 원래 오류와 복원 성공/실패 여부를 함께 보고

고정 `.tmp` 파일명 하나를 공유하지 말고 작업 ID가 포함된 고유 파일명을 사용한다. 민감 데이터 사본이 장기간 남지 않게 한다.

프로세스 강제 종료까지 완전한 DB 트랜잭션처럼 보장한다고 주장하지 않는다. 이번 v1의 완료 기준은 부분 실패를 줄이고 무결성 점검으로 발견할 수 있게 하는 것이다.

### 6. 백업 manifest

자동 백업에 `schemaVersion`과 manifest를 추가한다.

필수 포함:

- points, shopItems, redemptions
- missions, missionTemplates, submissions
- reactionApprovals, operatorSupport
- dailyMissionAnnouncements
- dmChatLogs
- dungeonworldLogs, dungeonworldConfig
- webgameLinks, webgameScores, webgameSocial

정책상 제외:

- webgameReplayMismatch: 기본 백업 제외를 유지하고 manifest에 `excludedByPolicy`로 명시
- operationBackupState 자체는 복원 필수 데이터가 아니므로 manifest에서 정책을 명시

manifest에는 파일별 `included`, `missing`, `excludedByPolicy`, byte 크기 정도만 남긴다. 사용자 ID나 데이터 원문을 요약 필드에 넣지 않는다.

### 7. 복원과 무결성 점검

`scripts/check-local-operation-data.js`를 확장한다.

- `OPERATION_DATA_DIR` 지원
- strict 모드에서 필수 파일 누락을 오류로 처리
- 사용자 잔액과 마지막 `balanceAfter` 일치
- redemption과 차감/환불 transaction 상호 참조
- submission/reactionApproval과 지급 transaction 참조
- 상점 재고가 음수인지 확인
- example 혼입과 최상위 `isExample: true` 확인
- 자동 수정 금지, 파일명·레코드 ID·문제만 보고

복원 스크립트는 기본 dry-run과 기존 파일 덮어쓰기 방지 원칙을 유지한다. 구버전 스냅샷도 관용적으로 읽되, 새 manifest가 없다는 사실을 경고한다.

## 수정 가능 파일

핵심:

- 신규 `src/operationDataPaths.js`
- `src/jsonStorage.js`
- `src/pointsStore.js`
- `src/pointsRepository.js`
- `src/operationBackup.js`
- `src/dmChatRepository.js`
- `src/dungeonworld.js`
- `src/webgameRepository.js`
- `src/dailyMissionAnnouncement.js`
- `src/index.js`(strict preflight 연결만)
- `scripts/check-local-operation-data.js`
- `scripts/restore-operation-backup.js`
- `scripts/check-release.js`
- 관련 `scripts/test-*.js`
- `.env.example`
- `README.md`
- `docs/production-data-safety-v1-plan.md`(완료 상태 표기)
- `docs/production-data-reset-guide.md`
- `docs/export-and-backup-guide.md`
- `docs/railway-env-guide.md`
- `docs/prelaunch-qa-checklist.md`
- `docs/testing-guide.md`

필요한 경우:

- `src/adminApi.js`, `src/handlers.js`, `src/embeds.js`: 경로 유형·strict 경고를 읽기 전용 운영 점검에 표시하는 최소 변경만 허용
- example fixture: 테스트 구조 보완만 허용, 실제 개인정보 금지

금지:

- `public/` 게임 로직 변경
- FAQ/Knowledge/공지 콘텐츠 변경
- 실제 `.env` 또는 `*.local.json` 커밋
- 새로운 npm dependency
- PostgreSQL/SQLite 도입
- 관리자 웹 쓰기 기능
- Slash Command 스키마 변경

목록 밖 파일이 필요하면 구현 전에 사유를 작업 기록에 남긴다.

## 작업 순서와 권장 커밋

1. `feat: example 없는 빈 운영 데이터 초기화`
   - 빈 팩토리
   - 운영 fallback 제거
   - fresh-production 회귀 테스트
2. `feat: 운영 데이터 공통 영속 경로 추가`
   - operationDataPaths
   - 저장소별 경로 연결
   - env 우선순위 테스트
3. `feat: 복수 JSON 그룹 저장 안전망 추가`
   - 그룹 tmp/rollback
   - 실패 주입 테스트
4. `feat: 운영 백업 manifest와 웹게임 범위 추가`
   - 백업/복원 호환 테스트
5. `feat: 운영 데이터 strict 점검 강화`
   - 부팅 preflight
   - 무결성 교차 참조
6. `test: 빈 환경·백업·무결성 릴리즈 게이트 보강`
7. `docs: Railway Volume과 데이터 안전 절차 갱신`

커밋은 논리 단위로 나눈다. 커밋 수가 달라지면 이유를 보고한다.

## 테스트 요구사항

반드시 신규 테스트에서 다음을 재현한다.

1. local 파일이 하나도 없는 임시 디렉터리
2. `/상점` 또는 repository active shop 조회가 0건
3. 첫 포인트 지급 후 example 레코드 0건
4. 생성된 local 파일 모두 `isExample: false`
5. 일부 local 파일만 존재하는 상태
6. `OPERATION_DATA_DIR`과 개별 path 우선순위
7. 쓰기 불가·rename 실패·중간 저장 실패
8. example 혼입 strict 차단과 비strict 경고
9. 웹게임 파일을 포함한 백업 manifest
10. replay mismatch 정책상 제외 표시
11. 구버전 백업 dry-run 호환
12. 포인트·교환·환불·인증 참조 불일치 탐지
13. 기존 정상 local fixture 하위 호환

테스트는 실제 `data/*.local.json`을 쓰지 않고 `os.tmpdir()` 격리 디렉터리를 사용한다.

## 필수 검증

```bash
node --check src/operationDataPaths.js
node --check src/jsonStorage.js
node --check src/pointsRepository.js
node --check src/operationBackup.js
node scripts/test-json-storage.js
node scripts/test-points-repository.js
node scripts/test-operation-backup-flow.js
node scripts/test-local-operation-data-check.js
npm run validate:data
npm run test:questions
npm run check:release
git diff --check
git status --short
```

실제 Railway·Discord·Volume을 변경하거나 실제 운영 데이터에 테스트 쓰기를 하지 않는다. 실환경 확인은 최종 보고서의 `운영자 확인 대기`로 남긴다.

## 완료 보고 형식

1. 브랜치명과 커밋 목록
2. 계획서 완료 조건 1~9 각각의 구현·검증 근거
3. fresh-production 재현 전/후 비교
4. 새 환경변수와 경로 우선순위
5. 백업 manifest 포함·제외 목록
6. 그룹 저장 실패 주입 결과와 남는 한계
7. 무수정 통과 테스트와 확장/신규 테스트 구분
8. 실제 Railway 운영자 확인 대기 체크리스트
9. 계획서와 다르게 구현한 지점
10. 수정 허용 목록 밖 파일과 사유

## 게시 제한

- `git push`, PR 생성, 머지, Railway 설정 변경, `npm run deploy` 금지
- 로컬 브랜치 커밋까지만 수행
- 실제 토큰·채널 ID·Volume 경로·참여자 데이터를 보고서에 포함하지 않음
