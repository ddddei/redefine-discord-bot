# 웹게임 디자인 리프레시 v1 계획서 — 공통 디자인 시스템 + 연출 강화 (Codex 실행용)

이 문서는 다른 컨텍스트 없이 단독으로 구현 가능하도록 작성된 계획서입니다. 구현 전 [webgame-design-audit.md](webgame-design-audit.md)(점검 보고서)와 이 저장소의 [AGENTS.md](../AGENTS.md), [src/AGENTS.md](../src/AGENTS.md), [scripts/AGENTS.md](../scripts/AGENTS.md)를 먼저 읽어 주세요.

## 0. 선행 조건

- PR #56(덱빌딩 `간식 수호대`)이 `main`에 머지된 뒤 `main`에서 브랜치를 냅니다.
- 브랜치: `feat/webgame-design-refresh-v1`

## 1. 목표와 범위

간식 세계관 웹게임 3종(매치3 `public/match3/`, 방치형 `public/idle/`, 덱 `public/deck/`)의 **시각 언어 통일**과 **연출(juice) 강화**. 참여자 노출(미니게임 허브 링크) 전에 첫인상을 끌어올리는 것이 목적입니다.

**범위에 포함되지 않는 것**: 게임 로직·밸런스 변경 일절 없음(`content.js`/`engine.js`/`board.js` 계열 수정 금지), `검은 종 생존전`(별도 트랙), 미니게임 허브 노출(별도 계획), 이미지/사운드 에셋 도입(순수 CSS/JS 유지).

## 2. 운영 원칙 (기존과 동일 — 반드시 준수)

- 신규 npm 의존성 금지, 빌드 도구 금지 (순수 HTML/CSS/JS).
- `.env` 수정·`npm run deploy` 불필요.
- 카피 톤: 차분하고 직접적. 연출도 동일한 절제 — 화려하되 과장/현란함 금지. 애니메이션은 대부분 300ms 이하로 짧게.

## 3. 공통 디자인 시스템 (`public/shared/`)

### 3.1 신규 파일 `public/shared/game-ui.css`

3종이 함께 로드하는 공용 CSS 한 벌. 두 층으로 구성:

**토큰 층** (`:root`): 현재 3종에 중복 정의된 값을 승격 + radius/모션 스케일 신설

```css
:root {
  /* 색 (현재 공통값 그대로) */
  --surface-cream: #fff7ec;  --surface-panel: #ffffff;  --surface-card: #fdeedd;
  --text-main: #4a3524;      --text-muted: #8a7360;
  --accent-primary: #ff8a5b; --accent-primary-dark: #ef6f3c;
  --accent-gold: #ffb703;    --accent-danger: #e0554f;
  --border-soft: #f1d9bd;    --shadow-soft: 0 12px 24px rgba(154, 107, 56, 0.14);
  /* radius 스케일 — 이 4단계만 사용 (현행 8~24px 혼재를 정리) */
  --radius-sm: 10px; --radius-md: 14px; --radius-lg: 20px; --radius-pill: 999px;
  /* 모션 */
  --motion-fast: 150ms; --motion-base: 250ms; --motion-ease: cubic-bezier(0.2, 0.8, 0.3, 1);
}
```

**컴포넌트 층**: 3종에서 공통으로 쓰는 클래스의 단일 정의

- `.gk-button`(+ `.primary/.secondary/.danger`): 패딩·radius(`--radius-pill`)·호버·**press 피드백**(`:active { transform: scale(0.96); }`) 포함
- `.gk-chip`: 헤더 통계 칩 (라벨+수치)
- `.gk-panel`: 카드 패널 (surface-panel + radius-lg + shadow-soft)
- `.gk-modal` / `.gk-modal-backdrop`: 모달 공통 + **열림/닫힘 트랜지션**(fade + 살짝 위로, `--motion-base`)
- `.gk-header`: 게임 공통 헤더 패턴 — 좌측 게임명(+보조 라인), 우측 칩 나열
- `.gk-float-num`: 떠오르는 숫자 팝업(+N/피해) 공통 키프레임
- `.gk-shake`: 피격 흔들림 공통 키프레임
- 접근성: 파일 말미에 `@media (prefers-reduced-motion: reduce)`로 모든 공용 애니메이션·트랜지션 축소(0.01ms) — **게임별 CSS의 애니메이션도 이 블록에서 함께 꺼지도록 각 게임의 키프레임 사용 클래스에 적용**

