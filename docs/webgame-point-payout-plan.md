# 웹게임 주간 랭킹 포인트 반자동 지급 계획 (A-2)

이 문서는 로드맵 A-2 "포인트 자동 지급"의 구현 계획입니다. **이 문서만 보고 다른 컨텍스트 없이 구현을 시작할 수 있도록** 수정 위치, 함수 시그니처, 테스트 갱신 지점까지 명시합니다. 구현 전 [AGENTS.md](../AGENTS.md), [src/AGENTS.md](../src/AGENTS.md), [scripts/AGENTS.md](../scripts/AGENTS.md)와 [webgame-rankings-ops.md](webgame-rankings-ops.md)를 읽습니다.

## 1. 배경과 목표

- 주간 랭킹 보상은 현재 운영자가 매주 월요일 `/게임랭킹`으로 상위자를 확인하고 `/포인트관리`로 한 명씩 수동 지급합니다([webgame-rankings-ops.md](webgame-rankings-ops.md) "운영자 주간 점검 절차"). 4게임 × (상위 3명 + 참여자)면 매주 수십 건의 수동 입력이고, 누락·오타·중복 위험이 사람에게 걸려 있습니다.
- 선행 조건이던 서버 리플레이 검증 v2(A-1)는 PR #67로 해소됐습니다. flagged 기록은 랭킹 집계에서 이미 자동 제외됩니다(`listWeeklyRanking`).
- 목표: **운영자가 미리보기를 확인하고 버튼 한 번으로 승인하는 반자동 지급.** 완전 자동(무인 지급)은 첫 몇 주 운영 데이터를 본 뒤 별도 결정 — 이번 범위 밖.

## 2. 방식 결정 (대안 비교)

| 방식 | 판단 |
|---|---|
| **신규 운영자 명령 `/게임지급` + 미리보기 + 승인 버튼 (채택)** | 지급 전 전체 내역을 눈으로 확인하는 단계가 구조적으로 보장됨. 기존 운영자 명령 게이트(`ManageMessages` + `isOperator`) 재사용 |
| 완전 자동(스케줄러 지급) | 부정 기록·정책 미결(생존전 포함 여부) 상태에서 무인 지급은 위험. 반자동 운영이 안정된 뒤 별도 계획으로 |
| `/운영현황`에 붙이기 | `/운영현황`은 읽기 전용 리포트 명령 — 상태를 바꾸는 지급과 성격이 다름. 분리 유지 |
| admin 대시보드에서 지급 | "admin은 읽기 전용" 금기(로드맵 7절) 위반. 기각 |

**신규 슬래시 명령 추가 → 머지 후 `npm run deploy` 필요.**

## 3. 지급 정책 (확정분 + 결정 칸)

확정(2026-07-04 운영 결정, [webgame-rankings-ops.md](webgame-rankings-ops.md)):

- 게임별 주간 랭킹: 1위 3,000P / 2위 2,000P / 3위 1,000P
- 참여 보상: 해당 주 제출 기록 1건 이상 500P — **순위 보상 수령자에게는 중복 지급하지 않음**
- 공동 목표(idle): 달성 주의 idle 제출자 전원 500P — **랭킹 보상과 중복 허용**

이 계획서가 채택하는 해석 (구현 전 운영자 확인 필요 — 아래 결정 칸):

1. **순위 보상은 게임별로 각각** 지급합니다 (match3 1위이면서 deck 2위면 3,000P + 2,000P). 수동 루프의 현행 관행과 동일.
2. **참여 보상은 게임 불문 주당 1회** 500P입니다. 그 주에 어떤 게임에서든 순위 보상을 하나라도 받았으면 참여 보상은 제외합니다. ("순위 보상을 받은 참여자에게 참여 보상을 중복 지급하지 않습니다"의 자연스러운 해석이며, 게임별 참여 보상 중복 지급은 4게임 체제에서 총액이 과도해짐)

- **결정 칸 A — 참여 보상 해석**: `[x]` 위 2번(주당 1회) 채택 / `[ ]` 게임별 각각 500P — 결정일: 2026-07-11 (사용자 확정)
- **결정 칸 B — 생존전 포함 여부**(기존 결정 대기 항목): `[x]` 4게임 동일 기준(생존전 포함) / `[ ]` 생존전 제외 후 별도 검토 — 결정일: 2026-07-11 (사용자 확정)
  - 구현은 대상 게임 목록을 상수 `WEEKLY_PAYOUT_GAME_IDS`로 두어 이후 변경도 한 줄 수정으로 반영.

## 4. 설계

### 4-1. 명령과 흐름

```
/게임지급 주차:<지난 주(기본)|이번 주>     ← ManageMessages + isOperator 게이트
  → [미리보기 embed, ephemeral]
     - 게임별 순위 보상: 1~3위 이름·점수·금액 (flagged 제외는 집계에 이미 반영)
     - 참여 보상 대상 수 (정책 3절 해석 기준)
     - 공동 목표: 달성 여부(총합/목표)·달성 시 대상 수
     - 이미 지급된 항목 수 (재실행 시 "지급됨"으로 스킵 예정 표시)
     - 리플레이 mismatch 경고: 해당 주 mismatch 기록 수 + 관련 사용자 수 (있으면 눈에 띄게)
     - 지급 총액
     [✅ 지급 승인] [취소]
  → 승인 버튼 클릭 시 그 시점에 재계산해 실행 (임베드가 오래된 경우 대비)
  → [결과 embed] 지급 N건 · 스킵(기지급) M건 · 총액 — 실패 시 실패 건 목록
```

