# Codex 작업 지시서

## 작업 이름

운영 관리 웹 콘솔 v1 — Phase 2: 웹게임 flagged 처리 + 주간 랭킹 보상 반자동 지급

## 선행 조건

1. **E-1 완료**: `admin-dashboard-webgame-visibility-v1.md`(웹게임 읽기 섹션, `GET /api/admin/webgames`)가 main에 머지되어 있어야 한다.
2. **Phase 1 완료**: `admin-console-write-v1.md`(쓰기 게이트 `ADMIN_WRITE_ENABLED`/`ADMIN_WRITE_TOKEN`, `src/adminAudit.js` 감사 로그, 확인 모달 패턴)가 main에 머지되어 있어야 한다.

둘 중 하나라도 없으면 작업을 시작하지 말고 보고한다.

## 목표

E-1이 만든 웹게임 읽기 섹션 위에 운영 액션 2종을 얹는다. 기준 문서는 `docs/ops-console-master-plan.md` 5.3절.

완료 시 다음이 모두 참이어야 한다.

1. flagged 기록을 콘솔에서 **무효 처리**(랭킹·공동 목표에서 계속 제외 확정) 또는 **정상 판정**(flag 해제, 랭킹 재포함)할 수 있다.
2. 주간 랭킹 보상을 **지급안 미리보기 → 운영자 승인 버튼 → 일괄 지급**으로 처리할 수 있다.
3. 같은 주에 대한 중복 지급이 구조적으로 불가능하다.
4. 지급은 전부 `pointsRepository` 경유이고 트랜잭션 로그·감사 로그가 남는다.
5. 쓰기 게이트가 꺼져 있으면 Phase 2 기능 전체가 보이지도, 동작하지도 않는다.

## 확정 지급 정책 (재론 금지 — `docs/next-work-roadmap-2026-07.md` 1절)

- 주간 랭킹(match3·deck): 1위 3,000 / 2위 2,000 / 3위 1,000 / 참여 500P — **한 사람은 게임별 최고 1건만, 랭킹 보상과 참여 보상은 중복 없음**(1~3위는 참여 500P를 따로 받지 않는다).
- 공동 목표 달성 주: 그 주 idle 제출자 전원 500P — **랭킹 보상과 중복 허용**.
- 미연결(`/게임연결` 안 한) 기록은 지급 대상 제외, 미리보기에 "미연결 제외 N건"으로 표시.
- flagged 기록은 지급 대상 계산에서 제외.

## 현재 전제

- 웹게임 데이터: `src/webgameRepository.js` (`listWeeklyRanking`, `getCommunalGoalProgress`, `getScoresData` 등 — E-1 지시서의 helper 목록 참조).
- 지급: `pointsRepository.adjustUserPoints` 또는 기존 보상 지급 메서드. 트랜잭션에 웹게임 보상임을 식별할 type/relatedType을 부여한다(기존 `MINIGAME_REWARD_RELATED_TYPE` 패턴 참고).
- flag 상태는 `data/webgame-scores.local.json`의 `flagged` 필드. flag 변경은 `webgameRepository`에 메서드를 추가해 처리(원자 저장 유지) — adminApi에서 파일 직접 조작 금지.

## 중요 구현 원칙

1. **반자동 유지.** 자동 지급(스케줄 지급)을 만들지 않는다. 반드시 "미리보기 → 승인 버튼" 2단계. 서버 리플레이 검증(A-1) 완료 전까지 이 단계는 신뢰 게이트다.
2. **멱등성.** 지급 실행 시 `data/webgame-payouts.local.json`(신규, 원자 저장)에 `{ weekKey, gameId 별 지급 내역, executedAt }`을 기록하고, 같은 weekKey 재실행 요청은 409 + 기존 지급 내역 반환. 미리보기는 지급 완료된 주에 대해 "지급 완료됨" 상태를 표시한다.
3. **미리보기=실지급 일치.** 미리보기 API와 실행 API는 **같은 계산 함수**를 사용한다. 미리보기 응답에 계산 스냅숏 해시(또는 항목 수+총액)를 포함하고, 실행 요청에 이를 되돌려받아 불일치 시 409(그 사이 기록 변경 감지).
4. **부분 실패 처리.** 일괄 지급 중 일부 실패 시: 성공 건은 기록, 실패 건은 payout 기록에 `failed` 목록으로 남기고 응답에 명시. 전체 롤백은 시도하지 않는다(트랜잭션 로그가 진실).
5. flag 해제·무효 확정도 감사 로그 + 사유 필수.
6. Phase 1 원칙 전부 승계: 쓰기 게이트, 확인 모달, 참여자 API 불변, 새 dependency 금지, slash command 변경 없음.
7. **git push, PR 생성, `npm run deploy`, `.env` 수정 금지. 로컬 커밋까지만** — 브랜치 `feat/admin-console-webgame-ops-v1`.

