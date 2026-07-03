# 매치3 브라우저 미니게임 v1 계획서 (Codex 실행용)

이 문서는 다른 컨텍스트 없이 단독으로 구현 가능하도록 작성된 계획서입니다. 구현 전 이 저장소의 [AGENTS.md](../AGENTS.md), [src/AGENTS.md](../src/AGENTS.md), [scripts/AGENTS.md](../scripts/AGENTS.md)를 먼저 읽어 주세요.

## 1. 개요

참여자들이 가볍게 시간을 보낼 수 있는 브라우저용 매치3 퍼즐 게임 **`간식 맞추기`** 를 만듭니다. 던전월드 세계관과는 무관한 독립 게임이며, 밝고 편안한 간식/디저트 테마를 사용합니다. 기존 `검은 종 생존전`(`public/dungeonworld-survivors/`, [docs/dungeonworld-survivors-web-game.md](dungeonworld-survivors-web-game.md))과 동일한 운영 원칙과 서빙 구조를 따릅니다.

- 브랜치: `feat/match3-web-game-v1`
- 배포 경로: 관리자 서버(`src/adminServer.js`)의 `/game/match3` 라우트
- 정적 파일 위치: `public/match3/`

## 2. 운영 원칙 (생존전과 동일 — 반드시 준수)

- Discord 계정 연동 없음. 포인트 지급/차감/베팅/랭킹 저장 없음.
- 결과는 브라우저 화면 안에서만 끝나며 운영 데이터 JSON에 저장하지 않음.
- `.env` 수정, `npm run deploy` 불필요. 신규 npm 의존성 금지 (순수 HTML/CSS/JS).
- 기존 버튼형 미니게임의 보상 정책은 변경하지 않음.

## 3. 게임 설계 (v1 범위)

- **테마**: 간식/디저트. 타일 6종: `딸기`(strawberry 🍓), `오렌지`(orange 🍊), `사탕`(candy 🍬), `쿠키`(cookie 🍪), `컵케이크`(cupcake 🧁), `젤리`(jelly 🍇). 밝고 채도 높은 파스텔 팔레트 — 생존전의 다크 팔레트와 달리 매치3 장르 관례(밝은 색 대비, 명확한 타일 구분)를 따릅니다.
- **렌더링**: 캔버스가 아닌 DOM(버튼 그리드) + CSS. 이모지 + 타일별 배경색으로 구분하고, 이미지 에셋은 v1에서 사용하지 않습니다. 색맹 접근성을 위해 색상만이 아니라 이모지 형태로도 구분되게 합니다.
- **보드**: 8×8 그리드.
- **조작**: 인접한 두 타일을 클릭(또는 터치) 두 번으로 스왑. 스왑 결과 3개 이상 일렬 매치가 없으면 스왑을 되돌립니다. 드래그 스와이프는 v1 범위 밖.
- **모드**: 이동 30회 제한 스코어 어택 단일 모드. 이동을 모두 쓰면 결과 화면(최종 점수, 최고 콤보, 가장 많이 지운 타일, 가볍고 따뜻한 톤의 짧은 평가 문구)을 표시하고 `다시 하기` 버튼을 제공합니다.
- **점수**: 기본 매치(3개) 30점, 4개 매치 60점, 5개 이상/L·T자 매치 120점. 연쇄(캐스케이드)마다 배수 ×1, ×2, ×3…으로 증가.
- **보드 규칙**:
  - 초기 보드는 매치가 이미 존재하지 않도록 생성.
  - 매치 제거 → 중력으로 낙하 → 상단 리필 → 새 매치 검사 반복(연쇄).
  - 가능한 스왑이 하나도 없으면 "간식을 새로 섞었어요" 안내 후 보드 셔플(이동 횟수 차감 없음).
- **URL 파라미터**: `?seed=<숫자>`가 있으면 시드 기반 결정적 보드 생성(QA/테스트용). 없으면 랜덤.
- **카피 톤**: 한국어, 차분하고 직접적으로 (기존 참여자 카피 컨벤션). 게임 특성상 가볍고 즐거운 표현은 좋지만 과장/호들갑은 피합니다.

