# 서버 리플레이 검증 v2 계획서 — 시드+행동 로그 재현 검증 (완성 배포판)

> 구현 상태(2026-07-06): 로컬 구현 완료. `feat/webgame-replay-v2` 브랜치에서 scoring.js 추출/검증기/저장·API/클라이언트/admin/테스트·문서가 반영됐습니다. git push, PR 생성, `npm run deploy`는 수행하지 않았습니다.

클라이언트가 신고한 점수를 서버가 **같은 로직으로 재현해 검증**하는 단계입니다. 연동 v1의 부정 방지(상한·빈도·이상치 휴리스틱)를 "정직 억지력"에서 "재현 증명"으로 끌어올리며, **포인트 자동 지급(로드맵 A-2)의 신뢰 게이트**입니다. `board.js`·`engine.js`가 Node에서 로드 가능한 순수 로직으로 이미 설계돼 있어(로직 테스트가 그 증거) 구조 준비는 끝나 있습니다.

## 0. 확정 설계 결정

1. **대상 게임: match3·deck.** idle(행동 로그 개념 없음)·word(서버 채점이라 이미 검증됨)·survivors(실시간 입력)는 대상 외 — 레코드에 `replay: 'skipped'`로 구분만.
2. **불일치는 도입기에 자동 flagged하지 않는다.** 재현 불일치 → `replay: 'mismatch'`로 기록·대시보드 표시·운영자 판단(랭킹에는 유지). 클라이언트 버그로 인한 오탐으로 참여자가 억울하게 차단되는 것을 막는 배려 원칙. 안정화 후 `WEBGAME_REPLAY_STRICT=true`로 mismatch→flagged 자동 전환(env 스위치, 기본 꺼짐).
3. **로그 없는 제출은 계속 받는다** (`replay: 'missing'`) — 구버전 클라이언트·전송 실패 무해. 주간 랭킹은 현행 기준 유지(flagged만 제외). **"verified만 인정"은 랭킹이 아니라 자동 지급(A-2)의 조건**으로만 쓴다.
4. **행동 로그는 저장하지 않는다** — 검증 후 폐기. 예외: mismatch 로그만 진단용으로 별도 파일에 최근 50건 보관(오탐 분석·strict 전환 판단 근거).
5. **이후 게임 로직을 바꾸는 모든 PR은 리플레이 스모크 통과가 완료 조건에 추가된다** — 서버와 클라가 같은 로직 파일을 쓰므로 리플레이는 로직 변경의 안전망이 된다(매치3 특수 타일·덱 갈림길 고도화 착수 전에 이 계획을 먼저 하는 이유).

## 0.1 완성 정의

1. match3·deck 정상 플레이 제출이 `replay: 'verified'`로 기록된다 (일반 판·오늘의 도전·이어하기 재개 런 포함)
2. 조작된 점수(로그와 불일치)가 `mismatch`로 기록되고 admin 대시보드에서 보인다
3. 로그 없는 제출·과대 로그·알 수 없는 로그 버전이 전부 `missing`으로 무해하게 처리된다
4. `WEBGAME_REPLAY_STRICT=true`에서 mismatch가 flagged로 전환된다
5. 검증 실패(서버 예외)가 제출 자체를 막지 않는다 (`missing` 폴백 — 가용성 우선)
6. `check:release` 통과(신규 리플레이 테스트 포함), 기존 웹게임 테스트 전부 무수정 통과, 미연결·구클라 회귀 없음

## 1. 행동 로그 포맷 (클라이언트 → 서버, score 제출 페이로드 확장)

```json
{ "token": "...", "gameId": "match3", "score": 12000, "seed": "20260706", "challenge": "daily",
  "replayLog": { "v": 1, "actions": [...] } }
```