- 주차 계산: `지난 주` = `getIsoWeekKey(new Date(now - 7일))`, `이번 주` = `getIsoWeekKey(now)`. weekKey 정의(UTC ISO 주차 = KST 월요일 09:00 경계)는 기존 그대로.
- 버튼 customId: `operator_webgame_payout_confirm:<weekKey>` / `operator_webgame_payout_cancel`. 버튼 처리에도 동일 운영자 게이트를 다시 적용합니다(버튼은 다른 사람이 누를 수 있음).
- mismatch는 랭킹에서 자동 제외되지 않으므로(기존 동작 유지) 경고만 표시 — 명백한 조작이 보이면 운영자가 취소하고 해당 건만 수동 처리. 개별 제외 UI는 v2 후보.

### 4-2. 지급 계획 계산 — 신규 `src/webgamePayout.js` (순수 모듈)

```js
buildWeeklyPayoutPlan({ webgameRepository, pointsRepository, weekKey })
// → {
//   weekKey,
//   games: [{ gameId, gameTitle, winners: [{ discordId, displayName, rank, score, amount, alreadyPaid }] }],
//   participation: { amount: 500, recipients: [{ discordId, displayName, alreadyPaid }] },
//   communal: { achieved, total, goal, amount: 500, recipients: [...] } | null,
//   mismatchWarning: { count, userCount } | null,
//   totals: { payableAmount, payableCount, alreadyPaidCount },
// }
```

- 순위: `webgameRepository.listWeeklyRanking(gameId, weekKey, { limit: 3 })`.
- 참여자 전체: `listWeeklyRanking(gameId, weekKey, { limit: 1000 })`을 게임별로 합집합 — 별도 신규 조회 함수 불필요(주간 참여 규모 60~100명에서 충분).
- 공동 목표: `getCommunalGoalProgress(weekKey)` — `total >= goal`(`WEBGAME_COMMUNAL_GOAL`, 기존 env)일 때만 `contributions` 키의 discordId 전원(기여 0 포함 — "그 주 idle 제출자 전원" 정책 그대로).
- `alreadyPaid`는 아래 4-3의 relatedId로 기존 거래를 조회해 표시.
- displayName은 links의 값, 없으면 discordId.
- 실행 함수 `executeWeeklyPayoutPlan(plan, { pointsRepository, operatorId })`은 plan의 각 항목을 4-3 메서드로 순차 지급하고 `{ paid, skipped, failed }`를 반환. 항목 하나의 실패가 나머지를 막지 않게 try/catch 후 계속.

### 4-3. 지급 기록 — `src/pointsRepository.js`에 신규 메서드 (금기 준수: 상태 변경은 반드시 여기 경유)

```js
awardWebgameWeeklyReward({ user: { userId, displayName }, amount, weekKey, gameId, kind, reason, operatorId })
// kind: 'rank1' | 'rank2' | 'rank3' | 'participation' | 'communal'
// relatedType: 'webgameWeeklyReward'
// relatedId:  `${weekKey}:${gameId}:${kind}`   (participation은 gameId 'all')
```

- **멱등성**: 같은 `userId` + `relatedType` + `relatedId` 거래가 이미 있으면 지급하지 않고 `{ ok: false, reason: 'ALREADY_REWARDED', transaction }` 반환 — `awardMinigameReward`의 기존 중복 차단 패턴 그대로. 승인 버튼 이중 클릭·명령 재실행이 안전해지는 근거.
- 거래 reason 형식(기존 수동 관행 유지, `/포인트로그` 추적 가능): `간식 맞추기 2026-W27 주간 랭킹 1위` / `웹게임 2026-W27 주간 참여 보상` / `간식 공방 키우기 2026-W27 공동 목표 달성`.
- `adjustUserPoints`와 동일하게 `ensureUser`·`addTransaction`·`appendPointTransactionLog`(sourceSurface `operator_command`) 경유. `type: 'earn'`, `createdBy: operatorId`.

### 4-4. 화면 문구

- 미리보기·결과 embed는 운영자 전용(ephemeral)이며 기존 운영자 명령 톤(차분·직접)을 따릅니다. 참여자에게 자동 공지하지 않습니다 — 지급 공지는 기존 운영 관행(수동) 유지, 자동 공지는 A-4ⓐ와 함께 별도 검토.
- 결정 칸 B가 "생존전 제외"로 결정되면 미리보기에 "생존전은 지급 대상이 아니에요" 한 줄 표기.

## 5. 수정 대상 파일

