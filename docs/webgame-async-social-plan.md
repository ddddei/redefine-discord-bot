# 웹게임 비동기 소셜 v1 계획서 — 오늘의 도전·공동 목표·기록 응원 (Codex 실행용)

참여자 목적 ①"함께 즐기기"(함께 즐기기·랭킹 경쟁·포인트 교환, [참여자 맥락] 2026-07-04)를 채우는 계획입니다. [webgame-discord-link-plan.md](webgame-discord-link-plan.md) 8절(후속 단계)의 실행판으로, 연동 v1(PR #59) 위에 얹힙니다. 구현 전 [AGENTS.md](../AGENTS.md), [src/AGENTS.md](../src/AGENTS.md), [data/AGENTS.md](../data/AGENTS.md), [scripts/AGENTS.md](../scripts/AGENTS.md)를 먼저 읽어 주세요.

## 0. 선행 조건과 범위 원칙

- 브랜치: `feat/webgame-async-social-v1` (`main`에서. 연동 v1(PR #59)·모바일 하드닝(PR #61) 머지 완료가 전제 — `src/webgameRepository.js`, `src/webgameApi.js`, `public/shared/link.js`가 존재해야 한다)
- **v1 범위**: 기능 세 가지를 한 PR로 — ⓐ 오늘의 도전(일일 시드 챌린지, 매치3·덱), ⓑ 공동 목표(방치형 주간 생산량 합산), ⓒ 기록 응원(랭킹 화면 응원 버튼). 세 기능 모두 **보상·포인트와 무관한 순수 참여 장치**다. 포인트 자동 지급 없음(연동 v1 원칙 유지), 일일 챌린지 보상도 v1 없음.
- 신규 npm 의존성 금지. `pointsRepository.js` 무접촉. 게임 로직 파일(`public/match3/board.js`, `public/{idle,deck}/engine.js`, `public/{idle,deck}/content.js`) 무변경 — 일일 시드는 기존 시드 주입 경로를 재사용한다.
- 연결(계정 링크)은 여전히 선택 사항: **미연결이어도 오늘의 도전 플레이와 공동 목표·랭킹·응원 수 열람은 전부 가능**해야 한다. 미연결 시 막히는 것은 "기록 제출"과 "응원 누르기"뿐.
- 머지 후 `npm run deploy` 필요 (`/게임랭킹` 옵션 추가, 3절).

## 1. 설계 원칙 — 경쟁이 부담스러운 참여자 배려

대상: 쉬었음·준비중·고립은둔·사회적 연결이 부족한 청년 약 60~100명. 랭킹(목적 ②)은 이미 있으므로, 이번 트랙은 **경쟁이 부담스러운 사람이 소외되지 않는 참여 형태**를 추가하는 것이 본질이다. 아래 원칙은 카피·UI·API 응답 설계 전반에 적용한다:

| 원칙 | 구체 결정 |
| --- | --- |
| 순위보다 "함께"를 먼저 보여준다 | 오늘의 도전 화면은 순위표보다 **"오늘 N명이 함께 도전했어요"** 참여 인원을 먼저·크게 노출. 순위표는 그 아래 상위 10만 |
| 실패가 기록되지 않는다 | 오늘의 도전 재도전 무제한(같은 시드), 랭킹은 그날 최고 기록만. "실패 N회" 같은 표기 금지 |
| 하위권을 만들지 않는다 | 상위 10 밖은 순위 미노출(기존 정책 유지). 내 순위는 나에게만(`myRank`), "꼴찌·최하위" 류 표현 금지 |
| 기여 경쟁을 만들지 않는다 | 공동 목표는 **개인 기여 순위 없음** — 총합과 참여 인원만 공개, 내 기여량은 나에게만 표시 |
| 응원은 익명·단방향·무압박 | 응원은 횟수만 집계(누가 눌렀는지 어디에도 미노출), 받은 사람에게 알림 없음(v1), 자기 자신에게는 불가 |
| 침묵을 존중한다 | 푸시·DM·소리·진동 없음(모바일 하드닝 원칙 유지). 참여를 독촉하는 카피 금지 ("아직 도전 안 했어요" ❌ → "오늘의 간식판이 준비돼 있어요" ⭕) |
| 카피 톤 | 기존 차분한 존댓말 유지. 도발·조롱·비교 프레임 금지 |

## 2. 시간 기준과 시드 규칙 (공통 기반)

### 2.1 dayKey — KST 날짜

- `dayKey`는 **한국 시간(UTC+9) 기준 날짜** `YYYY-MM-DD`. 참여자 체감상 "오늘"은 KST이기 때문. KST는 서머타임이 없으므로 고정 오프셋 계산이 안전하다:
  ```js
  function getDayKey(date = new Date()) {
    return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  ```
- 기존 `weekKey`(ISO 주, UTC 기준)는 **변경하지 않는다** — 주간 랭킹·지급 절차와의 호환 유지. 주 경계(월요일 0시 UTC = 월요일 9시 KST)와 일 경계가 9시간 어긋나는 것은 알고 받아들이는 트레이드오프이며 운영 문서에 한 줄 명시한다.

### 2.2 일일 시드 — 공개·결정적

- 그날의 시드는 `dayKey`의 숫자형: `2026-07-04` → `20260704`. 매치3·덱이 같은 값을 쓴다(두 게임의 시드 해석은 각자의 로직이 하므로 보드는 당연히 다르다).
- 시드 파생을 서버·클라이언트 양쪽에 두지 않는다 — **서버가 유일한 소스**다. 클라이언트는 `GET /game/api/daily`(5절)로 받은 시드로만 시작한다 (클라이언트 시계 오차·시간대 문제 원천 차단).
- 시드가 예측 가능(내일 시드를 URL `?seed=`로 미리 연습 가능)한 것은 **의도적으로 수용**한다: 어차피 클라이언트 코드가 공개라 해시를 써도 감출 수 없고, 연동 v1의 부정 방지 철학(완벽 검증이 아니라 억지력)과 일관. 제출은 서버가 "오늘(또는 어제, 2.3) 시드"만 daily로 인정하므로 미리 제출할 수는 없다.

### 2.3 자정 걸침 유예

- 23:50에 시작해 00:05에 끝난 판이 버려지지 않도록, 서버는 daily 제출의 시드를 **오늘과 어제** 두 기대값과 비교한다:
  - 오늘 시드와 일치 → `dayKey = 오늘`로 daily 기록
  - 어제 시드와 일치 → `dayKey = 어제`로 daily 기록 (어제 랭킹에 반영)
  - 둘 다 불일치 → **오류가 아니라 free 플레이로 다운그레이드 기록**하고 응답에 `mode: 'free'`를 명시 (클라이언트 재제출로 빈도 제한을 소모하지 않도록 한 번의 쓰기로 처리)
- 덱은 이어하기로 런이 이틀을 넘길 수 있다 — 그 경우 free로 다운그레이드된다. 허용 범위로 문서화(런 하나가 48시간을 넘는 것은 드물고, 주간 랭킹에는 여전히 반영됨).

## 3. Discord 명령 변경 (`/게임랭킹` 확장 — deploy 필요)

신규 명령은 없다. `src/deploy-commands.js`의 `/게임랭킹`에 옵션을 추가하고 `src/webgameLink.js`의 `runRankingCommand`를 확장한다:

- **옵션 `기간`** (choice, 선택적, 기본 `이번 주`): `이번 주` / `오늘의 도전`
  - `이번 주`: 기존 주간 랭킹 (동작 불변). 단 각 줄 끝에 응원 수가 있으면 `👏 n` 표기 추가
  - `오늘의 도전`: 해당 게임의 오늘(dayKey KST) daily 랭킹 상위 10 + 첫 줄에 "오늘 N명이 함께 도전했어요". 기록 없으면 "오늘의 도전 기록이 아직 없어요."
- **`게임: 간식 공방 키우기(idle)` 선택 시**: 기존 "랭킹 대상이 아니에요" 응답을 **공동 목표 진행 embed로 교체**:
  - 제목: "이번 주 다 같이 간식 만들기"
  - 본문: 목표량·현재 총합·달성률(진행 바 문자 예: `▓▓▓▓▓░░░░░ 52%`)·참여 인원·주차. 달성 시 "이번 주 목표를 함께 달성했어요! 🎉"
  - `기간: 오늘의 도전` + idle 조합은 "간식 공방 키우기에는 오늘의 도전이 없어요. 대신 이번 주 공동 목표가 있어요." + 동일 embed
- handlers.js는 기존 위임 패턴 유지 (로직은 전부 `webgameLink.js`).

## 4. 데이터 (저장소 확장 + 신규 파일 1종)

### 4.1 `data/webgame-scores.local.json` — 레코드 필드 추가 (하위 호환)

- 레코드에 `mode: 'free' | 'daily'`와 `dayKey: 'YYYY-MM-DD' | null` 추가. daily 제출만 dayKey를 채운다.
- **기존 레코드는 마이그레이션하지 않는다**: 로드 시 `mode` 없음 → `'free'`, `dayKey` 없음 → `null`로 관용 해석. `recordScore`는 항상 두 필드를 쓴다.
- `data/webgame-scores.example.json` 픽스처에 daily 레코드 예시 추가, `validate:data` 스키마 갱신(두 필드 허용값 검증, 필드 부재도 허용 — 하위 호환).

### 4.2 `data/webgame-social.local.json` — 신규 (응원 저장소)

```json
{
  "version": 1,
  "isExample": false,
  "description": "...",
  "cheerSalt": "<최초 생성 시 crypto.randomBytes(16).toString('hex')>",
  "cheers": [
    { "fromDiscordId": "...", "targetDiscordId": "...", "gameId": "match3", "periodKey": "2026-W27", "createdAt": "ISO" }
  ]
}
```

- `periodKey`: 주간 랭킹 응원이면 `weekKey`(`2026-W27`), 오늘의 도전 응원이면 `dayKey`(`2026-07-04`) — 형식으로 구분되므로 별도 scope 필드 없음.
- `cheerSalt`: 응원 대상 익명 ID(4.3) 생성용. 파일 최초 생성 시 한 번 만들어 고정. 연동 v1과 동일하게 **예시 픽스처 폴백 절대 금지** (`webgameRepository.js`의 `loadOrCreate` 패턴·주석 그대로 따를 것 — 픽스처의 salt·ID가 실데이터로 쓰이면 안 됨).
- `data/webgame-social.example.json` 픽스처 + `validate:data` 스키마 추가.
- 저장은 기존 원자 저장 경로(`pointsStore`의 `saveJsonFile`) 재사용. 환경변수 `WEBGAME_SOCIAL_DATA_PATH`로 경로 오버라이드(테스트 격리용, 기존 `WEBGAME_*_DATA_PATH` 관례와 동일).

### 4.3 응원 대상 익명 ID (`targetId`)

- 랭킹 API는 discordId를 절대 노출하지 않는다(연동 v1 원칙). 응원 POST가 대상을 지목하려면 불투명 식별자가 필요:
  - `targetId = sha256(cheerSalt + ':' + discordId).slice(0, 16)` (hex)
  - 서버는 역방향 조회를 links 전체 순회(60~100명)로 해결 — 이 규모에서 성능 문제 없음
- displayName을 키로 쓰지 않는 이유: 중복·개명 가능, 그리고 이름이 곧 식별자가 되면 클라이언트에 불필요한 결합이 생긴다.

### 4.4 `src/webgameRepository.js` 확장 (기존 함수 시그니처 무변경)

추가 함수:

- `getDayKey(date)` — 2.1 (모듈 export, API·명령·테스트 공용)
- `getDailySeed(dayKey)` — 2.2
- `recordScore` 입력에 `mode`, `dayKey` 수용 (기본 `'free'`/`null`)
- `listDailyRanking(gameId, dayKey, { limit })` — daily·비플래그 기록만, 사용자별 최고, `listWeeklyRanking`과 동일한 모양(rank/displayName/score)
- `getMyDailyRank(gameId, dayKey, discordId)`, `getDailyBest(discordId, gameId, dayKey)`
- `countDailyParticipants(gameId, dayKey)` — daily·비플래그 기록의 고유 discordId 수
- `getCommunalGoalProgress(weekKey)` — 4.5의 집계
- `addCheer({ fromDiscordId, targetDiscordId, gameId, periodKey })` — 중복이면 `{ ok: false, reason: 'ALREADY_CHEERED' }`
- `countCheers(gameId, periodKey)` — `Map<targetDiscordId, count>` 반환 (랭킹에 병합용)
- `countCheersSentToday(fromDiscordId, dayKey)` — 일일 응원 한도용
- `resolveTargetId(targetId)` — 4.3 역조회, 없으면 null

### 4.5 공동 목표 주간 기여 집계 (정확한 공식)

방치형이 제출하는 값은 `lifetimeProduced`(누적 총생산, **환생에도 리셋되지 않는 단조 증가 값** — `engine.js` 확인 완료). 주간 기여는 스냅샷 차이로 계산한다:

- 사용자 u의 이번 주 기여 = `max(이번 주 u의 idle 제출값) − baseline(u)`
- `baseline(u)` = 이전 주(weekKey 사전순으로 더 작은 주) u의 idle 제출값 최대치. **이전 주 기록이 없으면 이번 주 u의 첫(=최소) 제출값**을 baseline으로 쓴다.
  - 이유: 연동 전부터 오래 플레이한 사용자가 이번 주 처음 연결하면 첫 제출값이 누적 수십억일 수 있다 — 그것을 통째로 이번 주 기여로 잡으면 공동 목표가 즉시 뻥튀기된다. 첫 제출을 기준점으로 삼으면 "연결 이후 이번 주에 실제로 만든 양"만 잡힌다 (신규 참여자의 첫 세션 일부가 누락되는 과소 집계는 수용 — 과대보다 안전).
- 음수는 0으로 클램프(제출값 이상 상황 방어). `flagged` 기록 제외.
- 전체 진행 = Σ 기여, 참여 인원 = 이번 주 idle 제출이 있는 고유 discordId 수.
- 집계는 조회 시 scores 전체 스캔으로 계산(파생값 저장 없음) — 이 규모(주당 수백 레코드)에서 충분하고, 저장된 파생값의 정합성 문제를 만들지 않는다.

### 4.6 주간 목표량 설정

- 환경변수 `WEBGAME_COMMUNAL_GOAL` (자연수, 주간 목표 생산량). 미설정 시 코드 기본값 사용.
- **기본값은 구현 시 실측으로 산정**한다: `content.js` 밸런스로 "가볍게 플레이하는 1인의 주간 예상 생산량"을 추정하고 × 활성 20명 × 여유 계수 0.7 수준으로 "닿을 수 있는 목표"를 잡는다. 산정 근거와 수치를 보고서에 남기고 운영 문서에 기록한다 (첫 주 운영 후 env로 조정하는 것이 공식 절차 — 7절).
- `.env.example`과 [railway-env-guide.md](railway-env-guide.md)에 항목 추가.

## 5. 게임 API 확장 (`src/webgameApi.js` + `src/adminServer.js` 라우팅)

| 엔드포인트 | 동작 |
| --- | --- |
| `GET /game/api/daily?gameId=` | 신규. `{ dayKey, seed, participants, ranking, myBest, myRank }` — ranking은 오늘 상위 10(응원 수·targetId·isMe 포함, 5.3), myBest/myRank는 토큰 헤더 있을 때만. idle이면 400 `NOT_DAILY` |
| `POST /game/api/score` | 확장. body에 선택 필드 `challenge: 'daily'` — 있으면 2.3 규칙으로 daily/free 판정·기록, 응답에 `mode`와 (daily면) `dayKey`·`dayBest` 추가. `challenge` 없는 기존 제출은 **바이트 단위로 기존과 동일하게 동작** (하위 호환 — 기존 테스트 무수정 통과가 증거) |
| `GET /game/api/rankings?gameId=` | 확장. 각 entry에 `targetId`, `cheers`(해당 주 응원 수), `isMe`(토큰 헤더의 본인 여부) 추가 |
| `GET /game/api/goal` | 신규. `{ weekKey, goal, total, participants, achieved, myContribution }` — myContribution은 토큰 헤더 있을 때만, 없으면 null |
| `POST /game/api/cheer` | 신규. `{ token, targetId, gameId, periodKey }` → 검증 후 `{ ok: true, cheers }`(대상의 갱신된 응원 수) |

### 5.1 `/cheer` 검증 순서

1. 토큰 필수(401) — 응원은 연결된 사람만 (중복 방지 주체가 필요하므로)
2. `gameId` 유효(400) — match3/deck만. idle은 랭킹이 없으므로 응원 대상 아님(400 `NOT_CHEERABLE`)
3. `periodKey`가 **현재 weekKey 또는 현재·어제 dayKey**와 일치(400 `INVALID_PERIOD`) — 과거 임의 기간에 응원 쌓기 방지 (어제 dayKey 허용은 자정 직후 어제 랭킹을 보며 응원하는 자연스러운 경우 때문)
4. `resolveTargetId` 성공(404 `TARGET_NOT_FOUND`)
5. 자기 자신이면 400 `CANNOT_CHEER_SELF` (클라이언트는 isMe 행에서 버튼 자체를 숨기므로 정상 경로에서는 도달하지 않음)
6. 한도: 분당 10회(인메모리, 연동 v1의 `linkAttemptsByAddress` 패턴 재사용 — 토큰 기준), 일 30회(저장된 cheers 카운트 기준) 초과 시 429
7. 중복(같은 from·target·gameId·periodKey)이면 200 + `{ ok: true, alreadyCheered: true, cheers }` — 오류로 취급하지 않는다(연타는 자연스러운 행동, 카운트만 안 올라감)

### 5.2 점수 제출·응원의 빈도 제한 상호작용

- daily 제출은 기존 score 빈도 제한(분당 3·일 50)을 **공유**한다 — 별도 한도를 만들지 않는다 (재도전 무제한이어도 일 50회 안에서라는 뜻, 카피에는 노출하지 않음).
- cheer 한도는 score와 **독립** (응원이 점수 제출 몫을 갉아먹으면 안 됨).

### 5.3 랭킹 entry 확장 형태

```json
{ "rank": 1, "displayName": "달콤이", "score": 12000, "targetId": "a1b2c3d4e5f60708", "cheers": 3, "isMe": false }
```

- `isMe`는 토큰 헤더가 있고 그 링크의 discordId와 일치할 때만 true. 토큰이 없으면 전부 false.
- 응원 수 병합은 `countCheers` Map 한 번 조회로 (entry마다 파일을 다시 읽지 않는다).

## 6. 게임 클라이언트 변경

### 6.1 `public/shared/link.js` 확장 (공용, `GameLink`에 함수 추가)

- `fetchDaily(gameId)` — `/game/api/daily` 래핑, 실패 시 `{ ok: false }` (기존 패턴: 콘솔 경고만, 게임 진행 무영향)
- `fetchGoal()` — `/game/api/goal` 래핑
- `sendCheer(gameId, periodKey, targetId)` — `/game/api/cheer` 래핑
- `submitScore(gameId, score, seed, options)` — 4번째 인자 `{ challenge: 'daily' }` 추가 (기존 3인자 호출은 동작 불변)
- `renderRankingSection(containerEl, gameId)` 확장:
  - 각 행에 응원 수 표기(`👏 3` — 0이면 미표기)와, **연결돼 있고 isMe가 아닌 행**에만 "응원하기" 버튼(gk 컴포넌트, 44px 터치 타겟 준수)
  - 버튼 클릭 → `sendCheer` → 성공 시 해당 행 카운트만 갱신 + 버튼을 "응원했어요"로 비활성화 (재렌더링으로 목록 전체를 다시 그리지 않는다 — 모바일 하드닝의 DOM 재생성 회피 원칙)
  - 미연결이면 버튼 없이 카운트만 (응원을 하고 싶으면 자연스럽게 연결 동기가 됨 — 단, 유도 문구는 넣지 않는다)
- `renderDailySection(containerEl, gameId, options)` — 신규 공용 헬퍼: "오늘 N명이 함께 도전했어요" 헤더 + 오늘 랭킹(응원 포함) + 내 오늘 기록. `options.onStart`가 있으면 "오늘의 도전 시작" 버튼 렌더(시드를 콜백에 전달). 서버 실패 시 "오늘의 도전을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." 한 줄만.

### 6.2 매치3 (`public/match3/`)

- 보드 아래 버튼 영역(엄지 존)에 **"오늘의 도전"** 버튼 추가. 클릭 → `fetchDaily('match3')` → 받은 시드로 새 판 시작(`createGameState`의 시드 주입 경로 재사용 — URL 파라미터 의존 제거를 위해 `createGameState(seed)` 형태로 시드 인자화 허용, `board.js` 무변경), 화면에 "오늘의 간식판" 표시(칩 등 소형 표기).
- daily 판 종료 시 `submitScore('match3', score, seed, { challenge: 'daily' })`. 결과 화면에 `renderDailySection`(오늘 랭킹) — 기존 주간 랭킹 섹션과 병렬 배치(오늘이 위).
- daily 진행 중 "다시 하기"는 같은 오늘 시드로 재시작(재도전). 일반 판으로 돌아가는 경로도 유지.
- `?seed=` URL 파라미터 직접 진입은 기존대로 free 플레이 (서버가 어차피 daily로 인정하지 않음 — 클라이언트에서 막을 필요 없음).

### 6.3 덱 (`public/deck/`)

- 시작 화면(새 런 시작 지점)에 **"오늘의 도전으로 시작"** 선택지 추가 — `fetchDaily('deck')`의 시드로 새 런 시작. 런 저장 상태에 daily 여부·시드가 이미 보존되므로(시드는 런 상태에 포함) 이어하기와 자연 공존.
- 런 종료 시 daily 런이면 `challenge: 'daily'`로 제출. 자정을 넘긴 이어하기는 서버가 2.3 규칙으로 처리(어제로 인정 또는 free 다운그레이드) — 클라이언트는 신경 쓰지 않는다.
- 결과 화면에 `renderDailySection` 추가(주간 랭킹 위).

### 6.4 방치형 (`public/idle/`)

- 오늘의 도전 없음. 기록 탭에 **공동 목표 패널** 추가(연결 섹션 위):
  - "이번 주 다 같이 간식 만들기" 제목 + 진행 바(gk 스타일, CSS로 폭 표현) + "지금까지 X개 / 목표 Y개 · Z명이 함께하고 있어요"
  - 연결돼 있으면 "내 몫: W개" 한 줄 추가 (나에게만 보임 — 1절 원칙)
  - 달성 시 진행 바 100% + "이번 주 목표를 함께 달성했어요! 🎉" (그 이상 수치는 계속 누적 표기)
  - 서버 실패 시 패널에 차분한 실패 한 줄, 게임 무영향
- 기록 탭 진입 시 기존 `submitWeeklyProduction()` 직후 `fetchGoal()`로 패널 갱신 (제출 → 조회 순서로 내 기여가 바로 반영되게. 단 제출은 fire-and-forget이므로 완료를 기다렸다가 조회하는 체이닝은 `submitScore` promise를 그대로 활용).

### 6.5 공통 규칙

- 새 UI는 전부 기존 `gk-` 컴포넌트·모바일 하드닝 규칙(44px 타겟, 엄지 존, `touch-action`) 준수. `game-ui.css`에 응원 버튼·진행 바·오늘의 도전 칩 공용 클래스 추가.
- 네트워크 실패·서버 꺼짐에서 게임 본체는 항상 정상 (fire-and-forget + 차분한 한 줄).
- 카피는 1절 원칙 준수. 신규 카피 전체 목록을 보고서에 첨부할 것(톤 리뷰 대상).
- 첫 화면 전송량 예산(게임당 ≤ 400KB, 모바일 하드닝 계획 7절) 준수 — 이번 추가는 JS/CSS 수 KB 수준이라 여유 있음, 실측 재확인만.

## 7. 운영 절차 (docs/webgame-rankings-ops.md에 절 추가)

1. **오늘의 도전**: 자동 순환(운영자 개입 없음). v1에서는 일일 보상 없음 — 주간 랭킹 지급(기존 정책)만 유지. 일일 기록도 주간 랭킹에 그대로 합산된다(같은 점수 저장소).
2. **공동 목표**: 매주 월요일 주간 점검 시 `/게임랭킹 게임:간식 공방 키우기`로 지난 주 달성 여부 확인 → 달성했으면 **운영자가 공지 채널에 수동 공지 + 참여자 전원(그 주 idle 제출자) 소액 보상 수동 지급**. 보상 금액은 운영 결정 사항 — 문서에 결정 칸만 두고, 기존 주간 랭킹 지급과의 중복 정책(중복 지급 없음 원칙을 따를지)도 결정 칸으로 남긴다.
3. **목표량 조정**: 첫 주 운영 후 달성률을 보고 `WEBGAME_COMMUNAL_GOAL` env로 조정(Railway 변수 변경 + 재시작). "2주 연속 20% 미만이면 하향, 첫날 달성이면 상향" 가이드 한 줄.
4. **응원**: 운영자 개입 없음. 악용(도배)은 한도(일 30회)로 억제되며, 문제가 보이면 `data/webgame-social.local.json`에서 직접 확인 가능.
5. dayKey는 KST, weekKey는 UTC ISO 주 — 주 경계가 월요일 오전 9시(KST)라는 점을 주간 점검 절차에 한 줄 명시.

## 8. 테스트

### 8.1 `scripts/test-webgame-social-flow.js` (신규 — repository 단위, 임시 디렉터리 격리)

- `getDayKey` KST 경계(UTC 15:00 = KST 자정 전후), `getDailySeed` 결정성
- daily 기록 → `listDailyRanking`·`countDailyParticipants`·`getMyDailyRank` (사용자별 최고 1건, flagged 제외)
- 자정 유예: 어제 시드 제출 → 어제 dayKey로 daily 기록, 그제 시드 → free 다운그레이드
- 공동 목표 집계(4.5 공식): 이전 주 기록 있는 사용자 / 이번 주 첫 제출 사용자(첫 제출이 baseline) / 제출 1건뿐인 신규(기여 0) / flagged 제외 / 음수 클램프
- 응원: addCheer 성공 → 중복 → self 차단 로직은 API 층이므로 여기선 dedup만, `countCheers` 집계, `resolveTargetId` 왕복, cheerSalt 고정성(재로드 후 동일)
- 기존 레코드(mode/dayKey 없는)와 신규 레코드 혼재 시 주간 랭킹·주간 최고 동작 불변

### 8.2 `scripts/test-webgame-social-api.js` (신규 — 임시 포트 HTTP 왕복)

- `GET /daily`: 시드·참여 수·ranking(targetId/cheers/isMe), idle → 400, 토큰 유무별 myBest
- `POST /score` + `challenge: 'daily'`: daily 기록, 시드 불일치 → free 다운그레이드 응답, challenge 없는 제출 기존 동작
- `GET /goal`: 토큰 유무별 myContribution, env 목표값 반영
- `POST /cheer`: 정상 → 중복(200 alreadyCheered) → self(400) → 잘못된 periodKey(400) → 무토큰(401) → 일 한도(429)
- `GET /rankings`: entry 확장 필드 존재
- 4KB 본문 상한·JSON 오류 처리 상속 확인(공용 파서 경유 확인 1건이면 충분)

### 8.3 기존 게이트

- `scripts/test-webgame-link-flow.js`·`test-webgame-api.js` **무수정 통과** (score API 하위 호환 증명)
- 로직 테스트 3본(`test-{match3,idle,deck}-logic.js`) **무수정 통과** (로직 무변경 증명)
- `validate:data`에 social 스키마 + scores 필드 확장, `check:release`에 신규 테스트 2본 등록
- 정적 테스트(`test-mobile-hardening-static.js`) 통과 유지 (소리·진동 부재 검증 포함 — 응원 UI가 이를 어기면 안 됨)

### 8.4 수동 QA (adminServer 경유 필수, 모바일 뷰포트 375×812 기본)

1. Discord에서 코드 발급 → 연결 (기존 흐름 회귀)
2. 매치3 오늘의 도전 시작 → 종료 → 오늘 랭킹에 반영·참여 수 증가 → 재도전 → 최고 기록만 유지
3. 두 번째 계정(또는 두 번째 링크)으로 같은 시드 보드 확인(같은 배치), 랭킹에 두 명 표시
4. 응원 버튼: 상대 행에만 표시, 클릭 → 카운트 +1 → 재클릭 "응원했어요" 유지, 내 행에는 버튼 없음
5. 덱 오늘의 도전 런 시작 → 이어하기 → 종료 제출
6. 방치형 기록 탭: 공동 목표 진행 바·내 몫 표시, `/게임랭킹 게임:간식 공방 키우기`와 수치 일치
7. `/게임랭킹 기간:오늘의 도전` embed 확인
8. **미연결 브라우저(시크릿)**: 3종 전부 기존과 동일 플레이 가능, 오늘의 도전 플레이 가능(제출만 안 됨), 랭킹·응원 수·공동 목표 열람 가능, 응원 버튼 미표시
9. 서버 API를 일부러 죽인 상태(정적 파일만)에서 게임 본체 정상 — 이 케이스는 adminServer 특성상 재현이 어려우면 DevTools 오프라인으로 대체

## 9. 커밋/PR 구성·완료 조건·롤백

- 권장 커밋 7개:
  1. repository 확장 (dayKey·시드·daily 조회·공동 목표 집계·social 저장소·픽스처·validate)
  2. API 확장 (daily/goal/cheer 신규 + score challenge + rankings entry 확장 + adminServer 라우팅)
  3. Discord `/게임랭킹` 확장 (deploy-commands + webgameLink + handlers 위임)
  4. 공용 link.js·game-ui.css 확장
  5. 게임 3종 적용 (매치3·덱 오늘의 도전, 방치형 공동 목표 패널)
  6. 테스트 2본 + check:release 등록
  7. 문서 (rankings-ops 절 추가, env 가이드, 게임별 문서 한 줄, 이 계획서 완료 표기)
- **완료 조건**: `check:release` 전체 통과(신규 2본 포함), 기존 웹게임 테스트 4본·로직 3본 무수정 통과, 8.4 수동 QA, 신규 카피 전체 목록 보고, 공동 목표 기본값 산정 근거 보고, PR 하나, 한국어.
- **배포 후속**: 머지 후 `npm run deploy`(`/게임랭킹` 옵션). `WEBGAME_COMMUNAL_GOAL`은 선택(기본값으로 시작 가능).
- **롤백**: PR revert + `npm run deploy` 재실행. `webgame-social.local.json`은 local이라 무해. scores에 남은 `mode`/`dayKey` 필드는 구버전 코드가 무시하므로 무해.

## 10. 범위 밖 (후속 후보)

- 응원 알림(받은 사람에게 DM/표시) — v1은 횟수 집계만. 알림은 "조용히 참여" 원칙과의 긴장을 따로 설계해야 함
- 일일 챌린지 보상·연속 참여(streak) 표기 — streak은 끊겼을 때의 압박이 커서 참여자 맥락상 신중해야 함
- 공동 목표 달성 시 Discord 채널 자동 공지 — v1은 운영자 수동 공지
- 서버 리플레이 검증(v2) → 포인트 자동 지급 (기존 로드맵 유지)
- 방치형 무대 이모지 소품 교체 등 디자인 폴리시 (별도)
