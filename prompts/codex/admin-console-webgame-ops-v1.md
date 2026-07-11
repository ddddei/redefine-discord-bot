# 작업 지시서 — 운영 콘솔 Phase 2: 웹게임 판정과 주간 지급

> **2026-07-11 현행화:** PR #79의 쓰기 게이트·감사 로그·확인 dialog가 main에 반영된 상태를 기준으로 한다. 구현은 서브 에이전트, 최종 보안·멱등성 검수는 5.6 Sol이 담당한다.

> **구현 상태:** 코드·자동 테스트 완료. 실제 `/admin` 모바일 화면과 Railway 운영 데이터 리허설은 확인 대기.

## 목표

1. `/admin`의 flagged 점수를 운영자가 `valid` 또는 `invalid`로 한 번 판정한다.
2. 기존 Discord `/게임지급`과 동일한 계산·지급 서비스를 웹에서 `미리보기 → 확인 → 실행`으로 사용한다.
3. 지급 대상이 바뀐 미리보기는 실행하지 않고 409로 막는다.
4. 중복 지급은 기존 point transaction `relatedId`를 유일한 진실 원장으로 차단한다.
5. 모든 POST는 Phase 1의 Basic Auth, 필수 write token, 선행 감사 로그, no-store, 본문 제한을 그대로 통과한다.

## 현재 코드 계약

- 계산: `src/webgamePayout.js`의 `buildWeeklyPayoutPlan`.
- 실행: `executeWeeklyPayoutPlan` → `pointsRepository.awardWebgameWeeklyReward`.
- 중복 차단: `getWebgameWeeklyRewardRelatedId`와 `listWebgameWeeklyRewardTransactions`.
- 지급 게임: `match3`, `deck`, `survivors`; idle은 공동 목표 보상만 지급한다.
- 참여 보상은 세 게임 통합 주당 1회이며 순위 수상자는 제외한다. 공동 목표 보상은 중복 가능하다.
- flagged 기록은 현행 랭킹·공동 목표·지급 계산에서 제외된다.
- 점수 레코드는 과거 데이터에 `id`가 없다. admin 전용 식별자는 immutable 필드의 결정적 SHA-256 축약값으로 만들고 응답에 원본 token/seed를 노출하지 않는다. 신규 점수에는 안정적 `id`를 저장해도 되지만 기존 레코드 읽기 호환을 유지한다.

## 안전 결정

1. **별도 payout 파일 금지.** 포인트 transaction이 지급 원장이다. 이중 원장과 불일치를 만들지 않는다.
2. **부분 실패 재시도 허용.** 성공 건은 transaction으로 차단되고 실패 건만 새 미리보기로 재시도된다. 지급 예정 0건이면 실행은 409 `PAYOUT_ALREADY_COMPLETE`.
3. **snapshot token.** API용 순수 helper가 계획의 지급 관련 필드만 정규화해 SHA-256 해시한다. 실행 직전 계획을 다시 계산하고 token이 다르면 409 `PAYOUT_SNAPSHOT_CHANGED`이며 아무도 지급하지 않는다.
4. **판정 1회.** 미판정 flagged 점수만 valid/invalid 처리한다. 이미 resolution이 있으면 409. `valid`는 `flagged:false`, `invalid`는 `flagged:true`; 시각·운영자·500자 이하 사유를 저장한다.
5. **지급 후 판정 경고.** 해당 weekKey에 웹게임 지급 transaction이 하나라도 있으면 판정은 저장하되 `manualReconciliationRequired:true`를 응답·UI에 표시한다. 자동 환수·추가지급은 하지 않는다.
6. **example·민감정보.** example-like 대상은 404. playerToken, seed, replay log 원문, write token은 응답·감사 로그에 넣지 않는다.
7. **사유 필수.** 점수 판정과 지급 모두 비어 있지 않은 reason을 요구한다.
8. 새 dependency, Slash Command 변경, 참여자 DM, 스케줄 자동 지급은 금지한다.

## API

### `POST /api/admin/webgames/scores/:scoreId/resolve`

Body: `{ resolution: 'valid'|'invalid', reason }`

- 200: `{ ok, result, manualReconciliationRequired }`
- 404: 대상 없음/example
- 409: 이미 판정됨
- repository의 새 메서드만 사용해 저장한다. adminServer의 JSON 직접 저장 금지.

### `GET /api/admin/webgames/payout-preview?weekKey=YYYY-Www`

