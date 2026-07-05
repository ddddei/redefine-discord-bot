# 작업 지시서 (샌드위치: Sonnet 구현 + Fable 리뷰)

## 작업 이름

운영 관리 웹 콘솔 v1 — Phase 1: 처리 큐 + 쓰기 액션 4종

## 목표

읽기 전용 `/admin` 대시보드를 **처리(쓰기)가 가능한 운영 콘솔**로 확장한다. 기준 문서는 `docs/ops-console-master-plan.md` 5.2절과 6절(보안 설계)이며, 이 계획서 승인으로 "admin 대시보드는 읽기 전용" 금기 조항은 **조건부 해제**되었다 — 조건은 env 게이트·감사 로그·확인 단계 3종의 필수 동반이다.

완료 시 다음이 모두 참이어야 한다.

1. `/admin` 첫 화면에 "오늘의 처리 큐"가 보인다 — 교환 대기·인증 대기·반응 후속 확인 건수와 목록.
2. 쓰기 API 4종이 동작한다: 교환 상태 변경, 인증 승인/반려, 포인트 지급/정정, 미션·상점 상태 변경.
3. `ADMIN_WRITE_ENABLED`가 꺼져 있으면(기본) 모든 쓰기 API가 403이고 프런트에 처리 버튼이 보이지 않는다 — 기존 읽기 전용 동작과 완전히 동일.
4. 모든 쓰기는 `data/admin-audit.local.json`에 감사 로그를 남긴다.
5. 이미 처리된 건에 대한 쓰기 요청은 409로 거부된다.
6. 모든 상태 변경은 `pointsRepository` 기존 메서드 경유 — 웹 전용 저장 로직 신설 금지.

## 기준 문서

- `docs/ops-console-master-plan.md` (5.1 설계 원칙, 5.2 Phase 1, 6 보안 설계)
- `docs/admin-dashboard-mvp-plan.md` (기존 읽기 MVP 구조)
- `docs/operator-dashboard-guide.md`, `docs/operator-command-guide.md`
- `src/AGENTS.md` (admin 모듈 경계)

## 현재 전제

- `src/adminServer.js`: Node 기본 `http` 서버. `handleAdminApi`가 `/api/admin/*` GET 라우팅, Basic Auth는 `src/adminAuth.js`.
- `src/adminApi.js`(828줄): 읽기 helper 13종. 정적 UI는 `public/admin/*`(빌드 없음, vanilla JS).
- 쓰기에 사용할 **기존 `pointsRepository` 메서드** (`createPointsRepository`가 반환):
  - 교환: `reviewRedemption` (지급완료/취소/환불 — `/교환관리 상태변경`이 쓰는 것과 동일 경로)
  - 인증: `approveSubmissionById`, `rejectSubmissionById` (승인 시 포인트 지급·트랜잭션 생성 포함)
  - 포인트: `adjustUserPoints` (사유·타입 포함 트랜잭션 생성)
  - 미션/상점: `setMissionStatus`, `setShopItemStatus`
- 원자 저장은 `pointsStore.js`의 `saveJsonFile` 계열이 담당. 감사 로그 파일도 같은 원자 저장 패턴을 쓴다.
- `data/*.local.json`은 절대 커밋하지 않는다. 예시 데이터 제외 원칙(`filterOperationalRecords` 패턴) 유지.

## 중요 구현 원칙

1. **저장 경유 금기 유지.** 쓰기 API 핸들러는 위 `pointsRepository` 메서드만 호출한다. JSON을 직접 읽고 쓰는 코드를 adminApi/adminServer에 추가하지 않는다.
2. **2중 쓰기 게이트.**
   - `ADMIN_WRITE_ENABLED=true`가 아니면 모든 쓰기 라우트는 403 `{ error: 'WRITE_DISABLED' }`.
   - `ADMIN_WRITE_TOKEN`이 설정된 경우, 쓰기 요청은 Basic Auth에 **더해** `X-Admin-Write-Token` 헤더가 일치해야 한다. 불일치 시 403. 미설정이면 헤더 검사 생략(Basic Auth 단독) — 단 `.env.example`과 문서에 설정 권장을 명시.
