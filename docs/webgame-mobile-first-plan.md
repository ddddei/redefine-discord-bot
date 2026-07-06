# 웹게임 3종 모바일 퍼스트 하드닝 계획서 (Codex 실행용)

매치3(`public/match3/`)·방치형(`public/idle/`)·덱(`public/deck/`)의 주 사용 기기가 **모바일**로 확정됨(2026-07-04 운영 결정)에 따른 하드닝 계획입니다. 구현 전 [AGENTS.md](../AGENTS.md), [src/AGENTS.md](../src/AGENTS.md), [scripts/AGENTS.md](../scripts/AGENTS.md), [webgame-design-guide.md](webgame-design-guide.md)를 먼저 읽어 주세요.

생존전(`public/dungeonworld-survivors/`)은 이 계획서 작성 시점(2026-07-04)에는 데스크톱 전용이었으나, 고도화 v1(2026-07-06 - [survivors-improvement-plan.md](survivors-improvement-plan.md) 2절)에서 가상 스틱·safe-area·viewport-fit 등 모바일 대응이 추가되어 별도 트랙으로 처리됐습니다. 이 문서의 범위(3종)는 그대로 유지합니다.

- 선행: PR #60(디자인 v3) 머지 후 `main`에서 브랜치 `feat/webgame-mobile-first-v1`
- 게임 로직 무변경 원칙 유지: `board.js`/`engine.js`/`content.js` 수정 금지, 로직 스모크 테스트 3본 무수정 통과. **단 하나의 예외 없음** — 스와이프 입력도 기존 로직 함수 호출로만 구현한다.

## 1. 설계 원칙 — 참여자 맥락을 모바일 결정에 반영

대상: 쉬었음·준비중·고립은둔·사회적 연결이 부족한 청년 약 60~100명. 이 맥락이 모바일 하드닝의 우선순위를 결정한다:

| 참여자 특성 | 모바일 설계 결정 |
| --- | --- |
| 기기·요금제 사정이 다양함 (저사양·데이터 절약 가능성) | 첫 화면 전송량 예산 설정(7절), 원화 지연 로드, 그레인·그림자 렌더 비용 점검. "최신 아이폰 기준"으로 판단하지 않는다 |
| 주 진입로가 Discord 앱 내 링크 | **Discord 인앱 브라우저(iOS/Android)를 1급 QA 대상**으로 격상. 인앱 특유의 뷰포트·하단 바 겹침을 기본 케이스로 취급 |
| 침대·이동 중 한 손 사용 가능성 | 핵심 조작(턴 종료·간식 만들기·스왑)을 엄지 존(화면 하단 2/3)에서 완결. 상단 도달이 필요한 필수 조작 금지 |
| 심리적 부담 최소화 (기존 카피 원칙의 연장) | 시스템 팝업·소리·진동·푸시 없음. 실패 화면 문구는 기존 차분한 톤 유지. 랭킹 화면이 첫 화면을 점유하지 않게 유지(현행 유지 확인만) |
| 야간 사용 비중이 높을 수 있음 | 이번 범위에서는 화이트 플래시 방지(로드 중 배경색을 `--paper`로 선지정)까지만. 다크 모드는 범위 밖(12절) |

## 2. 현재 상태 감사 결과 (2026-07-04 실측 — 이 항목들이 작업 대상)

| 항목 | 실측 | 문제 |
| --- | --- | --- |
| viewport meta | 3종 모두 `width=device-width, initial-scale=1` | `viewport-fit=cover` 없음 → 노치 기기에서 safe-area 미대응 |
| `100vh` | 3종 styles.css 각 2곳(body, `.gk-stage` 계열) 총 6곳 | 모바일 주소창 수축 시 하단 잘림/점프. 생존전만 `100dvh` 사용 중 |
| `background-attachment: fixed` | 3종 body 배경 원화(v3에서 도입) | **iOS Safari에서 비동작/재페인트 버벅임** — 크리티컬 |
| `touch-action` / `-webkit-tap-highlight-color` / `user-select` | 0건 | 더블탭 줌 오발동, 탭 시 회색 하이라이트, 연타 시 텍스트 선택 |
| safe-area(`env()`) | 0건 | 방치형 하단 탭 바가 홈 인디케이터와 겹침 |
| `theme-color` meta | 0건 | 브라우저 크롬이 흰색 — 종이 톤과 어긋남 |
| 매치3 입력 | click 전용(두 번 탭 스왑) | 모바일 표준 문법(스와이프) 부재 |
| 이미지 로딩 | `<img>` 즉시 로드, 원화 총 992KB | 첫 진입 시 불필요한 선로드 (예: 덱에서 만나지 않은 적 원화는 전투 진입 시에만 필요) |

