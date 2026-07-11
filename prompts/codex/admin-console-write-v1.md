# 작업 지시서 (샌드위치: 서브 에이전트 구현 + 5.6 Sol 최종 검수)

> **2026-07-11 현행화:** PR #78 handlers 분할 이후 `main`(`0692a2a`) 기준으로 재감사했다. 구현 브랜치는 `feat/admin-console-write-v1`이며, 아래 보안 계약과 수정 가능 파일이 이전 판보다 우선한다.

## 작업 이름

운영 관리 웹 콘솔 v1 — Phase 1: 처리 큐 + 쓰기 액션 4종

## 목표

읽기 전용 `/admin` 대시보드를 **처리(쓰기)가 가능한 운영 콘솔**로 확장한다. 기준 문서는 `docs/ops-console-master-plan.md` 5.2절과 6절(보안 설계)이며, 이 계획서 승인으로 "admin 대시보드는 읽기 전용" 금기 조항은 **조건부 해제**되었다 — 조건은 env 게이트·감사 로그·확인 단계 3종의 필수 동반이다.

완료 시 다음이 모두 참이어야 한다.

1. `/admin` 첫 화면에 "오늘의 처리 큐"가 보인다 — 교환 대기·인증 대기·반응 후속 확인 건수와 목록.
2. 쓰기 API 4종이 동작한다: 교환 상태 변경, 인증 승인/반려, 포인트 지급/정정, 미션·상점 상태 변경.
3. `ADMIN_WRITE_ENABLED`가 꺼져 있으면(기본) 모든 쓰기 API가 403이고 프런트에 처리 버튼이 보이지 않는다 — 기존 읽기 전용 동작과 완전히 동일.
4. 모든 쓰기 시도와 결과는 공통 운영 데이터 경로의 `admin-audit.local.json`에 감사 로그를 남긴다.
5. 이미 처리된 건에 대한 쓰기 요청은 409로 거부된다.
6. 모든 상태 변경은 `pointsRepository` 기존 메서드 경유 — 웹 전용 저장 로직 신설 금지.

## 기준 문서

- `docs/ops-console-master-plan.md` (5.1 설계 원칙, 5.2 Phase 1, 6 보안 설계)
- `docs/admin-dashboard-mvp-plan.md` (기존 읽기 MVP 구조)
- `docs/operator-dashboard-guide.md`, `docs/operator-command-guide.md`
- `src/AGENTS.md` (admin 모듈 경계)

## 현재 전제

- `src/adminServer.js`: Node 기본 `http` 서버. `handleAdminApi`가 `/api/admin/*` GET 라우팅, Basic Auth는 `src/adminAuth.js`.
- `src/adminApi.js`: 읽기 helper 모듈. 정적 UI는 `public/admin/*`(빌드 없음, vanilla JS).
- 쓰기에 사용할 **기존 `pointsRepository` 메서드** (`createPointsRepository`가 반환):
  - 교환: `reviewRedemption` (지급완료/취소/환불 — `/교환관리 상태변경`이 쓰는 것과 동일 경로)
  - 인증: `approveSubmissionById`, `rejectSubmissionById` (승인 시 포인트 지급·트랜잭션 생성 포함)
  - 포인트: `adjustUserPoints` (사유·타입 포함 트랜잭션 생성)
  - 미션/상점: `setMissionStatus`, `setShopItemStatus`
- 원자 저장은 `src/jsonStorage.js`의 `saveJsonFileAtomic`이 담당한다. 감사 로그도 이 함수를 쓴다.
- 대상 재검증에는 이미 공개된 `findSubmission`, `findMission`, `findShopItem`, `loadState`를 사용한다. repository 공개 API 추가는 필요 없다.
- `data/*.local.json`은 절대 커밋하지 않는다. 예시 데이터 제외 원칙(`filterOperationalRecords` 패턴) 유지.

## 중요 구현 원칙

1. **저장 경유 금기 유지.** 쓰기 API 핸들러는 위 `pointsRepository` 메서드만 호출한다. JSON을 직접 읽고 쓰는 코드를 adminApi/adminServer에 추가하지 않는다.
2. **2중 쓰기 게이트.**
   - `ADMIN_WRITE_ENABLED=true`가 아니면 모든 쓰기 라우트는 403 `{ error: 'WRITE_DISABLED' }`.
   - `ADMIN_WRITE_ENABLED=true`여도 `ADMIN_WRITE_TOKEN`이 비어 있으면 쓰기는 활성화되지 않는다(503 `WRITE_TOKEN_NOT_CONFIGURED`).
   - 모든 쓰기 요청은 Basic Auth에 **더해** `X-Admin-Write-Token` 헤더가 일치해야 한다. 불일치 시 403. 비교는 timing-safe helper를 사용한다.
