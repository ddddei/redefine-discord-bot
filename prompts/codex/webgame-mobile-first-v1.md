# Codex 작업 지시서

## 작업 이름

웹게임 3종 모바일 퍼스트 하드닝 v1 (iOS 배경 버그, 뷰포트·터치, 매치3 스와이프, 전송량·엄지 존)

## 목표

매치3(`public/match3/`)·방치형(`public/idle/`)·덱(`public/deck/`)의 주 사용 기기가 모바일(주 진입로: Discord 앱 내 브라우저)로 확정됨에 따라, 모바일 실사용 품질을 하드닝한다. 작업 범위·세부 스펙·QA 기준은 **`docs/webgame-mobile-first-plan.md`가 기준 문서**다 — 이 지시서보다 상세하므로 반드시 먼저 정독한다. 지시서와 계획서가 충돌하면 계획서를 따르고 보고서에 충돌 지점을 남긴다.

## 선행 조건 (작업 전 확인)

1. PR #60(디자인 v3)이 `main`에 머지되어 있어야 한다. `git log --oneline -5`에서 v3 머지 커밋을 확인하고, 없으면 **작업을 시작하지 말고 중단 사유를 보고**한다. (계획서의 감사 결과는 v3 머지 후 상태 기준이다 — 예: `background-attachment: fixed`는 v3에서 도입됨)
2. `main`에서 새 브랜치 `feat/webgame-mobile-first-v1`을 만든다.

## 참고 문서

- docs/webgame-mobile-first-plan.md (기준 문서 — 1절 참여자 맥락 원칙, 2절 감사 실측, 3~9절 작업 A~G 스펙, 10절 테스트)
- docs/webgame-design-guide.md (v3 스토리북 톤 — 하드닝이 시각 결과를 바꾸면 안 됨)
- AGENTS.md, src/AGENTS.md, scripts/AGENTS.md (저장소 규칙)
- docs/match3-web-game.md, idle-web-game.md, deck-web-game.md (게임별 동작 기준)

## 현재 전제

- 3종은 v3 스토리북 프레임(공용 `public/shared/game-ui.css` + 게임별 styles.css)과 원화(`public/shared/art/*.webp`)를 사용한다.
- 게임 로직은 `board.js`(매치3)·`engine.js`+`content.js`(방치형·덱)에 분리되어 있고, `game.js`는 표시·입력 계층이다. 매치3 스왑은 `game.js`의 기존 클릭 스왑 경로가 `board.js`의 스왑 검증을 호출한다.
- 테스트는 plain Node + assert 스모크 스크립트, `npm run check:release`가 전체 게이트다.
- Discord 연동(`public/shared/link.js`)이 3종에 붙어 있다 — 계정 연결 코드 입력 폼이 모달/섹션에 있으므로 `user-select: none`을 전역에 걸면 안 된다(계획서 5절 예외 참고).

## 중요 구현 원칙

1. **게임 로직 무변경.** `public/match3/board.js`, `public/{idle,deck}/engine.js`, `public/{idle,deck}/content.js`, 로직 스모크 테스트 3본(`scripts/test-{match3,idle,deck}-logic.js`)은 한 줄도 수정하지 않는다. 매치3 스와이프는 입력 계층에서 "어느 두 타일을 스왑할지"만 결정하고 **기존 클릭 스왑과 동일한 함수 경로**를 호출한다 (새 로직 분기 금지, 시드 결정성 유지).
2. **시각 결과 불변.** 이 작업은 하드닝이지 리디자인이 아니다. 데스크톱 스크린샷이 작업 전후 동일해야 한다 (44px 타겟 확대·엄지 존 이동 등 계획서가 명시한 항목 제외).
3. **저장 스키마·서버 무변경.** localStorage 키, `src/` 하위, `data/` 하위를 수정하지 않는다.
4. CommonJS·순수 정적 파일, 새 npm 의존성 금지, 외부 요청(폰트·CDN) 추가 금지.
5. 카피 무변경 (참여자 문구는 계획서가 명시한 것 외 추가·수정 금지).
6. **git push, PR 생성, `npm run deploy`, `.env` 수정 금지.** 로컬 커밋까지만.

