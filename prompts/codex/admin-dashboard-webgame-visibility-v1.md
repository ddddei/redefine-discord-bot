# Codex 작업 지시서

## 작업 이름

관리자 대시보드 웹게임 운영 가시성 v1

## 목표

프로젝트 리디파인 디스코드 봇의 읽기 전용 `/admin` 대시보드에 웹게임 운영 섹션을 추가한다.

현재 웹게임은 Discord 계정 연결, 점수 제출, 주간 랭킹, 오늘의 도전, 공동 목표, 익명 응원, 랭킹 없는 단어 게임까지 구현되어 있다. 하지만 운영자가 flagged 기록과 주간 지급 대상, 오늘의 도전 참여, 공동 목표 진행률, 응원 흐름을 한 화면에서 확인할 방법은 아직 없다. `docs/webgame-rankings-ops.md`는 `/admin`에서 flagged 기록을 확인하는 절차를 안내하지만, 현재 `src/adminApi.js`와 정적 대시보드는 웹게임 데이터를 제공하지 않는다.

완료 시 다음이 모두 참이어야 한다.

1. `/admin`에서 웹게임 운영 섹션이 보이고, 읽기 전용으로만 동작한다.
2. `/api/admin/webgames`가 주간 랭킹, flagged 기록, 오늘의 도전, 공동 목표, 응원 통계를 반환한다.
3. 주간/오늘 랭킹과 공동 목표 계산은 기존 `webgameRepository` helper를 재사용하고, flagged 기록은 랭킹/공동 목표에서 제외된다.
4. flagged 기록은 운영 확인용 목록으로 별도 노출하되, playerToken, 연결 코드, `cheerSalt`, 단어 정답, 실제 비밀값은 노출하지 않는다.
5. example/demo/sample/2030년대 예시 데이터는 운영 데이터처럼 보이지 않게 제외하거나 meta에 제외 건수로만 표시한다.
6. admin 대시보드는 계속 읽기 전용 MVP이며, 포인트 지급/기록 수정/flag 해제 같은 쓰기 기능은 만들지 않는다.

## 기준 문서

먼저 아래 문서를 읽고 현재 main 기준 코드와 비교한다.

- `docs/next-work-roadmap-2026-07.md`의 E-1 항목
- `docs/webgame-rankings-ops.md`
- `docs/webgame-discord-link-plan.md`
- `docs/webgame-async-social-plan.md`
- `docs/admin-dashboard-mvp-plan.md`
- `docs/operator-dashboard-guide.md`
- `docs/prelaunch-qa-checklist.md`
- `README.md`의 웹게임·admin dashboard 관련 섹션

## 현재 전제

- `src/adminServer.js`는 Node 기본 `http` 서버로 `/admin`, `/api/admin/*`, `/game/api/*`, `/game/*` 정적 파일을 함께 제공한다.
- admin API는 `src/adminApi.js`에 읽기 전용 helper를 두고, `src/adminServer.js`의 `handleAdminApi`에서 라우팅한다.
- admin 정적 UI는 `public/admin/index.html`, `public/admin/admin.js`, `public/admin/admin.css`이며 별도 빌드 과정이 없다.
- 웹게임 저장소는 `src/webgameRepository.js`의 `createWebgameRepository`를 사용한다.
- 웹게임 API 상수와 helper는 `src/webgameApi.js`에서 `GAME_DEFINITIONS`, `listRankableGames`, `getCommunalGoal`, `DEFAULT_COMMUNAL_GOAL` 등을 export한다.
- 주요 웹게임 저장소 helper:
  - `listWeeklyRanking(gameId, weekKey, { limit, includeTargetId })`
  - `listDailyRanking(gameId, dayKey, { limit, includeTargetId })`
  - `countDailyParticipants(gameId, dayKey)`
  - `getDailyResultDistribution(gameId, dayKey)` (`word`용)
  - `getCommunalGoalProgress(weekKey)`
  - `countCheers(gameId, periodKey)`
  - `getLinksData()`, `getScoresData()`, `getSocialData()`
- 기본 경로는 `data/webgame-links.local.json`, `data/webgame-scores.local.json`, `data/webgame-social.local.json`이며, `data/*.local.json`은 절대 커밋하지 않는다.

## 중요 구현 원칙