## 4. 신규 파일

| 파일 | 내용 |
| --- | --- |
| `public/match3/index.html` | 마크업. 헤더(제목/남은 이동/점수/콤보), 8×8 보드 컨테이너, 결과 모달. `board.js` → `game.js` 순서로 `<script>` 로드 |
| `public/match3/styles.css` | 밝은 파스텔 팔레트, 타일별 배경색. 모바일(세로 480px)에서도 보드가 화면 안에 들어오도록 반응형 |
| `public/match3/board.js` | **순수 로직만** (DOM 접근 금지): 시드 가능한 RNG, 보드 생성(초기 매치 없음 보장), 매치 탐색, 스왑 유효성 검사, 제거/중력/리필, 연쇄 해석, 점수 계산, 가능한 수 존재 검사, 셔플. 브라우저 전역 등록 + 테스트에서 `vm`으로 로드 가능해야 함 (아래 5절 참고) |
| `public/match3/game.js` | DOM 렌더링, 클릭/터치 입력, 선택 상태 표시, 연쇄 애니메이션(CSS 클래스 토글 수준), 결과 모달 표시 |
| `scripts/test-match3-logic.js` | 로직 스모크 테스트 (아래 6절) |
| `scripts/test-match3-static.js` | 정적 구성 스모크 테스트 (아래 6절) |
| `docs/match3-web-game.md` | 운영자용 게임 소개 문서. [docs/dungeonworld-survivors-web-game.md](dungeonworld-survivors-web-game.md)의 "운영 원칙" 절 형식을 따라 작성 |