## 수정 가능 파일

- public/shared/game-ui.css
- public/match3/{index.html, styles.css, game.js}
- public/idle/{index.html, styles.css, game.js}
- public/deck/{index.html, styles.css, game.js}
- scripts/test-mobile-hardening-static.js (신규)
- scripts/check-release.js (신규 테스트 등록만)
- scripts/test-{match3,idle,deck}-static.js (필요한 경우만 — 모바일 항목 검증 추가)
- docs/webgame-design-guide.md ("타겟 플랫폼" 절 신설), docs/{match3,idle,deck}-web-game.md (권장 기기 한 줄), docs/webgame-mobile-first-plan.md (완료 표기)

위 목록 밖 파일 수정이 필요하면 작업 전에 사유를 보고서에 요약한다.

## 작업 순서 (계획서 3~9절 = 작업 A~G)

계획서의 A~G를 그대로 구현하되, 커밋은 계획서 11절의 6개 구성을 따른다:

1. A — iOS 배경 크리티컬 버그 (`background-attachment: fixed` → `body::before` 고정 레이어, 계획서 3절 코드 스펙 그대로)
2. B — viewport-fit·100dvh(+100vh 폴백 순서 주의)·safe-area(`env()` 기본값 0)·theme-color
3. C — touch-action·tap-highlight·user-select(모달 본문 예외)·44px 타겟 확대 (계획서 5절 목록)
4. D — 매치3 스와이프 (Pointer Events, 클릭 공존, 보드 컨테이너만 `touch-action: none`, 계획서 6절)
5. E+F — 지연 로드·preload 힌트·첫 화면 전송량 실측(게임당 ≤ 400KB, 실측표 필수)·html 배경 인라인·소리/진동 부재 검증
6. G — 엄지 존 (방치형 클릭 버튼 중하단 이동, 매치3 모바일 헤더 축소·보드 중앙, 덱 확인) + 신규 정적 테스트 + 문서 갱신

## 검증 (필수)

```bash
npm run check:release                          # 전체 게이트 (신규 테스트 포함)
node scripts/test-mobile-hardening-static.js   # 단독 실행 성공 한 줄
node scripts/test-match3-logic.js              # 무수정 통과 (로직 불변 증명)
node scripts/test-idle-logic.js
node scripts/test-deck-logic.js
```

브라우저 확인은 **반드시 adminServer 경유**로 한다 (임시 정적 서버 금지 — MIME·라우팅이 다르다):

```bash
ADMIN_DASHBOARD_ENABLED=true ADMIN_DASHBOARD_PASSWORD=x node -e "require('./src/adminServer').startAdminServer({ port: 3300 })"
```

- 데스크톱 뷰포트: 3종 회귀 없음 (배경 고정 렌더, 클릭 스왑, 레이아웃)
- 375×812 모바일 뷰포트: 3종 전 화면 조작 가능, 스와이프 스왑 동작, 콘솔 에러 0
- 첫 화면 전송량 실측 (DevTools Network, 캐시 비활성): 게임당 합계와 예산(400KB) 대비를 표로 기록

**실기기(iOS/Android Discord 인앱 브라우저) 확인은 이 작업 범위에서 불가능하다** — 계획서 10절의 실기기 체크리스트를 보고서에 그대로 옮겨 적고 "운영자 확인 대기" 항목으로 남긴다. 통과한 척 보고하지 않는다.

## 보고 형식

1. 커밋 해시 6개와 각 내용
2. `check:release` 결과, 로직 테스트 3본 무수정 통과 여부
3. 첫 화면 전송량 실측표 (게임 × 리소스 합계, 400KB 예산 대비)
4. 계획서 대비 다르게 구현했거나 해석이 필요했던 지점
5. 실기기 확인 대기 체크리스트 (운영자용)
6. 수정 가능 파일 목록 밖을 건드렸다면 그 사유
