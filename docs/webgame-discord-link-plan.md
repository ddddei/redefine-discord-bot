# 웹게임↔Discord 연동 v1 계획서 — 계정 연결·점수 기록·랭킹 (Codex 실행용)

참여자 목적(함께 즐기기·랭킹 경쟁·포인트 교환, [참여자 맥락] 2026-07-04) 중 ②랭킹과 ③포인트의 공통 기반을 만드는 계획입니다. 장기 보류였던 "웹게임↔Discord 연동"의 실행판이며, 구현 전 [AGENTS.md](../AGENTS.md), [src/AGENTS.md](../src/AGENTS.md), [data/AGENTS.md](../data/AGENTS.md), [scripts/AGENTS.md](../scripts/AGENTS.md)를 먼저 읽어 주세요.

## 0. 선행 조건과 범위 원칙

- 브랜치: `feat/webgame-discord-link-v1` (`main`에서, 디자인 v3와는 독립)
- **v1 범위**: 계정 연결 + 서버 점수 기록 + 주간 랭킹 조회. **포인트 자동 지급은 v1에서 제외** — 부정 방지가 신뢰 수준에 도달하기 전 자동 지급은 위험. 대신 운영자가 주간 랭킹을 보고 기존 포인트 명령으로 수동 지급하는 운영 루프를 v1의 공식 절차로 문서화한다 (목적 ③을 사람 개입으로 먼저 충족).
- 실시간 멀티는 범위 밖 (정적 파일+단일 서버 아키텍처의 도약). "함께"는 8절의 비동기 소셜로 구현.
- 신규 npm 의존성 금지 (adminServer는 순수 `http` — POST 본문 파싱 직접 구현).
- 포인트/교환/미션 상태는 무접촉 (`pointsRepository.js` 수정 없음). 웹게임 데이터는 신규 저장소로 분리.

## 1. 아키텍처 개요

```
[Discord]  /게임연결 → 6자리 코드 발급(10분 유효)
                │
[웹게임 설정 탭]  코드 입력 → POST /game/api/link
                │            서버: 코드 검증 → playerToken(UUID) 발급
                │            브라우저 localStorage에 저장
[게임 종료 시]   POST /game/api/score { token, gameId, score, seed }
                │            서버: 검증(한도·빈도) 후 기록
[Discord]  /게임랭킹 → 이번 주 게임별 상위 10 표시
[웹게임]   랭킹 화면 → GET /game/api/rankings
```

- 게임 API는 admin 서버의 공개 라우트(`/game/api/*`)로, HTTP Basic Auth를 걸지 않는다 (인증은 playerToken).
- admin 서버가 꺼져 있으면(`ADMIN_DASHBOARD_ENABLED !== 'true'`) 게임 자체가 노출되지 않으므로 API도 함께 꺼진다 — 기존 동작과 일관.

## 2. 데이터 (신규 저장소, `pointsRepository` 미사용)

`src/webgameRepository.js` 신규 — 기존 저장 패턴(원자 저장, `*.local.json`)을 따른다.

- `data/webgame-links.local.json`: `{ links: [{ discordId, displayName, playerToken, linkedAt }], pendingCodes: [{ code, discordId, displayName, expiresAt }] }`
  - displayName은 연결 시점의 서버 별명 스냅샷 (랭킹 표시용, 개인정보 최소화 — Discord 태그·아바타 저장 안 함)
- `data/webgame-scores.local.json`: `{ scores: [{ discordId, gameId, score, seed, submittedAt, weekKey, flagged }] }`
  - `weekKey`(예: `2026-W27`)로 주간 랭킹 계산. 기록은 보존(누적 랭킹 후속 대비), 조회만 주 단위.
- 예시 픽스처 `data/webgame-links.example.json`, `data/webgame-scores.example.json` + `npm run validate:data` 스키마 검증 추가.
- **개인정보/보안**: playerToken은 무작위 UUID(추측 불가), 코드는 일회용·10분 만료·사용 즉시 폐기. 관리자 대시보드·API 응답에 discordId 원문 대신 displayName만 노출.

## 3. Discord 명령 (deploy 필요 — 머지 후 `npm run deploy`)

- **`/게임연결`**: 6자리 숫자 코드 DM(불가 시 에페메랄)으로 발급. 안내 카피: "웹게임의 기록 탭 → 계정 연결에 코드를 입력해 주세요. 10분 안에요." 재실행 시 기존 코드 폐기 후 재발급. 이미 연결돼 있으면 재연결(토큰 재발급, 이전 토큰 무효화 — 기기 변경 대응).
- **`/게임랭킹 게임:<선택>`**: 이번 주 상위 10 (displayName + 점수). choices: 간식 맞추기/간식 수호대/간식 공방 키우기. flagged 기록은 제외하고 표시.
- `src/deploy-commands.js` 스키마 추가, `src/handlers.js` 디스패치 추가 (2k줄 파일 — 기존 명령 처리 패턴을 그대로 미러링, 신규 로직은 `src/webgameLink.js`로 분리해 handlers는 위임만).

## 4. 게임 API (`src/adminServer.js` 라우팅 + `src/webgameApi.js` 신규)

| 엔드포인트 | 동작 |
| --- | --- |
| `POST /game/api/link` | `{ code }` → 코드 유효 시 `{ playerToken, displayName }`. 실패: 404/410(만료) |
| `POST /game/api/score` | `{ token, gameId, score, seed? }` → 검증 후 기록, `{ accepted, weekBest }` 반환 |
| `GET /game/api/rankings?gameId=` | 이번 주 상위 10 `{ displayName, score }` 배열 + 내 순위(토큰 헤더 있으면) |
| `GET /game/api/me` (토큰 헤더) | 연결 상태 확인 `{ displayName }` — 게임 로드 시 표시용 |