3. **감사 로그 필수.** 새 모듈 `src/adminAudit.js`: `appendAuditEntry({ action, targetType, targetId, reason, result, actor, errorCode })`. `resolveOperationDataPath('adminAudit')` 경로에 원자 저장하고 최근 1,000건만 유지한다. 시각은 ISO 문자열이며 비밀번호·쓰기 토큰·요청 본문 원문은 저장하지 않는다. mutation 전에 `attempt`를 기록해 감사 저장이 불가능하면 실제 상태를 바꾸지 않는다. 성공·거부 결과 기록 실패는 서버 로그로 남기되 이미 완료된 mutation을 되돌리거나 중복 재시도하지 않는다.
4. **처리 시점 재검증.** 대상 조회 → 상태 확인 → 이미 처리된 건이면 409 `{ error: 'ALREADY_PROCESSED', currentStatus }`. 대상 없음은 404.
5. **사유 필수 액션.** 포인트 지급/정정과 인증 반려는 `reason` 필수(빈 문자열 거부, 400).
6. **참여자용 API 불변.** `/game/api/*` 경로·인증·응답을 바꾸지 않는다.
7. **Discord 알림.** v1 범위는 쓰기 성공 시 운영 로그 채널에 보내는 선택적 한 줄 알림뿐이다. 실패해도 상태 변경은 성공으로 유지하고 서버 경고만 남긴다. 참여자 개인 DM·채널 알림은 이번 범위에서 제외한다.
8. **새 dependency 금지.** CommonJS, Node 20, vanilla JS 프런트 유지.
9. **slash command 변경 없음** — `npm run deploy` 불필요.
10. **요청 제한.** JSON만 허용하고 본문은 32 KiB 이하로 제한한다. admin API 응답에 `Cache-Control: no-store`를 설정하고 CORS를 추가하지 않는다.
11. **git push, PR 생성, `npm run deploy`, `.env` 수정 금지. 로컬 구현까지만** — 커밋·원격 작업은 최종 검수 후 5.6 Sol이 결정한다.

## 수정 가능 파일

- `src/adminApi.js`, `src/adminServer.js`, `src/adminAuth.js`
- `src/adminAudit.js` (신규)
- `src/operationDataPaths.js`, `src/operationBackup.js`, `src/index.js`
- `public/admin/index.html`, `public/admin/admin.js`, `public/admin/admin.css`
- `scripts/test-admin-write-flow.js` (신규), `scripts/test-admin-dashboard-flow.js`, `scripts/test-operation-backup-flow.js` (기존 검증 약화 금지)
- `scripts/check-release.js` (새 테스트 등록)
- `.env.example`
- `docs/operator-dashboard-guide.md`, `docs/operation-guide.md`, `docs/prelaunch-qa-checklist.md`, `README.md`
- `CLAUDE.md`, `AGENTS.md`, `src/AGENTS.md` (금기 조항 개정 — "쓰기는 게이트·감사 로그·확인 단계 동반 시 허용")

`src/pointsRepository.js` 수정 금지 — 현행 공개 API로 구현 가능하다.

## 작업 1. 쓰기 게이트 + 감사 로그 모듈

- `src/adminAuth.js` 또는 `src/adminServer.js`에 `isWriteEnabled()` / `verifyWriteToken(req)` helper.
- `src/adminAudit.js` 신설(위 원칙 3). 파일 경로는 주입 가능하게 해 테스트에서 임시 디렉터리 사용.
- `operationDataPaths`에 `ADMIN_AUDIT_DATA_PATH` 정의를 추가하고 operation backup snapshot/manifest에 비필수 파일로 포함한다.

## 작업 2. 쓰기 API 4종

`handleAdminApi`에 POST 라우팅 추가. 모든 라우트: Basic Auth → 쓰기 게이트 → JSON body 파싱(크기 제한, 잘못된 JSON은 400) → 재검증 → repository 호출 → 감사 로그 → 응답.

| 라우트 | body | repository 호출 |
| --- | --- | --- |
| `POST /api/admin/redemptions/:id/status` | `{ status: 'complete'\|'cancel'\|'refund', reason? }` | `reviewRedemption` |
| `POST /api/admin/submissions/:id/decision` | `{ decision: 'approve'\|'reject', reason? (reject 시 필수) }` | `approveSubmissionById` / `rejectSubmissionById` |
| `POST /api/admin/points/adjust` | `{ discordId, displayName?, amount(정수, 0 금지), reason(필수), note? }` | `adjustUserPoints({ user: { userId, displayName }, amount, reason, note, operatorId })` |
| `POST /api/admin/missions/:id/status`, `POST /api/admin/shop-items/:id/status` | `{ status, reason? }` | `setMissionStatus` / `setShopItemStatus` |