- Phase 1 Basic Auth 적용, write token은 요구하지 않는 읽기 API.
- 기존 plan에 `snapshotToken`과 지급 예정/기지급 요약을 더한다.
- 참여자 Discord ID·표시명·금액·순위는 admin 전용으로 허용하되 player token은 금지한다.

### `POST /api/admin/webgames/payout`

Body: `{ weekKey, snapshotToken, reason }`

처리 순서:

1. Phase 1 쓰기 접근 검사
2. JSON·주차·사유 검증
3. 감사 `attempt` 선기록
4. 계획 재계산과 snapshot 비교
5. 지급 예정 0건 확인
6. `executeWeeklyPayoutPlan`
7. 성공/부분 실패 결과 감사 기록 및 응답

부분 실패는 200으로 반환하되 `partialFailure:true`와 실패 대상의 최소 정보만 제공한다. 성공 건을 롤백하지 않는다.

## UI

- flagged 표에 미판정 건만 `정상 판정`, `무효 확정` 버튼 표시.
- 기존 Phase 1 dialog를 재사용하고 사유를 필수로 받는다.
- 웹게임 섹션에 주차 입력, 미리보기, 지급 예정 인원·총액·기지급 수, 실행 버튼을 추가한다.
- 실행 버튼은 미리보기 token을 메모리에만 보관하고 총액·건수를 다시 보여준 뒤 실행한다.
- snapshot 409 시 미리보기를 자동 갱신하고 재확인을 요구한다.
- 지급 후 판정 경고와 부분 실패 재시도 안내를 명확한 한국어로 표시한다.
- write gate가 꺼지면 판정·실행 버튼은 렌더링하지 않는다. 미리보기 UI도 숨긴다.

## 수정 가능 파일

- `src/adminApi.js`, `src/adminServer.js`, `src/webgameRepository.js`, `src/webgamePayout.js`
- `public/admin/index.html`, `public/admin/admin.js`, `public/admin/admin.css`
- `scripts/test-admin-webgame-ops-flow.js` 신규
- `scripts/test-admin-write-flow.js`, `scripts/test-admin-dashboard-flow.js`, `scripts/test-webgame-payout-flow.js` 필요 시 강화(기존 assertion 약화 금지)
- `scripts/check-release.js`
- `docs/ops-console-master-plan.md`, `docs/webgame-rankings-ops.md`, `docs/operator-dashboard-guide.md`, `docs/prelaunch-qa-checklist.md`, `README.md`

`src/pointsRepository.js`와 operation data path에 새 payout 저장소를 추가하지 않는다.

## 필수 테스트

1. scoreId가 legacy 레코드에서도 결정적이고 seed/token을 노출하지 않는다.
2. valid 판정 후 랭킹 재포함, invalid는 계속 제외되며 resolution metadata가 저장된다.
3. 같은 점수 재판정 409, 없는/example 점수 404, 사유 없음 400.
4. payout preview가 기존 `buildWeeklyPayoutPlan`과 대상·총액이 일치한다.
5. preview 후 점수/링크/기지급 transaction 변경 시 snapshot 409이고 지급 0건.
6. 실행 성공 후 잔액·relatedId transaction 확인, 같은 요청은 409.
7. 부분 실패 뒤 성공 transaction은 중복되지 않고 실패 건만 새 token으로 재시도 가능하다.
8. 지급 완료 뒤 valid/invalid 판정 응답에 수동 정정 경고가 있다.
9. write off, token 미설정/불일치, 인증 없음이 Phase 1 계약대로 거부된다.
10. 감사 로그에 attempt/success/rejected가 남고 비밀값이 없다.
11. 기존 admin/dashboard/webgame payout 테스트가 무수정 또는 강화된 상태로 통과한다.

## 검증

```bash
node --check src/adminServer.js
node --check src/webgameRepository.js
node --check src/webgamePayout.js
node --check public/admin/admin.js
node scripts/test-admin-webgame-ops-flow.js
node scripts/test-admin-write-flow.js
node scripts/test-admin-dashboard-flow.js
node scripts/test-webgame-payout-flow.js
npm run check:release
git diff --check
```

## 작업 제한과 완료 보고

- 실제 `.env`, `*.local.json`, 실제 참여자 데이터 수정 금지.
- push, PR, merge, deploy 금지. 커밋도 5.6 Sol 최종 검수 전 하지 않는다.
- 수동 브라우저·Railway QA는 `확인 대기`로 분리한다.
- 완료 보고: 구현 요약, 상태 전이·멱등성 근거, 수정 파일, 테스트 결과, 수동 확인 대기, 운영자 후속 설정.