## 3. 작업 A — iOS 배경 크리티컬 버그 (최우선)

3종 styles.css의 body `background: ... fixed`를 제거하고 고정 레이어 방식으로 교체:

```css
body { background: var(--paper); }
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  background: var(--paper) url('../shared/art/bg-<게임>.webp') center / cover no-repeat;
}
```

- `position: fixed` 요소 배경은 iOS에서도 안정적으로 동작한다. `z-index: -1`로 기존 레이어 순서 불변.
- 회귀 확인: 데스크톱에서 기존과 동일하게 보여야 함(스크린샷 비교), 스크롤 시 배경 고정 유지.

## 4. 작업 B — 뷰포트·safe-area

1. viewport meta 3종 교체: `width=device-width, initial-scale=1, viewport-fit=cover`
2. `100vh` 6곳 → `100dvh` + 폴백:
   ```css
   min-height: 100vh;   /* dvh 미지원 폴백 */
   min-height: 100dvh;
   ```
3. safe-area 패딩 (지원 브라우저에서만 적용되도록 `env()` 기본값 0):
   - 방치형 하단 탭 바(`.tab-bar` 계열): `padding-bottom: calc(기존값 + env(safe-area-inset-bottom, 0px))`
   - 3종 `gk-header`(sticky): `padding-top: calc(기존값 + env(safe-area-inset-top, 0px))` — 단, 인앱 브라우저에서 이중 여백이 되지 않는지 QA에서 확인 후 과하면 header 제외
   - 덱 하단 조작 영역(에너지·턴 종료 행): `padding-bottom`에 동일 적용
4. `theme-color` meta 3종 추가: `<meta name="theme-color" content="#efe3c8">` (`--paper`)

## 5. 작업 C — 터치 입력 하드닝 (game-ui.css 공통)

```css
button, .gk-button, .tile, .card, .tab-button {
  touch-action: manipulation;      /* 더블탭 줌·탭 지연 제거 */
  -webkit-tap-highlight-color: transparent;
}
.gk-stage {
  -webkit-user-select: none;
  user-select: none;               /* 연타 시 텍스트 선택 방지 — 게임 영역만, 도움말·모달 본문은 제외 */
}
```

- 모달 본문·운영 문구(`.gk-modal` 내부 텍스트)는 `user-select: text` 재지정 (참여자가 코드/안내를 복사할 수 있어야 함 — 특히 계정 연결 코드 입력 흐름).
- **44px 터치 타겟 감사** (WCAG 2.5.5 기준, 실측 후 하향 항목만 수정):
  - `gk-button` padding `10px 20px`(높이 약 38px) → `12px 20px` + `min-height: 44px`
  - 방치형 탭 버튼: `min-height: 48px`
  - 덱 `턴 종료`: `min-height: 48px` (전투 중 최다 사용 버튼)
  - 매치3 타일은 보드 크기상 이미 40px 이상(375px에서 실측 ~38px) — 보드 좌우 패딩을 줄여 타일 ≥ 42px 확보
  - 예외: 정보 표시용 칩(`gk-chip`)은 조작 대상이 아니므로 제외

## 6. 작업 D — 매치3 스와이프 스왑