접두사 `gk-`(game kit)로 각 게임의 기존 클래스와 충돌을 피합니다. 각 게임의 `styles.css`는 자기 게임 고유 스타일만 남기고, 공통 부분은 `gk-` 클래스 사용으로 대체합니다 (기존 `.button` 등 중복 정의 삭제).

### 3.2 서빙 라우트 `/game/shared/`

각 게임 HTML이 `<link rel="stylesheet" href="../shared/game-ui.css">`(상대 경로)로 로드할 수 있도록, `src/adminServer.js`에 기존 게임 라우트를 미러링해 `/game/shared` 정적 라우트를 추가합니다 (디렉터리 상수 → resolve → serve → 라우팅 4곳, 경로 탈출 방지 포함, 인증 없음). 게임 CSS보다 **먼저** 로드해 게임별 CSS가 덮어쓸 수 있게 합니다.

## 4. 게임별 적용 + 연출 강화

모든 연출은 CSS 클래스 토글 수준으로 구현하고(JS 타이머는 클래스 제거용 최소한만), 게임 로직 파일은 수정하지 않습니다. `game.js`의 렌더링 함수에만 손댑니다.

### 4.1 매치3 `public/match3/` — 레이아웃 개편 + 연출 보강

- **앱형 카드 레이아웃으로 개편** (가장 큰 작업): 문서형 페이지 → 방치형/덱과 같은 중앙 카드(최대 폭 520px). `.gk-header`로 헤더 통일(영문 오버라인 "SNACK MATCH PUZZLE" 제거, 게임명 `간식 맞추기` + 남은 이동/점수/콤보 칩). "진행 방법"·"점수 안내" 섹션은 헤더의 `도움말` 버튼 → `.gk-modal`로 이동.
- 연출 추가: ① 매치 제거 시 해당 위치에 `+30` 등 점수 팝업(`.gk-float-num`) ② 콤보 ×2 이상일 때 콤보 칩 강조 펄스 ③ 셔플 시 보드 전체 짧은 흔들림+페이드 ④ 결과 모달 트랜지션(`.gk-modal`).
- 기존 tile-pop/drop/shake 키프레임은 유지.

### 4.2 방치형 `public/idle/` — 장면·이벤트 연출 보강

- `.gk-header`/`.gk-chip`/`.gk-button`/`.gk-modal` 적용 (기존 헤더 정보 구조는 유지: 직함·무대명 + 간식/초당 칩).
- 연출 추가: ① 무대 승급 시 장면 전환 연출(이전 장면 페이드아웃 → 새 장면 스케일 업, ~400ms) ② 배달 완료 시 수령 버튼 은은한 펄스 ③ 업적 달성 시 하단 토스트(차분한 한 줄, 2.5초 후 사라짐 — 기존 "조용히 반영" 원칙을 "낮은 톤 토스트"로 격상) ④ 시설 구매 시 장면에 추가되는 소품 팝인.
- 기존 클릭 바운스/+N 팝업/황금 간식 펄스는 유지하되 `.gk-float-num` 공용 키프레임으로 통합 가능하면 통합.

### 4.3 덱 `public/deck/` — 연출 최우선 보강 (현재 0개)

- `.gk-header`/`.gk-button`/`.gk-panel` 적용.
- 연출 추가 (모두 신규): ① 카드 사용 시 카드가 위로 떠오르며 사라짐(~200ms) ② 적 피격 시 `.gk-shake` + 피해 숫자 팝업(빨강 `.gk-float-num`, 다단 히트는 히트마다) ③ 플레이어 피격 시 화면 하단 붉은 플래시(짧게) + HP 칩 흔들림 ④ 방어도 획득 시 방어 배지 반짝 ⑤ 턴 전환 시 적 의도 배지 교체 트랜지션 ⑥ 드로우 시 손패 카드 슬라이드 인(카드당 30ms 스태거) ⑦ 승리/패배 → 결과 화면 페이드 전환.
- 피해 숫자 팝업은 `playCard`/`endTurn` 반환값(`results.hits`의 `amount`)을 이미 제공하므로 game.js 렌더링에서 그대로 사용 — 엔진 수정 불필요.