## 수정 가능 파일

- `src/adminApi.js`, `src/adminServer.js`
- `src/webgameRepository.js` (flag 변경·payout 기록 메서드 추가 — 하위 호환 유지)
- `public/admin/index.html`, `public/admin/admin.js`, `public/admin/admin.css`
- `scripts/test-webgame-payout-flow.js` (신규), `scripts/test-admin-write-flow.js`·`test-admin-dashboard-flow.js` (약화 금지, 필요 시 확장)
- `scripts/check-release.js`
- `docs/webgame-rankings-ops.md`, `docs/operator-dashboard-guide.md`, `docs/prelaunch-qa-checklist.md`, `README.md`

`src/pointsRepository.js`는 웹게임 보상 식별 상수/메서드가 꼭 필요할 때만 하위 호환 추가.

## 작업 1. flagged 처리 API + UI

- `POST /api/admin/webgames/scores/:id/resolve` — body `{ resolution: 'invalid'|'valid', reason(필수) }`.
  - `invalid`: flagged 유지 + `resolvedAt`/`resolution` 기록(운영 확인 완료 표시 — 목록에서 "확인됨"으로 구분).
  - `valid`: `flagged: false`로 변경 → 랭킹·공동 목표 재포함. 이미 지급 완료된 주의 기록이면 응답 meta에 "지급 재계산 필요 — 수동 정정" 경고를 담는다(자동 재지급 금지).
- UI: E-1 flagged 목록의 각 행에 처리 버튼 2종 + 확인 모달(사유 입력).

## 작업 2. 주간 보상 미리보기 + 실행 API

- `GET /api/admin/webgames/payout-preview?weekKey=` — 확정 정책으로 계산한 지급안: 게임별 1~3위(discordId·displayName·점수·금액), 참여 500P 대상 목록, 공동 목표 달성 여부와 idle 제출자 500P 목록, 미연결/flagged 제외 건수, 총액, 스냅숏 토큰. 지급 완료된 주면 `alreadyPaid: true` + 기존 내역.
- `POST /api/admin/webgames/payout` — body `{ weekKey, snapshotToken, reason? }`. 검증 통과 시 대상 전원에게 `pointsRepository` 경유 지급 + payout 기록 + 감사 로그. 응답에 성공/실패 건 상세.
- UI: 웹게임 섹션에 "주간 보상" 카드 — 주 선택 → 미리보기 표 → 승인 버튼(총액·인원 재확인 모달) → 결과 표시. 지급 완료 주는 내역 열람만.

## 작업 3. 테스트 — `scripts/test-webgame-payout-flow.js`

임시 디렉터리 fixture(웹게임 3파일 + 포인트 상태 + payout 파일) 격리. 필수 검증:

1. 미리보기: 1~3위/참여 500P 중복 없음, 공동 목표 500P 중복 허용, flagged·미연결 제외가 정확하다.
2. 실행 결과 지급 총액·건수 = 미리보기와 일치, 잔액 반영, 트랜잭션 로그에 웹게임 보상 식별자.
3. 같은 weekKey 재실행 409, 미리보기 `alreadyPaid: true`.
4. snapshotToken 불일치(실행 전 기록 변경) 409.
5. flag `valid` 처리 → 랭킹 재포함, `invalid` 처리 → 계속 제외 + 확인됨 표시.
6. 쓰기 게이트 off: Phase 2 라우트 전부 403.
7. 부분 실패 시 성공 건 기록·실패 건 보고.
8. 모든 액션이 감사 로그에 남는다.

## 작업 4. 문서 반영

- `webgame-rankings-ops.md`: 주간 지급 절차를 "콘솔 미리보기 → 승인" 기준으로 전면 갱신(수동 `/포인트관리` 루프는 백업 절차로 강등).
- `operator-dashboard-guide.md`: flagged 처리·보상 지급 사용법, valid 처리 시 재계산 경고 설명.
- `prelaunch-qa-checklist.md`, `README.md` 한 줄 갱신.

## 검증

```bash
node --check src/adminApi.js && node --check src/adminServer.js && node --check src/webgameRepository.js
node scripts/test-webgame-payout-flow.js
node scripts/test-admin-write-flow.js
node scripts/test-admin-dashboard-flow.js
npm run check:release
```

수동 확인(adminServer 경유, 모바일 375×812 포함): fixture 상태에서 미리보기 → 승인 → 재실행 409 → flagged 처리 2종.

## 완료 보고 형식

구현 요약 / 수정 파일 목록 / 통과한 검증 명령 / 수동 확인 결과(못 한 항목은 "확인 대기") / 후속: 첫 실지급은 운영자가 미리보기 수치를 기존 수동 계산과 대조 후 승인할 것, `npm run deploy` 불필요.
