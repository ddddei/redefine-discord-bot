# Codex 작업 지시서

## 작업 이름

웹게임 비동기 소셜 v1 (오늘의 도전 — 일일 시드 챌린지, 공동 목표 — 주간 생산량 합산, 기록 응원)

## 목표

매치3·덱에 일일 시드 챌린지("오늘의 도전"), 방치형에 주간 공동 목표 진행 표시, 랭킹 화면에 익명 응원 버튼을 추가한다. 참여자 목적 ①"함께 즐기기" — 특히 **경쟁이 부담스러운 참여자가 소외되지 않는 참여 형태**를 만드는 작업이다. 작업 범위·세부 스펙·집계 공식·QA 기준은 **`docs/webgame-async-social-plan.md`가 기준 문서**다 — 이 지시서보다 상세하므로 반드시 먼저 정독한다. 지시서와 계획서가 충돌하면 계획서를 따르고 보고서에 충돌 지점을 남긴다.

## 선행 조건 (작업 전 확인)

1. 연동 v1(PR #59)·모바일 하드닝(PR #61)이 `main`에 머지되어 있어야 한다. `src/webgameRepository.js`, `src/webgameApi.js`, `src/webgameLink.js`, `public/shared/link.js`의 존재를 확인하고, 없으면 **작업을 시작하지 말고 중단 사유를 보고**한다.
2. `main`에서 새 브랜치 `feat/webgame-async-social-v1`을 만든다.

## 참고 문서

- docs/webgame-async-social-plan.md (기준 문서 — 1절 배려 원칙, 2절 시간·시드 규칙, 4.5절 공동 목표 집계 공식, 5절 API 명세, 8절 테스트)
- docs/webgame-discord-link-plan.md (연동 v1 설계 — 이번 작업이 얹히는 기반)
- docs/webgame-rankings-ops.md (기존 운영 절차 — 이번에 절을 추가할 문서)
- docs/webgame-mobile-first-plan.md (모바일 규칙 — 44px 타겟·엄지 존·touch-action, 신규 UI도 준수)
- AGENTS.md, src/AGENTS.md, data/AGENTS.md, scripts/AGENTS.md (저장소 규칙)

## 현재 전제

- 연동 v1이 가동 중: `webgameRepository.js`(원자 저장, `weekKey` ISO 주 UTC), `webgameApi.js`(`/game/api/link·score·rankings·me`, 빈도 제한·플래그), `link.js`(`window.GameLink`, fire-and-forget), `/게임연결`·`/게임랭킹` 명령.
- 매치3·덱은 시드 주입 경로가 이미 있고(`getSeedFromUrl` → `Board.createRng`/`Engine.createNewRun`), 방치형의 `lifetimeProduced`는 환생에도 리셋되지 않는 단조 증가 값이다(공동 목표 집계의 전제).
- 게임 3종은 모바일 퍼스트 하드닝 완료 상태 — 정적 테스트(`test-mobile-hardening-static.js`)가 소리·진동·Notification 부재를 검증한다. 신규 UI가 이를 깨면 안 된다.
- 테스트는 plain Node + assert 스모크 스크립트, `npm run check:release`가 전체 게이트다.

## 중요 구현 원칙

1. **게임 로직 무변경.** `public/match3/board.js`, `public/{idle,deck}/engine.js`, `public/{idle,deck}/content.js`, 로직 테스트 3본은 한 줄도 수정하지 않는다. 오늘의 도전은 기존 시드 주입 경로 재사용만으로 구현한다.
2. **score API 하위 호환.** `challenge` 필드 없는 기존 제출은 바이트 단위로 기존과 동일하게 동작해야 한다. 증거: `scripts/test-webgame-link-flow.js`·`test-webgame-api.js` **무수정 통과**.
3. **배려 원칙(계획서 1절)은 스펙이다.** 참여 인원을 순위보다 먼저 노출, 개인 기여 순위 없음, 응원 익명·알림 없음, 독촉 카피 금지, 푸시·소리·진동 없음. 신규 카피 전체 목록을 보고서에 첨부한다(톤 리뷰 대상).
4. **discordId 비노출 유지.** 게임 API 응답에 discordId 원문을 절대 넣지 않는다. 응원 대상은 salt 해시 `targetId`(계획서 4.3)로만 지목한다. `webgame-social.local.json`은 예시 픽스처로 폴백하지 않는다(`webgameRepository.js`의 `loadOrCreate` 패턴 그대로).
5. **연결은 선택 사항 유지.** 미연결이어도 오늘의 도전 플레이·랭킹/응원 수/공동 목표 열람 전부 가능. 네트워크 실패가 게임 진행을 절대 막지 않는다(fire-and-forget + 차분한 한 줄).
6. `pointsRepository.js` 무접촉, 포인트 자동 지급 없음. CommonJS, 신규 npm 의존성 금지, 외부 요청 금지.
7. 시간 규칙: `dayKey`는 KST 고정 오프셋(계획서 2.1 코드 그대로), `weekKey`는 기존 함수 무변경. 일일 시드는 서버가 유일한 소스(클라이언트에서 날짜로 시드를 계산하지 않는다).
8. **git push, PR 생성, `npm run deploy`, `.env` 수정 금지.** 로컬 커밋까지만. (`.env.example`은 수정 대상이다 — 실`.env`와 혼동 금지)

## 수정 가능 파일

- src/webgameRepository.js, src/webgameApi.js, src/webgameLink.js
- src/adminServer.js (라우팅 추가만), src/deploy-commands.js (`/게임랭킹` 옵션만), src/handlers.js (위임 디스패치만)
- public/shared/link.js, public/shared/game-ui.css
- public/match3/{index.html, styles.css, game.js}
- public/deck/{index.html, styles.css, game.js}
- public/idle/{index.html, styles.css, game.js}
- data/webgame-scores.example.json, data/webgame-social.example.json (신규)
- scripts/validate-data.js (스키마 확장), scripts/check-release.js (신규 테스트 등록만)
- scripts/test-webgame-social-flow.js (신규), scripts/test-webgame-social-api.js (신규)
- .env.example (`WEBGAME_COMMUNAL_GOAL`)
- docs/webgame-rankings-ops.md, docs/railway-env-guide.md, docs/{match3,deck,idle}-web-game.md (한두 줄), docs/operator-command-guide.md·participant-command-guide.md (`/게임랭킹` 옵션 반영), docs/webgame-async-social-plan.md (완료 표기)

위 목록 밖 파일 수정이 필요하면 작업 전에 사유를 보고서에 요약한다.

## 작업 순서 (계획서 2~7절, 커밋 7개)

1. repository 확장 — `getDayKey`(KST)·`getDailySeed`·daily 조회 함수들·공동 목표 집계(**4.5절 공식 그대로**: 이전 주 기록 없으면 이번 주 첫 제출값이 baseline)·social 저장소(cheerSalt·응원 dedup)·scores 필드 확장(mode/dayKey, 기존 레코드 관용 해석)·예시 픽스처·validate-data 스키마
2. API 확장 — `GET /daily`(idle 400)·`GET /goal`·`POST /cheer`(검증 순서 5.1절 그대로: 토큰→게임→periodKey→target→self→한도→dedup은 200)·`POST /score`의 `challenge: 'daily'`(자정 유예: 오늘/어제 시드, 불일치는 free 다운그레이드)·rankings entry에 targetId/cheers/isMe·adminServer 라우팅
3. Discord `/게임랭킹` 확장 — `기간` 옵션(이번 주/오늘의 도전), idle 선택 시 공동 목표 embed(3절 형식), handlers 위임
4. 공용 클라이언트 — link.js에 fetchDaily/fetchGoal/sendCheer/submitScore 4번째 인자·renderRankingSection 응원 버튼(행 단위 갱신, 목록 재렌더 금지)·renderDailySection, game-ui.css 공용 클래스
5. 게임 3종 적용 — 매치3 "오늘의 도전" 버튼(엄지 존)+결과 화면 오늘 랭킹, 덱 "오늘의 도전으로 시작"+이어하기 공존, 방치형 기록 탭 공동 목표 패널(제출 promise 체이닝 후 조회)
6. 테스트 — `test-webgame-social-flow.js`(8.1절 케이스 전부)·`test-webgame-social-api.js`(8.2절 케이스 전부)·check-release 등록
7. 문서 — rankings-ops 절 추가(7절: 공동 목표 보상은 **결정 칸만**, 금액을 임의로 정하지 않는다)·env 가이드·명령 가이드·게임 문서·계획서 완료 표기

`WEBGAME_COMMUNAL_GOAL` 기본값은 content.js 밸런스로 실측 산정(계획서 4.6)하고 **산정 근거를 보고서에 수치로** 남긴다.

## 검증 (필수)

```bash
npm run check:release                          # 전체 게이트 (신규 2본 포함)
node scripts/test-webgame-social-flow.js       # 단독 실행 성공 한 줄
node scripts/test-webgame-social-api.js
node scripts/test-webgame-link-flow.js         # 무수정 통과 (하위 호환 증명)
node scripts/test-webgame-api.js
node scripts/test-match3-logic.js              # 무수정 통과 (로직 불변 증명)
node scripts/test-idle-logic.js
node scripts/test-deck-logic.js
```

브라우저 확인은 **반드시 adminServer 경유**로 한다 (임시 정적 서버 금지 — MIME·라우팅·API가 다르다). 모바일 뷰포트 375×812 기본:

```bash
ADMIN_DASHBOARD_ENABLED=true ADMIN_DASHBOARD_PASSWORD=x node -e "require('./src/adminServer').startAdminServer({ port: 3300 })"
```

- 계획서 8.4절 수동 QA 시나리오 1~9를 수행한다. Discord 실계정이 필요한 항목(코드 발급, `/게임랭킹` embed)은 수행 불가하므로 repository/API 레벨로 대체 검증하고 "Discord 실계정 확인 대기"로 보고서에 남긴다 — 통과한 척 보고하지 않는다.
- 두 사용자 시나리오(같은 시드 보드, 상호 응원)는 링크 코드를 repository 직접 호출로 2개 발급해 브라우저 프로필 2개(일반+시크릿)로 재현한다.
- 미연결(시크릿) 브라우저에서 3종 회귀 없음 + 오늘의 도전 플레이 가능(제출만 안 됨) 확인.
- 첫 화면 전송량이 게임당 400KB 예산 내인지 재실측(이번 추가는 수 KB 전망 — 수치만 기록).

## 보고 형식

1. 커밋 해시 7개와 각 내용
2. `check:release` 결과, 기존 웹게임 테스트 2본·로직 테스트 3본 무수정 통과 여부
3. 신규 참여자 카피 전체 목록 (화면·문구 — 톤 리뷰 대상)
4. `WEBGAME_COMMUNAL_GOAL` 기본값과 산정 근거 (1인 주간 예상 생산량 추정 과정 포함)
5. 첫 화면 전송량 재실측표 (400KB 예산 대비)
6. 계획서 대비 다르게 구현했거나 해석이 필요했던 지점
7. Discord 실계정 확인 대기 항목 (운영자/리뷰어용 체크리스트)
8. 수정 가능 파일 목록 밖을 건드렸다면 그 사유