`board.js`는 생존전의 `content.js`처럼 브라우저 전역(`window.Match3Board = {...}`) 방식으로 노출하되, 파일 끝에 다음 가드를 붙여 Node 테스트에서 `vm.runInNewContext`로 로드할 수 있게 합니다 (참고: `scripts/test-dungeonworld-survivors-static.js`가 `vm`으로 게임 파일을 로드하는 기존 패턴):

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Match3Board;
}
```

## 5. 기존 파일 수정 (파일:줄 기준)

### `src/adminServer.js`

생존전 서빙 코드를 그대로 미러링합니다. 4곳:

1. **줄 25 뒤** — 디렉터리 상수 추가:
   ```js
   const MATCH3_PUBLIC_DIR = path.join(__dirname, '..', 'public', 'match3');
   ```
2. **줄 67~79의 `resolveDungeonworldSurvivorsAsset` 함수 뒤** — 동일 형태의 `resolveMatch3Asset(pathname)` 추가 (`/game/match3` 경로, `MATCH3_PUBLIC_DIR` 기준, 경로 탈출 방지 `startsWith` 검사 포함).
3. **줄 101~103의 `serveDungeonworldSurvivorsAsset` 뒤** — `serveMatch3Asset(res, pathname)` 추가 (인증 없음, `servePublicAsset` 호출).
4. **줄 206~212의 survivors 라우팅 블록 뒤** — 라우팅 추가:
   ```js
   if (
     requestUrl.pathname === '/game/match3'
     || requestUrl.pathname.startsWith('/game/match3/')
   ) {
     serveMatch3Asset(res, requestUrl.pathname);
     return;
   }
   ```

관리자 인증(`requireAdminAuth`)은 걸지 않습니다 — 생존전 게임 경로와 동일하게 공개 경로입니다.

### `scripts/check-release.js`

`checks` 배열에 항목 추가 (기존 항목 형식 그대로 `{ label, command: 'node', args: [...] }`):

1. 문법 검사 2건 — 기존 `public/dungeonworld-survivors/*.js` 문법 검사 항목(줄 134~152 부근) 뒤에:
   - `node --check public/match3/board.js`
   - `node --check public/match3/game.js`
2. 스모크 테스트 2건 — `dungeonworld survivors static smoke test` 항목(줄 477 부근) 뒤에:
   - `node scripts/test-match3-logic.js`
   - `node scripts/test-match3-static.js`

## 6. 테스트

테스트 러너 없이 순수 Node + `assert`, 마지막에 성공 한 줄 출력 (기존 컨벤션, [scripts/AGENTS.md](../scripts/AGENTS.md) 참고).

### `scripts/test-match3-logic.js`

`vm.runInNewContext`로 `board.js`를 로드한 뒤:

- 고정 시드로 생성한 초기 보드에 매치가 없어야 함 (여러 시드 반복 검증).
- 수평/수직 3·4·5개 매치 탐색이 정확해야 함 (수동 구성 보드로 검증).
- 매치가 생기지 않는 스왑은 무효 판정되어야 함.
- 제거 → 중력 → 리필 후 보드에 빈 칸이 없어야 하고, 연쇄가 점수 배수에 반영되어야 함.
- 점수 규칙 검증: 3개=30, 4개=60, 5개+=120, 연쇄 배수.
- 가능한 수가 없는 수동 구성 보드에서 `hasAvailableMove()`(또는 동명 함수)가 `false`를 반환하고, 셔플 후 매치 없는 유효 보드가 되어야 함.
- 같은 시드는 같은 초기 보드를 만들어야 함 (결정성).

### `scripts/test-match3-static.js`

`scripts/test-dungeonworld-survivors-static.js`의 구조를 따라:

- `public/match3/`에 `index.html`, `styles.css`, `board.js`, `game.js` 존재.
- `index.html`이 `board.js`, `game.js`를 이 순서로 로드.
- `src/adminServer.js`에 `/game/match3` 라우트 문자열과 경로 탈출 방지 검사가 존재.
- `docs/match3-web-game.md`에 "포인트 지급 없음" 운영 원칙 문구가 존재.

### 수동 QA

`ADMIN_DASHBOARD_ENABLED=true` + 관리자 계정 환경 변수 설정 후 `npm start` → 브라우저에서 `http://localhost:3000/game/match3` 접속:

- 스왑/매치/연쇄/점수/이동 차감이 동작하고, 30회 소진 시 결과 모달과 `다시 하기`가 동작하는지.
- `?seed=42` 두 번 접속 시 같은 초기 보드인지.
- 모바일 뷰포트(375px)에서 보드가 잘리지 않는지.

## 7. 영향 범위

- **런타임 영향**: `src/adminServer.js`에 공개 정적 라우트 1개 추가뿐. Discord 봇 로직, 포인트/교환/미션 상태, 데이터 JSON 포맷, 기존 미니게임에는 변경 없음.
- **admin 대시보드 비활성 시**(`ADMIN_DASHBOARD_ENABLED !== 'true'`) 서버 자체가 뜨지 않으므로 게임도 노출되지 않음 — 생존전과 동일한 기존 동작이며 v1에서 바꾸지 않음.
- Discord 쪽 안내(미니게임 허브에 링크 추가 등)는 v1 범위 밖. 운영자가 수동으로 URL 공유.

## 8. 완료 조건

1. `npm run check:release` 전체 통과 (신규 검사 4건 포함).
2. 위 수동 QA 통과.
3. 커밋은 논리 단위로 나누되 PR 하나로 제출. 커밋/PR 본문은 한국어.

## 9. 롤백

- 신규 파일 + `adminServer.js`/`check-release.js`의 추가 블록만 있으므로 **PR 머지 커밋 revert 한 번**으로 완전 롤백 가능.
- 데이터 마이그레이션, env 변경, 명령어 재배포가 없어 롤백 후 후속 조치 불필요.

## 10. v1 이후 후보 (이번 구현 범위 아님)

- 스테이지 맵/목표(캔디크러쉬식 진행), 특수 타일(줄 제거/폭발) — v2
- 드래그 스와이프 조작 — v2
- 미니게임 허브에서 링크 버튼 노출 — 별도 계획
- 포인트 연동 — 서버 판정/부정 방지 설계가 선행돼야 하므로 별도 계획