- `v`: 로그 포맷 버전. 서버 상수와 불일치하면 검증 시도 없이 `missing` 처리(로직 개편 시 서버·클라 동시 배포 전 과도기 무해).
- **match3 actions**: 스왑 목록 — `[[r1,c1,r2,c2], ...]` (최대 30개, 되돌려진 무효 스왑은 로그에 넣지 않는다 — RNG 미소비이므로 재현 불필요).
- **deck actions**: 타입 접두 배열 —
  - `["n"]` 다음 칸 진입(enterCurrentNode), `["p", cardId, handIndex]` 카드 사용, `["e"]` 턴 종료, `["r", cardId]` 보상 선택, `["r0"]` 보상 건너뛰기, `["h"]` 휴식 회복, `["x", deckIndex]` 휴식 카드 제거, `["a"]` 다음 노드로(advanceToNextNode)
  - 상한 2,000액션. 이어하기 대응: **actionLog를 런 세이브에 포함**(`game.js`가 관리, 엔진 무수정 — 세이브 검증이 화이트리스트가 아니라 추가 필드 생존). 구세이브(로그 없음)에서 재개한 런은 제출 시 로그 미첨부(`missing`) — 1회성 과도기.
- **본문 상한**: score 엔드포인트만 4KB → **32KB**로 상향(`readJsonBody`에 엔드포인트별 상한 인자). 초과 시 기존대로 400이 아니라, 클라이언트가 로그 크기를 미리 재서 32KB 초과면 **로그만 떼고 제출**(`missing`) — 제출 자체는 항상 성공해야 한다.

## 2. 서버 검증기 (`src/webgameReplay.js` 신규)

- `require('../public/match3/board')`·`require('../public/deck/engine')`·`content.js` — 클라와 동일 파일.
- **match3 재현**: `generateBoard(seed)` + `createRng(seed)`로 시작, 각 스왑에 `isAdjacent` 확인 → `tryApplySwap` → 성공 시 `resolveCascades(grid, rng)`로 점수 누적(클라 `game.js`의 점수 계산 순서와 동일해야 함 — 구현 시 `game.js`의 콤보 배율 로직을 검증기와 **공용 순수 함수로 추출**해 이중 구현을 없앤다. 추출은 표시 계층 리팩터링으로 로직 테스트 무수정 통과 조건).
- **deck 재현**: `createNewRun(seed)` + `trackerFromState` → 액션 순차 적용(각 액션 전 유효성 확인: canPlayCard 등 — 무효 액션 발견 시 즉시 mismatch). 종료 시 `도달 칸 × 1000 + 잔여 HP` 공식으로 점수 산출.
- 판정: `재현 점수 === 제출 점수` → verified. 다름/무효 액션/재현 중 예외 → mismatch. 재현기 자체 예외(예: require 실패)는 missing 폴백 + 콘솔 경고(제출을 막지 않는다).
- **성능 가드**: 검증은 동기 실행(매치3 30수 ~수 ms, 덱 풀런 ~수십 ms — 기존 분당 3회 제한이 상한). 액션 수 상한 초과는 검증 전 missing 처리.

## 3. 저장·API 변경

- `webgame-scores` 레코드에 `replay: 'verified' | 'mismatch' | 'missing' | 'skipped'` 추가 (기존 레코드 관용: 필드 없음 → `'missing'` 해석, 스키마·example 픽스처·validate 갱신 — 비동기 소셜 때의 mode/dayKey 확장과 동일 패턴).
- `POST /game/api/score` 응답에 `replay` 필드 추가(클라 표시용 아님 — 콘솔 진단용, UI 노출 없음: 참여자에게 "검증 실패" 같은 신호를 보여주지 않는다, 배려 원칙).
- strict 모드: `WEBGAME_REPLAY_STRICT=true`면 mismatch 기록 시 `flagged: true` 동시 설정(랭킹 제외). `.env.example`·railway 가이드 추가.
- mismatch 진단 보관: `data/webgame-replay-mismatch.local.json` — `{ records: [{ discordId, gameId, seed, score, replayScore, log, at }] }` 최근 50건 순환. `webgameRepository`에 append 함수(원자 저장), validate에 example 픽스처 추가. 이 파일은 개인 행동 데이터이므로 백업 대상에 넣지 않고 커밋 금지(local).

## 4. 클라이언트 변경 (로직 파일 무수정)