1. **읽기 전용 유지.** `/admin`에 웹게임 지급, 기록 삭제, 점수 수정, flag 해제, 응원 삭제, 연결 해제 같은 쓰기 기능을 추가하지 않는다.
2. **기존 계산 재사용.** 랭킹, 오늘의 도전, 공동 목표, 응원 수는 가능한 한 `webgameRepository`와 `webgameApi`의 기존 helper를 사용한다. 같은 계산식을 admin용으로 새로 복제하지 않는다.
3. **flagged 처리 분리.** 랭킹/오늘의 도전/공동 목표에는 flagged 기록을 포함하지 않는다. flagged 기록은 운영자가 확인할 별도 목록에만 표시한다.
4. **민감값 비노출.** API와 dashboard에 playerToken, pending link code, `cheerSalt`, `WEBGAME_WORD_SALT`, 단어 정답, raw authorization header를 노출하지 않는다.
5. **관리자 열람 범위.** admin에서는 운영 확인을 위해 `discordId` 전체 또는 기존 admin 대시보드 수준의 userId 표시가 가능하다. 단, 참여자용 `/game/api/*` 응답 규칙을 바꾸지 않는다.
6. **example 데이터 금기.** `data/*.example.json`, `isExample`, example/demo/sample ID, 2030년대 예시 날짜가 운영 현황으로 보이지 않게 한다. 기존 `filterOperationalRecords`/`isExampleLikeRecord` 패턴을 재사용한다.
7. **단어 게임 보호.** `word`는 랭킹이 없는 게임이다. `/admin`에는 오늘 참여 수와 성공 시도 분포 정도만 보여주고, 실패자 목록·정답·정답 인덱스·salt는 보여주지 않는다.
8. **새 dependency 금지.** CommonJS, Node 20, 새 npm dependency 없음. 정적 UI는 현행 HTML/CSS/vanilla JS 유지.
9. **slash command 변경 없음.** 이번 작업은 `/admin` 읽기 전용 대시보드 확장이므로 `npm run deploy`가 필요한 slash command 변경을 하지 않는다.
10. **git push, PR 생성, `npm run deploy`, `.env` 수정 금지. 로컬 커밋까지만** — `main`에서 새 브랜치 `feat/admin-webgame-visibility-v1`을 만들어 논리 단위 커밋으로 남긴다 (리뷰가 커밋 단위로 진행된다).

## 수정 가능 파일

- `src/adminApi.js`
- `src/adminServer.js`
- `public/admin/index.html`
- `public/admin/admin.js`
- `public/admin/admin.css`
- `scripts/test-admin-dashboard-flow.js`
- `docs/operator-dashboard-guide.md`
- `docs/prelaunch-qa-checklist.md`
- `docs/webgame-rankings-ops.md`
- `README.md`

필요한 경우에만:

- `src/webgameRepository.js` (기존 helper로는 운영 요약을 만들 수 없을 때만, 동작 하위 호환 유지)
- `src/webgameApi.js` (기존 export 재사용이 어려울 때만, 참여자용 API 응답 변경 금지)
- `scripts/check-release.js` (새 테스트를 release gate에 포함해야 하는 경우만)

위 목록 밖의 파일 수정이 필요하면 먼저 사유를 요약한다.

## 작업 1. admin API 웹게임 요약 추가

`src/adminApi.js`에 웹게임 운영 요약 helper를 추가한다.

권장 함수:

- `createDefaultWebgameRepository()`
- `buildWebgameOperationsSummary(repository = createDefaultWebgameRepository(), options = {})`

입력 옵션:

- `weekKey`: 없으면 `getIsoWeekKey(now)`
- `dayKey`: 없으면 `getDayKey(now)`
- `limit`: 기본 10, 최대 100 clamp (`parseLimit` 재사용)
- `now`: 테스트 주입용 Date 또는 함수

응답 형태는 기존 admin API 스타일을 따른다.

```js
{
  title: '웹게임 운영 현황',
  readOnly: true,
  storageMode: 'local-json',
  generatedAt: '...',
  weekKey: '2026-W27',
  dayKey: '2026-07-05',
  counts: {
    linkedUsers: 0,
    flaggedScores: 0,
    weeklyParticipants: { match3: 0, deck: 0, idle: 0, word: 0 },
    dailyParticipants: { match3: 0, deck: 0, word: 0 },
    cheersThisWeek: 0,
    cheersToday: 0
  },
  weeklyRankings: {
    match3: [],
    deck: []
  },
  dailyChallenges: {
    match3: { participants: 0, ranking: [] },
    deck: { participants: 0, ranking: [] },
    word: { participants: 0, distribution: {} }
  },
  communalGoal: {
    weekKey: '2026-W27',
    goal: 4000000000,
    total: 0,
    participants: 0,
    achieved: false
  },
  flaggedScores: [],
  cheerStats: [],
  meta: {
    readOnly: true,
    storageMode: 'local-json',
    exampleRecordsExcluded: 0
  }
}
```