## 5. 기존 파일 수정 요약

| 파일 | 변경 |
| --- | --- |
| `public/shared/game-ui.css` | **신규** — 토큰+컴포넌트 공용 CSS |
| `src/adminServer.js` | `/game/shared` 정적 라우트 4곳 추가 (기존 게임 라우트 미러링) |
| `public/match3/index.html`, `styles.css`, `game.js` | 레이아웃 개편, 공용 CSS 로드, 중복 토큰/버튼 정의 제거, 연출 |
| `public/idle/index.html`, `styles.css`, `game.js` | 공용 CSS 로드, 중복 제거, 연출 |
| `public/deck/index.html`, `styles.css`, `game.js` | 공용 CSS 로드, 중복 제거, 연출 |
| `scripts/test-match3-static.js`, `test-idle-static.js`, `test-deck-static.js` | 공용 CSS 로드 순서 검증 추가 (아래 6절) |
| `scripts/check-release.js` | 신규 스모크 1건 등록 (아래 6절) |
| `docs/match3-web-game.md`, `idle-web-game.md`, `deck-web-game.md` | 공용 CSS 의존 한 줄 추가 |

**수정 금지**: `board.js`, `engine.js`, `content.js` 계열 전부(로직·데이터 무변경), 기존 로직 스모크 테스트(그대로 통과해야 함).

## 6. 테스트

- **신규 `scripts/test-shared-ui-static.js`**: `public/shared/game-ui.css` 존재, `gk-button`/`gk-modal`/`prefers-reduced-motion` 문자열 포함, 3종 `index.html`이 각각 `../shared/game-ui.css`를 자기 `styles.css`보다 먼저 로드, `src/adminServer.js`에 `/game/shared` 라우트와 경로 탈출 방지 존재. 순수 Node + `assert`, 성공 한 줄 출력.
- 기존 정적 테스트 3본에 공용 CSS 로드 검증 추가.
- `scripts/check-release.js`에 신규 스모크 1건 등록.
- **기존 로직 테스트 3본(match3/idle/deck logic)은 무수정 통과해야 함** — 이것이 "로직 무변경"의 증명.

### 수동 QA

- 3종 각각 데스크톱·모바일(375px)에서 화면별 확인: 레이아웃 통일감(헤더/버튼/모달), 연출 각 항목 동작.
- 매치3: 개편 후에도 스왑/매치/결과 흐름 정상, `?seed=42` 결정성 유지.
- 덱: 카드 사용~피해 숫자~턴 전환 연출이 실플레이 템포를 방해하지 않는지 (애니메이션 대기 때문에 입력이 막히면 안 됨 — 연출은 입력을 블로킹하지 않는다).
- OS 설정 또는 DevTools로 `prefers-reduced-motion: reduce` 에뮬레이션 시 애니메이션이 꺼지는지.
- 방치형 localStorage 기존 세이브가 그대로 이어지는지 (저장 스키마 무변경이므로 당연히 유지되어야 함).

## 7. 영향 범위 / 완료 조건 / 롤백

- **영향 범위**: 시각 전용. 게임 로직·저장 스키마·데이터 JSON·봇 코드 무변경. `adminServer.js`에 공개 정적 라우트 1개(`/game/shared`) 추가뿐.
- **완료 조건**: `npm run check:release` 전체 통과(기존 로직 테스트 무수정 통과 포함), 위 수동 QA 통과, PR 하나. 커밋/PR 본문 한국어.
- **권장 커밋 구성(5개)**: ① shared CSS + 라우트 + 신규 정적 테스트/게이트 ② 매치3 개편+연출 ③ 방치형 적용+연출 ④ 덱 적용+연출 ⑤ 정적 테스트 3본 갱신+문서.
- **롤백**: PR 머지 커밋 revert 한 번으로 완전 롤백.

## 8. v1 이후 후보 (이번 범위 아님)

- 미니게임 허브/랜딩(`/game/`)에서 4종 링크 노출 — 디자인 통일 완료 후 별도 계획
- 생존전 디자인 개선 — 기존 명세 문서 기반 별도 트랙
- 사운드 이펙트(Web Audio, 에셋 없이 합성음) — 검토 필요