| 파일 | 변경 내용 |
|---|---|
| `src/webgamePayout.js` **(신규)** | `buildWeeklyPayoutPlan` / `executeWeeklyPayoutPlan` / `WEEKLY_PAYOUT_GAME_IDS` / 금액 상수. 순수 로직(Discord 객체 무접촉) — 테스트 용이 |
| `src/pointsRepository.js` | `awardWebgameWeeklyReward` 신설(4-3), `createPointsRepository` 반환 객체 + 기존 지급·캡·미니게임 로직 무변경 |
| `src/deploy-commands.js` | `/게임지급` 명령 추가 (`주차` string choice: `지난 주`/`이번 주`, `ManageMessages`) |
| `src/handlers.js` | `/게임지급` 명령 분기 + `operator_webgame_payout_*` 버튼 분기 (운영자 게이트 재확인 포함). 로직은 webgamePayout 모듈에 위임 — handlers 비대화 최소화 |
| `scripts/test-webgame-payout-flow.js` **(신규)** | 아래 6절 |
| `scripts/check-release.js` | 신규 테스트 문법 검사 + 스모크 실행 등록 |
| `docs/webgame-rankings-ops.md` | "운영자 주간 점검 절차"를 `/게임지급` 기준으로 개정(수동 `/포인트관리` 루프는 예외 처리용 폴백으로 남김), 결정 칸 A·B 반영 |
| `.env.example` | 변경 없음(신규 env 없음 — 목표량은 기존 `WEBGAME_COMMUNAL_GOAL` 재사용) |

**건드리지 않는 것**: 기존 `adjustUserPoints`·`awardMinigameReward`·캡/중복 차단 로직, `listWeeklyRanking`·`getCommunalGoalProgress`의 동작, admin 대시보드(읽기 전용 유지), 참여자 대상 화면 전부.

## 6. 테스트 방법

`scripts/test-webgame-payout-flow.js` (신규, `assert` + 임시 경로 fixture — `test-minigame-rankings.js`의 픽스처 패턴 참고, 마지막에 성공 1줄 출력):

1. 여러 게임·여러 사용자 점수 fixture로 `buildWeeklyPayoutPlan`: 게임별 1~3위 금액, flagged 기록이 순위에서 빠지는지(기존 `listWeeklyRanking` 경유 확인), 다른 주차 기록 미포함
2. 참여 보상: 순위 보상 수령자 제외, 여러 게임 참여자도 1회만(결정 칸 A 기본 해석 기준), 제출 0건 사용자 미포함
3. 공동 목표: 미달 주엔 `communal.achieved === false`·지급 대상 없음, 달성 주엔 idle 제출자 전원 + 랭킹 보상과 중복 수령 확인
4. `executeWeeklyPayoutPlan` 실행 후 거래 생성(관련 필드·reason 형식) → **같은 plan 재실행 시 전건 스킵**(멱등성) → 잔액 증가 1회분인지
5. `awardWebgameWeeklyReward` 단독: ALREADY_REWARDED 반환, 다른 주차/다른 kind는 별건으로 지급되는지
6. 명령·버튼 플로 mock(`test-minigame-hub-flow.js`의 interaction mock 패턴): 비운영자 차단, 미리보기 embed 내용, 승인 클릭 → 결과 embed, 취소 클릭
7. mismatch fixture 존재 시 미리보기에 경고 표시

회귀: `npm run check:release` 전체 통과, 기존 테스트 무수정 통과(경계 증명).

수동 검증(머지·deploy 후): 테스트 서버에서 `/게임지급 주차:이번 주` 미리보기 확인 → 승인 → `/포인트로그`에서 거래 확인 → 같은 명령 재실행 시 전건 "지급됨" 표시.

## 7. 롤백 방법

- 코드: 단일 브랜치/PR → `git revert` 한 번. 명령 제거는 revert 후 `npm run deploy` 재실행.
- 데이터: 지급된 거래는 데이터 구조상 일반 거래와 동일 — 잘못 지급된 건은 기존 `/포인트관리` 음수 조정으로 정정(기존 운영 절차 그대로). 저장 포맷·스키마 변경 없음.

## 8. 주의사항

- **이 작업은 포인트를 실제로 지급합니다.** 구현·리뷰 모두 멱등성(4-3)과 게이트(운영자 확인 + 버튼 재확인)를 최우선으로 검증합니다. 샌드위치(Sonnet 구현 + Fable 리뷰) 방식을 권장합니다 — Codex 위임 시엔 지시서에 "pointsRepository 신규 메서드 외 지급 경로 생성 금지·브랜치 필수·main 직접 커밋 금지"를 명시.
- 결정 칸 A·B가 확정되기 전에는 구현을 시작하지 않습니다 (상수 한 줄이지만 테스트 기대값이 갈림).
- 첫 2~3주는 지급 직후 `/포인트로그`와 admin 웹게임 섹션을 대조하는 검증 기간으로 운영하고, 문제가 없으면 완전 자동(스케줄 지급)을 별도 계획으로 검토합니다.
- 커밋은 CommonJS·2-스페이스·세미콜론·작은따옴표 컨벤션, 한국어 커밋·PR. 이 계획서도 브랜치에 함께 커밋합니다.