- **match3 `game.js`**: 성공 스왑을 `state.replayActions`에 push(무효 스왑 제외), 게임 시작 시 초기화. 제출 시 `replayLog` 첨부. 콤보 점수 계산을 공용 함수(`board.js`에 추가하지 않고 신규 `public/match3/scoring.js` — 순수 함수, 클라·서버 공용 로드)로 추출.
- **deck `game.js`**: 액션 수행 지점(advance/play/endTurn/reward/rest)마다 `state.actionLog` push — **기존 엔진 호출과 같은 지점에서 기록만 추가**(호출 경로 무변경). 세이브에 자동 포함. 런 종료 제출 시 첨부, 32KB 초과 시 로그 생략.
- 미연결·오프라인 동작 불변(제출 자체가 no-op). 연출·UI 변경 없음.

## 5. admin 대시보드 (PR #66 위에 소형 추가)

- `/api/admin/webgames` counts에 `replayStatus: { verified, mismatch, missing }`(이번 주 기준) 추가 + mismatch 목록 표(최근 10건: 참여자·게임·제출/재현 점수·시각 — 로그 원문은 API에 노출하지 않고 서버 파일로만). 프런트 카드·표 각 1개.
- [webgame-rankings-ops.md](webgame-rankings-ops.md) 갱신: 부정 방지 표에 리플레이 행 추가, 주간 점검 절차에 "mismatch 확인" 1줄, **strict 전환 기준 제안**(2주 연속 mismatch 0건이면 켜기 — 운영 결정 칸).

## 6. 포인트 자동 지급과의 연결 (이 계획의 범위 밖, 명시만)

- A-2(자동 지급)는 "그 주 verified 기록 보유자"를 지급 대상으로 삼는 별도 계획으로 진행한다. 이 계획은 그 전제(검증 상태 필드·운영 가시성·strict 스위치)까지만 만든다.

## 7. 테스트

- 신규 `scripts/test-webgame-replay.js` (repository·검증기 단위):
  - match3: 시드 고정 스왑 시퀀스 재현 점수 = 클라 계산 점수(공용 scoring 함수 기준), 무효 스왑 포함 로그 → mismatch, 점수 위조 → mismatch, 빈 로그·버전 불일치·액션 초과 → missing
  - deck: 시드 고정 풀런 액션 로그 재현 verified, 중간 재개(세이브 로그 이어붙임) verified, 무효 액션(에너지 부족 카드) → mismatch
  - strict 모드 on/off의 flagged 반영, 기존 레코드(replay 필드 없음) 관용 로드, mismatch 파일 50건 순환
- `scripts/test-webgame-api.js`·`test-webgame-social-api.js` **무수정 통과**(하위 호환 증명 — replayLog 없는 제출 동작 불변). score 32KB 상한은 신규 테스트에서.
- 로직 테스트 3본 무수정 통과(scoring.js 추출 후 match3 로직 테스트가 점수 동일성을 추가 검증하도록 확장은 허용 — 기존 케이스 무수정 유지).
- 수동 QA(adminServer): 매치3 실플레이 제출 → 대시보드 verified 확인, 콘솔에서 점수 위조 제출 → mismatch 확인, 덱 이어하기 런 제출 verified, 미연결 회귀.

## 8. 커밋/완료 조건/롤백

- 선행: **PR #66(admin 웹게임 섹션) 머지** (5절이 그 위에 얹힘). 브랜치 `feat/webgame-replay-v2`.
- 권장 커밋 6: ① scoring.js 추출+매치3 클라 적용 ② 검증기(webgameReplay.js)+저장 필드 ③ score API 통합(32KB·strict·mismatch 보관) ④ 덱 클라 로그 ⑤ admin 표시 ⑥ 테스트·픽스처·문서(env 가이드·rankings-ops·이 계획서 완료 표기)
- 완료 조건: 0.1 전부 + 신규 테스트 + 기존 테스트 무수정 통과 + 수동 QA. PR 하나, deploy 불필요.
- 롤백: PR revert — replayLog는 서버가 무시하면 그만이라 구서버·신클라 조합도 무해. `replay` 필드는 구코드가 무시. env 1종 제거.

## 9. v3 이후 (범위 밖)

- 자동 지급(A-2 — 별도 계획), survivors 리플레이(실시간이라 입력 타임스탬프 재현 필요 — 장기), mismatch 자동 알림(운영 채널), 로그 압축 고도화.