- `public/match3/game.js`에 Pointer Events 기반 스와이프 추가 (**click 스왑도 유지** — 두 입력 공존):
  - `pointerdown`(타일 위) → 시작 좌표·타일 기록, `setPointerCapture`
  - `pointermove` → 누적 이동 ≥ 24px이면 주축 방향(상하좌우) 확정
  - `pointerup` → 방향 확정 상태면 해당 방향 인접 타일과 기존 스왑 함수 호출 (클릭 스왑과 동일한 코드 경로 — 로직 분기 신설 금지), 미확정이면 기존 click 선택 동작으로 폴백
  - 보드 컨테이너에 `touch-action: none` (스와이프 중 페이지 스크롤 방지 — 보드 영역만, 페이지 전체 금지)
- 시드 결정성·`board.js` 무변경. 스와이프는 입력 계층에서 "어느 두 타일을 스왑할지"만 결정한다.
- 회귀: 마우스 클릭 스왑(데스크톱), 유효하지 않은 스와이프의 되돌림 연출 기존과 동일.

## 7. 작업 E — 전송량·로딩 (데이터 요금 배려)

1. **지연 로드**: 즉시 보이지 않는 원화에 `loading="lazy"` — 덱 적 원화(전투 진입 시 교체되는 `img`)는 이미 필요 시점 로드이므로, 카드 아트 창 아이콘·결과 화면 이미지 위주 점검. 배경 원화는 CSS라 lazy 불가 — 대신 아래 2.
2. **첫 화면 전송량 예산: 게임당 ≤ 400KB** (HTML+CSS+JS+즉시 로드 이미지, 배경 원화 포함). 실측해서 표를 계획서 대비 결과로 보고할 것. 배경 원화(66~128KB)는 예산 내 유지 가능 전망 — 초과 시 배경만 640px 저해상 변형 추가(`bg-*-sm.webp`)하고 `image-set()`으로 분기.
3. **선로드 힌트**: 각 게임 첫 상호작용에 반드시 쓰이는 원화 1~2장만 `<link rel="preload" as="image">` (예: 덱 첫 적은 시드에 따라 다르므로 제외, 방치형 제빵사 초상은 포함).
4. 폰트·외부 요청 0 유지 (현행 시스템 폰트 정책 그대로 — 확인만).

## 8. 작업 F — 저사양·심리 배려 마감

1. **렌더 비용 점검**: 종이 그레인(feTurbulence data-URI)은 정적 배경이라 유지. 단 `gk-stage`와 겹치는 다층 그림자·비네트가 저사양에서 스크롤 버벅임을 만들면 `@media (prefers-reduced-motion: reduce)`가 아니라 별도 간소화가 필요한지 QA에서 판단 — 판단 기준: 구형 안드로이드 프로파일(크롬 DevTools CPU 4x 스로틀)에서 스크롤 60fps 근처 유지.
2. **소리·진동·네이티브 알림 금지 확인** (현재 0건 — 회귀 방지로 정적 테스트에 `navigator.vibrate|Notification|new Audio` 부재 검증 추가).
3. **화이트 플래시 방지**: 3종 `<html>`에 `background-color: var(--paper)` 인라인 지정 (CSS 로드 전 흰 화면 방지 — 야간 사용 배려).
4. 실패·종료 카피 점검만 (변경 없음 — "이번엔 여기까지예요" 톤 유지 확인).

## 9. 작업 G — 게임별 엄지 존 점검

- **덱**: `턴 종료` 버튼이 우하단(엄지 존)인지 확인 — 현행 유지로 예상, 손패 가로 스크롤이 화면 하단 1/3에 위치 확인. 결과 화면 `새로 시작` 버튼 하단 배치.
- **방치형**: `간식 만들기` 버튼이 좌상단 쪽이면 **화면 중하단으로 이동** (현재 공방 탭에서 장면 아래 좌측 — 중앙 하단 배치로 조정, 자동 저장·연출 로직 무변경). 탭 바는 하단 유지 ✓.
- **매치3**: 보드가 화면 상단에 몰리지 않게 헤더 축소(모바일에서 서브라인 숨김) + 보드 수직 중앙 배치. `다시 하기`·`도움말`은 보드 아래로.
- 공통: 어떤 필수 조작도 상단 1/3에 두지 않는다 (정보 표시만 허용).

## 10. 테스트

### 정적 테스트 (신규 `scripts/test-mobile-hardening-static.js` + `check-release.js` 등록)