응답: 성공 200 `{ ok: true, result: {...변경 후 상태 요약} }`. 실패는 400/401/403/404/409/413/415/500/503을 구조화한다. 상태 값 검증은 repository 계약과 동일하게 맞춘다. `GET /api/admin/capabilities`는 비밀을 제외한 `writeEnabled`, `writeConfigured`, `writeTokenRequired`만 반환한다.

## 작업 3. 처리 큐 화면 + 처리 버튼

- 대시보드 상단에 "오늘의 처리 큐" 섹션: 교환 대기·인증 대기·반응 후속 확인 카드(건수 + 최근 목록). 기존 읽기 API(`today-queue`, `redemptions`, `submissions`) 재사용.
- 쓰기 활성 여부를 프런트가 알 수 있게 읽기 API 응답 meta 또는 `GET /api/admin/capabilities`에 `writeEnabled` 포함. false면 버튼 미렌더링(기존 화면과 동일).
- 각 건의 처리 버튼 → **확인 모달**(대상 요약 + 사유 입력) → POST → 성공 토스트 + 큐 갱신 / 실패는 한국어 안내(409는 "이미 처리된 건입니다 — 새로고침").
- 쓰기 토큰은 페이지 접속 후 1회 입력받아 메모리(변수)에만 보관 — localStorage 저장 금지.
- 모바일 375px에서 모달·버튼이 깨지지 않게. 기존 다크 톤 유지.

## 작업 4. 테스트 — `scripts/test-admin-write-flow.js`

임시 디렉터리 fixture로 격리. 필수 검증:

1. `ADMIN_WRITE_ENABLED` off: 쓰기 4종 전부 403, GET은 기존대로 200.
2. on + 토큰 불일치 403, 일치 시 처리 성공.
3. 교환 complete → 상태 변경 + 같은 건 재요청 409.
4. 인증 approve → 포인트 지급 트랜잭션 생성(잔액 증가 확인), reject는 reason 없으면 400.
5. `points/adjust` → 트랜잭션 로그에 사유 기록, amount 0/비정수 400.
6. 미션/상점 상태 변경 반영.
7. 모든 mutation 시도와 성공·거부 결과가 감사 로그에 기록된다(액션·대상·사유·result). 토큰은 기록되지 않는다. 감사 attempt 기록 실패 시 상태는 변하지 않는다.
8. 잘못된 JSON body 400, 과대 body 413, JSON이 아닌 Content-Type 415, 존재하지 않는 대상 404.
9. 인증 없는 POST는 401.
10. Discord 콘솔 처리 결과가 기존 `/운영현황`·읽기 API 조회에 즉시 반영된다(같은 저장 경로 증명).
11. `ADMIN_WRITE_ENABLED=true`이지만 토큰 미설정이면 capabilities는 쓰기 불가이고 POST는 503.
12. 감사 로그가 공통 데이터 경로·backup manifest에 포함되고 최대 1,000건으로 제한된다.

기존 `test-admin-dashboard-flow.js`는 무수정 통과해야 한다(읽기 하위 호환 증명).

## 작업 5. 문서·env 반영

- `.env.example`: `ADMIN_WRITE_ENABLED=false`, `ADMIN_WRITE_TOKEN=`, `ADMIN_AUDIT_DATA_PATH=`, `ADMIN_CONSOLE_LOG_CHANNEL_ID=` + 한 줄 설명.
- `operator-dashboard-guide.md`: 처리 큐 사용법, 쓰기 게이트 켜는 법, 사고 시 즉시 읽기 전용 복귀 절차(env off → 재배포).
- `operation-guide.md`: Discord 명령과 콘솔 처리가 동일 저장 경로임을 명시.
- CLAUDE.md/AGENTS.md 금기 조항 개정(위 수정 가능 파일 목록 참조).
- `prelaunch-qa-checklist.md`: 쓰기 off 기본 확인 항목 추가.

## 검증

```bash
node --check src/adminApi.js && node --check src/adminServer.js && node --check src/adminAudit.js
node scripts/test-admin-write-flow.js
node scripts/test-admin-dashboard-flow.js
npm run check:release
```

수동 확인(adminServer 기동, `docs/…guide` 참고 — QA는 반드시 adminServer 경유):

1. 쓰기 off: 기존과 동일한 읽기 전용 화면.
2. 쓰기 on: 처리 큐 → 교환 1건 지급완료 → 확인 모달 → 성공 토스트 → 목록 갱신 → 감사 로그 파일에 기록.
3. 같은 건 다른 탭에서 재처리 시도 → 409 안내.
4. 모바일 375×812 모달 확인.

## 완료 보고 형식

구현 요약 / 수정 파일 목록 / 통과한 검증 명령 / 수동 확인 결과(못 한 항목은 "확인 대기") / 후속: Railway env 3종 설정 필요, `npm run deploy` 불필요.