세부 요구사항:

- `GAME_DEFINITIONS` 또는 로컬 label map으로 게임명을 함께 제공해도 된다.
- `weeklyRankings.match3/deck`은 `listWeeklyRanking` 결과를 사용하고, `countCheers(gameId, weekKey)`로 응원 수를 붙인다.
- `dailyChallenges.match3/deck`은 `listDailyRanking`과 `countDailyParticipants`를 사용하고, `countCheers(gameId, dayKey)`로 응원 수를 붙인다.
- `dailyChallenges.word`는 `getDailyResultDistribution('word', dayKey)`만 사용한다.
- `communalGoal`은 `getCommunalGoalProgress(weekKey)`와 `getCommunalGoal()`을 사용한다.
- `flaggedScores`는 `getScoresData().scores`에서 `flagged === true`인 기록만 최신순으로 제한한다.
- flagged 목록에는 `discordId`, 연결 displayName, `gameId`, `score`, `mode`, `weekKey`, `dayKey`, `submittedAt` 정도만 넣는다. `seed`는 기본적으로 표시하지 않는다. 운영 판단에 꼭 필요하다고 판단될 때만 짧게 표시하고 문서에 이유를 남긴다.
- `cheerStats`는 주간/오늘 응원 수를 게임·기간별로 요약한다. raw cheer sender 목록은 기본 노출하지 않는다.
- `getLinksData()`/`getScoresData()`/`getSocialData()`에서 최상위 `isExample`이 true인 경우 운영 데이터로 표시하지 않고, 빈 결과 + meta warning을 반환한다.
- 개별 레코드도 `filterOperationalRecords` 또는 `isExampleLikeRecord`로 예시성 레코드를 제외한다.

## 작업 2. admin API 라우트 추가

`src/adminServer.js`의 `handleAdminApi`에 새 라우트를 추가한다.

- `GET /api/admin/webgames`

쿼리:

- `limit`
- `weekKey`
- `dayKey`

요구사항:

- 기존 admin API와 동일하게 Basic Auth가 필요하다.
- 응답은 JSON이며, 실패 시 기존 admin API와 같은 500 형태를 따른다.
- `/game/api/*` 참여자용 API와 경로·인증·응답을 바꾸지 않는다.
- `createAdminRequestHandler(repository, webgameApi)` 테스트 구조가 깨지지 않게 한다. 필요하면 세 번째 인자로 webgame repository를 받을 수 있게 확장하되, 기존 호출은 하위 호환되어야 한다.

## 작업 3. 정적 dashboard 섹션 추가

`public/admin/index.html`, `public/admin/admin.js`, `public/admin/admin.css`에 웹게임 섹션을 추가한다.

UI 요구사항:

- 기존 dark read-only dashboard 톤을 유지한다.
- 웹게임 섹션은 한 화면에서 아래를 스캔할 수 있어야 한다.
  - 이번 주 match3/deck 상위 랭킹
  - flagged 기록 목록
  - 오늘의 도전 match3/deck 참여 수와 상위 기록
  - `word` 오늘 참여 수와 성공 시도 분포
  - idle 공동 목표 진행률
  - 응원 통계
- 필터는 최소한 `weekKey`, `dayKey`, `limit` 정도만 둔다. 기록 수정이나 지급 버튼은 만들지 않는다.
- 상태 문구에는 "읽기 전용", `local-json`, example 데이터 제외 여부가 보이게 한다.
- 모바일 375px 폭에서도 표와 필터가 화면을 깨지 않도록 기존 table-wrap/반응형 패턴을 따른다.

금지:

- "지급", "승인", "수정", "삭제", "flag 해제" 버튼.
- playerToken, link code, `cheerSalt`, word 정답 표시.
- 참여자용 게임 API 응답을 dashboard UI가 직접 호출하는 구조.

## 작업 4. 테스트 추가

`scripts/test-admin-dashboard-flow.js`에 웹게임 운영 데이터 fixture와 검증을 추가한다.