3. **감사 로그 필수.** 새 모듈 `src/adminAudit.js`: `appendAuditEntry({ action, targetType, targetId, reason, result, actor })` → `data/admin-audit.local.json`에 원자 저장 append. 시각은 ISO 문자열. 쓰기 성공·실패 모두 기록(실패는 `result: 'rejected'`+사유). actor는 v1에서 `'admin-console'` 고정(Basic Auth 단일 계정 전제).
4. **처리 시점 재검증.** 대상 조회 → 상태 확인 → 이미 처리된 건이면 409 `{ error: 'ALREADY_PROCESSED', currentStatus }`. 대상 없음은 404.
5. **사유 필수 액션.** 포인트 지급/정정과 인증 반려는 `reason` 필수(빈 문자열 거부, 400).
6. **참여자용 API 불변.** `/game/api/*` 경로·인증·응답을 바꾸지 않는다.
7. **Discord 알림.** v1 범위: 쓰기 성공 시 운영 알림 채널(기존 운영 알림 env가 있으면 재사용, 없으면 `ADMIN_CONSOLE_LOG_CHANNEL_ID` 신설)에 한 줄 요약을 전송한다. adminServer가 봇 클라이언트 참조를 **옵셔널 인자**로 받게 확장하되(없으면 알림 생략, 콘솔 자체는 동작), 참여자 개인 DM 알림은 이번 범위에서 제외하고 문서에 "참여자 안내는 기존 Discord 흐름 유지"로 명시한다.
8. **새 dependency 금지.** CommonJS, Node 20, vanilla JS 프런트 유지.
9. **slash command 변경 없음** — `npm run deploy` 불필요.
10. **git push, PR 생성, `npm run deploy`, `.env` 수정 금지. 로컬 커밋까지만** — `main`에서 `feat/admin-console-write-v1` 브랜치, 논리 단위 커밋(리뷰가 커밋 단위로 진행된다).

## 수정 가능 파일

- `src/adminApi.js`, `src/adminServer.js`
- `src/adminAudit.js` (신규)
- `public/admin/index.html`, `public/admin/admin.js`, `public/admin/admin.css`
- `scripts/test-admin-write-flow.js` (신규), `scripts/test-admin-dashboard-flow.js` (기존 검증 약화 금지)
- `scripts/check-release.js` (새 테스트 등록)
- `.env.example`
- `docs/operator-dashboard-guide.md`, `docs/operation-guide.md`, `docs/prelaunch-qa-checklist.md`, `README.md`
- `CLAUDE.md`, `AGENTS.md`, `src/AGENTS.md` (금기 조항 개정 — "쓰기는 게이트·감사 로그·확인 단계 동반 시 허용")

`src/pointsRepository.js` 수정은 원칙적으로 금지 — 기존 메서드로 불가능한 경우에만 사유를 요약하고 하위 호환 추가만 허용.

## 작업 1. 쓰기 게이트 + 감사 로그 모듈

- `src/adminAuth.js` 또는 `src/adminServer.js`에 `isWriteEnabled()` / `verifyWriteToken(req)` helper.
- `src/adminAudit.js` 신설(위 원칙 3). 파일 경로는 주입 가능하게 해 테스트에서 임시 디렉터리 사용.

## 작업 2. 쓰기 API 4종

`handleAdminApi`에 POST 라우팅 추가. 모든 라우트: Basic Auth → 쓰기 게이트 → JSON body 파싱(크기 제한, 잘못된 JSON은 400) → 재검증 → repository 호출 → 감사 로그 → 응답.

| 라우트 | body | repository 호출 |
| --- | --- | --- |
| `POST /api/admin/redemptions/:id/status` | `{ status: 'complete'\|'cancel'\|'refund', reason? }` | `reviewRedemption` |
| `POST /api/admin/submissions/:id/decision` | `{ decision: 'approve'\|'reject', reason? (reject 시 필수) }` | `approveSubmissionById` / `rejectSubmissionById` |
| `POST /api/admin/points/adjust` | `{ discordId, amount(정수, 0 금지), type: 'earn'\|'adjust', reason(필수) }` | `adjustUserPoints` |
| `POST /api/admin/missions/:id/status`, `POST /api/admin/shop-items/:id/status` | `{ status, reason? }` | `setMissionStatus` / `setShopItemStatus` |

응답: 성공 200 `{ ok: true, result: {...변경 후 상태 요약} }`. 실패는 400/403/404/409/500을 일관되게. 상태 값 검증은 기존 Discord 명령이 허용하는 값 집합과 동일하게(핸들러 코드에서 확인해 맞춘다).

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
7. 모든 성공·거부 요청이 감사 로그에 기록된다(액션·대상·사유·result).
8. 잘못된 JSON body 400, 존재하지 않는 대상 404.
9. 인증 없는 POST는 401.
10. Discord 콘솔 처리 결과가 기존 `/운영현황`·읽기 API 조회에 즉시 반영된다(같은 저장 경로 증명).

기존 `test-admin-dashboard-flow.js`는 무수정 통과해야 한다(읽기 하위 호환 증명).

## 작업 5. 문서·env 반영

- `.env.example`: `ADMIN_WRITE_ENABLED=false`, `ADMIN_WRITE_TOKEN=`, `ADMIN_CONSOLE_LOG_CHANNEL_ID=` + 한 줄 설명.
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