- POST 본문: `Content-Type: application/json`, 4KB 상한, 직접 파싱(스트림 누적 → JSON.parse, 실패 시 400).
- **부정 방지 v1** (정직한 수준 설정 — 완벽 검증이 아니라 억지력):
  1. 게임별 점수 상한 상수(예: 매치3 30수 이론상 최대를 넉넉히 넘는 값) 초과 → 거부
  2. 빈도 제한: 토큰당 분당 3회, 일 50회 초과 → 429
  3. 이상치 플래그: 직전 주간 최고의 3배 초과 등 휴리스틱 → 기록은 하되 `flagged: true`, 랭킹 제외, 대시보드에 표시 (운영자 판단)
  4. 서버 리플레이 검증(시드+행동 로그 재현 — match3 `board.js`·덱 `engine.js`가 Node 로드 가능하게 이미 설계됨)은 **v2 후보**로 명시
- 점수 제출 대상 v1: 매치3(게임 종료 점수), 덱(런 종료 시 도달 칸×1000+잔여HP 등 단일 점수화 — content에 공식 상수), 방치형(랭킹 부적합 장르 — 주간 누적 생산량 제출로 참여만, 랭킹 화면에서 별도 표기).

## 5. 게임 클라이언트 변경 (3종 공통 모듈)

- `public/shared/link.js` 신규 (공용): 토큰 저장/로드(localStorage `redefine-game-link-v1`), 코드 입력 UI 호출, `submitScore(gameId, score, seed)` — 미연결이면 조용히 no-op (연결은 선택 사항, 게임은 익명으로도 전부 플레이 가능).
- 각 게임: 설정/기록 화면에 "계정 연결" 섹션(코드 입력 폼, 연결 상태 표시, 연결 해제) + 게임 종료 지점에 `submitScore` 1줄 + 랭킹 화면(주간 상위 10 + 내 순위). UI는 기존 `gk-` 컴포넌트 사용.
- **연결 없이도 지금과 동일하게 플레이 가능해야 한다** — 연동은 부가 기능이며 실패(서버 오류·오프라인)해도 게임 진행을 막지 않는다 (fire-and-forget + 콘솔 경고만).

## 6. 테스트

- `scripts/test-webgame-link-flow.js`: 코드 발급→검증→토큰 발급→점수 제출→주간 랭킹 산출→플래그 휴리스틱→코드 만료/재발급/토큰 무효화. repository를 임시 디렉터리로 격리해 순수 Node로.
- `scripts/test-webgame-api.js`: adminServer를 임시 포트로 띄워 실제 HTTP로 link/score/rankings 왕복, 본문 상한·잘못된 JSON·빈도 제한 429 검증.
- 기존 로직 테스트 3본 무수정 통과, `validate:data`에 신규 스키마, `check:release` 등록.
- 수동 QA (adminServer 경유): Discord에서 코드 발급 → 웹게임 연결 → 점수 제출 → `/게임랭킹` 확인 → 미연결 브라우저에서 게임 정상 동작 확인.

## 7. 운영 절차 (v1의 포인트 루프 — docs/webgame-rankings-ops.md 신규)

1. 매주 월요일 운영자가 `/게임랭킹`으로 지난 주 상위자 확인 (또는 대시보드)
2. 운영 정책에 따라 기존 포인트 지급 명령으로 수동 지급 (권장 초안: 1~3위 소액 차등 + 참여자 전원 소액 — **금액은 운영 결정 사항**, 문서에 결정 칸만)
3. flagged 기록 확인 후 필요 시 해당 주 제외
4. 청년동 자판기 교환은 기존 `/상점`→`/교환` 흐름 그대로 (신규 개발 없음)

## 8. 후속 단계 — 비동기 소셜 ("함께 즐기기", 별도 PR들)

연동 v1이 깔리면 낮은 비용으로 이어지는 것들 (각각 소형 계획으로):

1. **일일 시드 챌린지**: 매일 모두 같은 시드(날짜 기반)로 매치3/덱 도전 → 일일 랭킹. 서버 변경 거의 없음(weekKey에 dayKey 추가).
2. **공동 목표**: "이번 주 다 같이 간식 1억 개 만들기" — 방치형 제출 누적을 진행 바로 노출, 달성 시 운영자 공지+보상. 고립·은둔 청년에게 경쟁보다 부담 낮은 참여 형태.
3. **기록 응원**: 랭킹 화면에서 다른 참여자 기록 옆 응원 버튼(횟수만 집계) — 익명의 가벼운 상호작용.
4. 서버 리플레이 검증(v2) → 신뢰 확보 후 **포인트 자동 지급** 검토.

## 9. 영향 범위 / 완료 조건 / 롤백

- **영향 범위**: adminServer에 공개 API 라우트 추가, Discord 명령 2개 추가(deploy 필요), 신규 데이터 파일 2종(local). 기존 포인트/미션/교환 상태 무접촉. 게임은 미연결 시 기존과 동일.
- **완료 조건**: `check:release` 전체 통과(신규 테스트 2본 포함), 6절 수동 QA, 커밋 논리 단위(권장 6개: repository → API → Discord 명령 → 공용 link.js → 게임 3종 적용 → 테스트/문서), PR 하나, 한국어.
- **롤백**: PR revert + (명령이 이미 deploy됐다면) `npm run deploy` 재실행으로 명령 제거. 데이터 파일은 local이라 무해.