권장:

- 임시 디렉터리에 `webgame-links.local.json`, `webgame-scores.local.json`, `webgame-social.local.json`을 만들고 `createWebgameRepository(paths)`로 격리한다.
- `createAdminRequestHandler`에 테스트용 webgame repository를 주입할 수 있게 한다.

필수 검증:

1. `buildWebgameOperationsSummary`가 `readOnly: true`, `storageMode: 'local-json'`, `weekKey`, `dayKey`를 반환한다.
2. match3/deck 주간 랭킹은 사용자별 최고 점수만 표시하고 flagged 기록을 제외한다.
3. flagged 기록은 `flaggedScores`에 최신순으로 표시된다.
4. 오늘의 도전 랭킹과 참여 수가 daily 기록 기준으로 계산된다.
5. `word`는 참여 수와 분포만 표시하고 정답/salt/실패자 목록을 노출하지 않는다.
6. idle 공동 목표는 flagged 기록 제외, 이전 주 baseline, 신규 참여자 baseline 규칙을 따른다.
7. 응원 수가 주간/오늘 기간별로 집계된다.
8. `/api/admin/webgames?limit=101`은 limit 100 clamp를 따른다.
9. `/api/admin/webgames`는 인증 없이는 401, 인증 후에는 200이다.
10. `/admin` HTML에 웹게임 섹션 id가 포함된다.
11. 응답 JSON에 `playerToken`, `pendingCodes`, `cheerSalt`, `WEBGAME_WORD_SALT`, `answer`, `matchedKeyword` 같은 값이 포함되지 않는다.
12. example/demo/sample/2030년대 예시 레코드는 운영 데이터에서 제외되고 meta의 excluded 수치에 반영된다.

기존 테스트는 약화하거나 삭제하지 않는다.

## 작업 5. 문서 반영

다음을 갱신한다.

- `docs/operator-dashboard-guide.md`
  - `/admin` 웹게임 섹션에서 확인 가능한 항목 추가.
  - 쓰기 기능이 없고 지급은 기존 Discord 명령으로 처리한다는 점 유지.
- `docs/webgame-rankings-ops.md`
  - flagged 확인 절차를 실제 `/admin` 웹게임 섹션 기준으로 갱신.
  - E-1 전 임시 직접 파일 확인 문구가 남아 있으면 제거한다.
- `docs/prelaunch-qa-checklist.md`
  - `/admin` 웹게임 섹션 접속, flagged 제외/표시, 오늘의 도전/공동 목표 수치 확인 항목 추가.
- `README.md`
  - admin dashboard가 웹게임 운영 가시성을 제공한다는 한 줄 요약 추가.

주의:

- 웹게임 포인트 자동 지급은 구현하지 않는다.
- 서버 리플레이 검증 v2는 구현하지 않는다.
- 새로운 slash command나 Discord deploy 절차는 추가하지 않는다.

## 검증

작업 완료 후 아래를 실행하고 결과를 보고한다.

```bash
node --check src/adminApi.js
node --check src/adminServer.js
node scripts/test-admin-dashboard-flow.js
npm run validate:data
npm run test:questions
npm run check:release
```

정적 dashboard를 수정했으므로 가능한 경우 admin server를 실제로 띄워 `/admin`을 브라우저에서 확인한다.

권장 로컬 확인:

```bash
ADMIN_DASHBOARD_ENABLED=true ADMIN_DASHBOARD_PASSWORD=test ADMIN_DASHBOARD_PORT=3300 node -e "require('./src/adminServer').startAdminServer({ port: 3300 })"
```

수동 확인 항목:

1. `/admin` 접속과 Basic Auth.
2. 웹게임 섹션이 보이고 새로고침이 동작한다.
3. 주간 랭킹, flagged 기록, 오늘의 도전, word 분포, 공동 목표, 응원 통계가 깨지지 않는다.
4. 모바일 375x812에서 텍스트와 표가 겹치지 않는다.
5. dashboard에 쓰기 버튼이나 민감값이 보이지 않는다.

## 완료 보고 형식

완료 보고에는 아래를 포함한다.

- 구현 요약
- 수정 파일 목록
- 통과한 검증 명령
- 수동 `/admin` 확인 여부와 확인하지 못한 항목
- 후속 운영 작업: 주간 지급은 계속 `/포인트관리` 수동 처리, `npm run deploy` 불필요