- 3종 index.html: `viewport-fit=cover`, `theme-color`, `<html>` 배경색 인라인 존재
- 3종 styles.css: `100dvh` 존재·`background-attachment: fixed` 부재·`env(safe-area-inset-bottom` 존재
- `game-ui.css`: `touch-action: manipulation`, `-webkit-tap-highlight-color` 존재
- 3종 game.js/HTML: `navigator.vibrate`·`Notification(`·`new Audio` 부재
- match3 game.js: `pointerdown`·`setPointerCapture` 존재 (스와이프 구현 증거)
- 기존 로직 테스트 3본 무수정 통과

### 수동 QA 매트릭스 (adminServer 경유)

| 환경 | 확인 항목 |
| --- | --- |
| 데스크톱 Chrome | 회귀 없음 (배경 고정·클릭 스왑·레이아웃 스크린샷 비교) |
| 모바일 뷰포트 375×812 (DevTools) | 3종 전 화면, 44px 타겟, 엄지 존 배치, dvh 동작 |
| DevTools CPU 4x 스로틀 | 스크롤·연출 체감 (8절 1 판단) |
| **실기기 iOS Safari + Discord 인앱** | 배경 버벅임 해소, safe-area, 스와이프, 주소창 수축 — **운영자(사용자) 협조 필요, 체크리스트를 PR 본문에 첨부** |
| **실기기 Android Chrome + Discord 인앱** | 동일 체크리스트 |

에뮬레이터로 검증 불가능한 항목(인앱 브라우저 실동작)은 "구현 완료 후 실기기 확인 대기" 상태로 PR에 명시하고, 운영자 확인 후 머지한다.

## 11. 커밋/PR 구성·완료 조건·롤백

- 권장 커밋 6개: ① A(iOS 배경) ② B(뷰포트·safe-area·theme-color) ③ C(터치 하드닝+타겟 확대) ④ D(매치3 스와이프) ⑤ E+F(로딩·저사양·플래시) ⑥ G(엄지 존)+테스트+가이드·운영 문서 갱신
- 문서 갱신: [webgame-design-guide.md](webgame-design-guide.md)에 "타겟 플랫폼" 절(3종=모바일 퍼스트, 생존전=데스크톱 전용) 신설, 게임별 운영 문서에 권장 기기 한 줄
- 완료 조건: `check:release` 전체 통과(신규 정적 테스트 포함), 데스크톱 회귀 스크린샷 비교, 모바일 뷰포트 QA, 전송량 실측표 보고. PR 하나, 한국어
- 롤백: PR revert 한 번 (데이터·env·deploy 무관)

### 구현 완료 기록 (2026-07-04)

| 작업 | 상태 | 기록 |
| --- | --- | --- |
| A iOS 배경 | 완료 | 3종 `background-attachment: fixed` 제거, `body::before` 고정 레이어로 전환 |
| B 뷰포트·safe-area | 완료 | 3종 `viewport-fit=cover`, `theme-color`, `100dvh`와 safe-area 패딩 적용 |
| C 터치 입력 | 완료 | 공용 터치 하드닝, 모달 텍스트 선택 예외, 44px/48px 조작 타겟 적용 |
| D 매치3 스와이프 | 완료 | Pointer Events 기반 스와이프가 기존 `attemptSwap` 경로를 호출 |
| E+F 로딩·심리 배려 | 완료 | 첫 화면 종이색 인라인, 주요 초상 preload, 지연/비동기 이미지 로딩, 소리·진동·알림 부재 정적 검증 |
| G 엄지 존·문서·테스트 | 완료 | 매치3 보드 중심·하단 버튼, 방치형 간식 만들기 중하단 배치, 신규 정적 테스트와 문서 갱신 |

## 12. 범위 밖 (후속 후보)

- **다크 모드(야간 종이 톤)** — 참여자 야간 사용 배려의 완성형이지만 팔레트 전면 재설계라 별도 계획
- PWA 설치·오프라인 캐시, 홈 화면 아이콘
- 생존전 데스크톱 리디자인 (별도 트랙)
- 매치3 스와이프 연출 고도화 (드래그 중 타일 따라오기)
