# Codex 작업 지시서

## 작업 이름

Discord interaction handlers 모듈 분할 v1 — 기능 무변경 라우터·도메인 분리

## 기준 문서

[handlers 모듈 분할 v1 계획서](../../docs/handlers-modularization-v1-plan.md)가 범위·완료 기준의 원본입니다. 이 지시서와 충돌하면 최신 `main`과 기준 문서를 우선하고, 임의로 범위를 넓히지 않습니다.

## 목표

현재 PR #77 머지 후 4,023줄인 `src/handlers.js`를 다음 구조로 분리합니다.

- 공통 interaction context/helper
- 참여자 안내·질문·리디·웹게임 handler
- 포인트·상점·체크인·미션·교환·인증 참여자 handler
- 포인트·교환·인증 운영 handler
- `/게임지급` 미리보기·확정 운영 handler
- 미션·상점 운영 허브 handler
- 운영 현황·내보내기·DM 안전 큐 handler
- 최상위 interaction router
- repository 조립과 기존 named export를 유지하는 `handlers.js` façade

사용자에게 보이는 동작과 저장 데이터는 바꾸지 않습니다.

## 선행조건과 브랜치

1. 최신 `main`에 PR #74 운영 데이터 안전화, PR #75 DM 실운영 준비, PR #76 미니게임 랭킹, PR #77 웹게임 반자동 지급이 포함돼 있어야 합니다.
2. `src/handlers.js`에 DM 안전 큐와 현재 운영 허브 흐름이 존재해야 합니다.
3. 선행조건이 없으면 수정하지 말고 `BLOCKED: latest handler baseline missing`으로 보고합니다.
4. clean `main`에서 `refactor/handlers-modularization-v1` 브랜치를 생성합니다.
5. `main` 직접 커밋, push, PR, merge, deploy 금지. 로컬 커밋까지만 수행합니다.
6. nested sub-agent를 만들지 않습니다.

작업 시작 보고에 다음 원문을 포함합니다.

```bash
git branch --show-current
git log --oneline -5
git status --short
wc -l src/handlers.js
```

## 필독

- `AGENTS.md`
- `src/AGENTS.md`
- `scripts/AGENTS.md`
- `docs/AGENTS.md`
- `docs/handlers-modularization-v1-plan.md`
- `docs/next-work-roadmap-2026-07.md`
- `src/handlers.js`
- `src/index.js`
- `src/components.js`
- `src/embeds.js`
- `src/adminApi.js`
- `src/dungeonworldHandlers.js`
- `src/minigameInteractions.js`
- `scripts/check-release.js`
- `scripts/test-participant-ux-flow.js`
- `scripts/test-admin-mission-hub-flow.js`
- `scripts/test-admin-shop-hub-flow.js`
- `scripts/test-operator-hub-flow.js`
- `scripts/test-submission-review-buttons-flow.js`
- `scripts/test-dm-live-readiness.js`
- `scripts/test-minigame-rankings.js`
- `scripts/test-webgame-payout-flow.js`
- `src/webgamePayout.js`

## 절대 금지

- 신규 기능·명령·버튼·modal 추가
- command name/option, customId/modalId 변경
- 참여자·운영자 문구, embed 내용, ephemeral 여부 변경
- 권한 정책 변경
- `src/deploy-commands.js` 변경
- repository API·JSON 스키마·env 변경
- admin 쓰기, 운영 리마인더, 자동 지급 구현
- 실제 `.env`, `*.local.json`, 사용자 ID, DM 원문 커밋
- 새 npm dependency, ESM, TypeScript 도입
- 기존 assertion 삭제·완화로 테스트 통과
- formatting-only 대량 rewrite와 도메인 이동을 한 커밋에 혼합

## 핵심 설계 원칙

### 1. composition root

`src/handlers.js`에서 기존 repository와 하위 handler factory를 조립합니다.

- `pointsRepository` 중복 생성 금지
- dungeonworld repository/config 중복 생성 금지
- DM safety review repository 중복 생성 금지
- 새 도메인 모듈이 자체 singleton을 만들지 않음
- 필요한 repository/helper/client 접근은 명시적 factory 인자로 전달

### 2. 호환 façade

현재 `src/handlers.js`의 named export를 먼저 목록화하고 테스트로 고정합니다. 분할 후에도 같은 이름을 `src/handlers.js`에서 export합니다.

기존 테스트를 새 내부 모듈 import로 일괄 변경하면 안 됩니다. 기존 public entry가 계속 동작하는지 증명해야 합니다.

### 3. 단방향 의존성

권장 방향:

```text
handlers.js
  -> domain handler factories
  -> interactionRouter.js

domain handlers
  -> components / embeds / repository APIs / focused helpers

interactionRouter.js
  -> injected handler function map
```

금지:

- domain handler가 `handlers.js`를 다시 require
- router가 repository를 직접 생성
- 두 신규 도메인 모듈이 서로 순환 require
- `global`에 handler나 repository 보관

### 4. 라우팅 우선순위

현재 순서를 문자 그대로 보존합니다.

1. StringSelectMenu
2. Button
3. ModalSubmit
4. ChatInputCommand

Button 안에서는 DM safety review 판별이 기존처럼 가장 먼저입니다. participant·operator·minigame·dungeonworld customId 충돌이 없도록 기존 순서를 유지합니다.

### 5. 이동 방식

함수를 복사한 뒤 원본을 나중에 지우는 중복 상태를 오래 유지하지 않습니다. 한 단계에서:

1. 새 모듈에 factory/helper 추가
2. `handlers.js`에서 새 모듈 연결
3. 기존 구현 제거
4. 해당 표적 테스트
5. clean commit

순서로 완료합니다.

## 권장 파일

신규 핵심:

- `src/interactionContext.js`
- `src/participantHandlers.js`
- `src/activityParticipantHandlers.js`
- `src/activityOperatorHandlers.js`
- `src/webgameOperatorHandlers.js`
- `src/missionShopHubHandlers.js`
- `src/operatorHubHandlers.js`
- `src/interactionRouter.js`
- `scripts/test-interaction-router.js`

필수 수정:

- `src/handlers.js`
- `scripts/check-release.js`
- `docs/handlers-modularization-v1-plan.md` 완료 상태
- `docs/testing-guide.md` 또는 개발 구조를 설명하는 기존 문서 중 필요한 최소 범위

필요 시 최소 수정:

- 기존 `scripts/test-*-flow.js`: 새 계약 assertion 추가만 허용
- `src/index.js`: import 경로는 유지하는 것이 원칙. 변경이 필요하면 사유 보고

수정 금지:

- `src/deploy-commands.js`
- `src/pointsRepository.js`, `src/pointsStore.js`
- `src/adminServer.js`, `public/admin/*`
- `data/*`
- `.env.example`, `package.json`, package lock
- 웹게임 지급·던전월드·DM 비즈니스 로직

파일명이 현재 결합도와 맞지 않으면 동일한 책임 경계를 유지하는 범위에서 조정할 수 있습니다. 완료 보고에 계획 대비 차이를 적습니다.

## 작업 단계와 커밋

### 커밋 1 — 계약 고정

`test: interaction handler 공개 계약과 라우팅 우선순위 고정`

- 기존 `handlers.js` export 목록 assertion
- select/button/modal/command 대표 분기
- unknown interaction 무응답
- DM 안전 버튼 우선순위

### 커밋 2 — 공통 context·참여자 안내

`refactor: 공통 context와 참여자 안내 handler 분리`

- 권한·표시명·env helper
- 안내·질문·공지·채널안내·리디
- 온보딩 메뉴·웹게임 연결/랭킹

### 커밋 3 — 참여 활동

`refactor: 참여 활동 handler 분리`

- 포인트·상점·체크인·미션·교환·인증
- participant select/button/modal

### 커밋 4 — 운영 처리·미션·상점 허브

`refactor: 운영 처리와 미션 상점 허브 분리`

- 포인트·교환·인증 관리
- `/게임지급` 미리보기·확정 라우팅
- 인증 검토 버튼·포인트 로그
- 미션·템플릿·오늘의 미션·상점 허브와 modal

### 커밋 5 — 운영 허브·router

`refactor: 운영 허브와 interaction router 분리`

- 운영 현황·환경/첫날 점검·내보내기·DM 안전 큐
- router factory
- `handlers.js` façade와 composition root 정리

### 커밋 6 — 문서

`docs: interaction handler 모듈 구조 갱신`

커밋 수가 달라지면 논리적 이유를 보고합니다. 각 커밋은 관련 테스트가 통과하는 상태여야 합니다.

## 테스트 요구사항

### 신규 router 계약 테스트

최소 다음을 fake interaction과 injected spy handler로 검증합니다.

1. guide/operator/mission/template/shop select
2. participant shop/mission select
3. DM safety review button 우선 처리
4. mission/shop/submission modal
5. participant redeem/minigame/menu button
6. dungeonworld manage/choice button
7. 주요 slash command와 handler 매핑
8. unknown component·command 무응답
9. 한 interaction이 둘 이상의 handler를 호출하지 않음

router 테스트는 Discord API, 실제 repository, 실제 데이터 파일을 사용하지 않습니다.

### 기존 회귀

기존 flow 테스트를 가능한 한 수정 없이 통과시킵니다. fixture import 경로를 새 내부 파일로 바꿔 통과시키지 않습니다.

### 구조 검사

- 기존 `handlers.js` export 목록 동일
- `src/deploy-commands.js` diff 없음
- repository 생성 횟수 증가 없음
- 신규 모듈 간 순환 require 없음
- unused import·dead duplicate handler 없음

## 필수 검증

```bash
node --check src/handlers.js
node --check src/interactionRouter.js
node scripts/test-interaction-router.js
node scripts/test-participant-ux-flow.js
node scripts/test-onboarding-role-personalization-flow.js
node scripts/test-admin-mission-hub-flow.js
node scripts/test-admin-shop-hub-flow.js
node scripts/test-submission-review-buttons-flow.js
node scripts/test-operator-hub-flow.js
node scripts/test-dm-live-readiness.js
node scripts/test-minigame-rankings.js
node scripts/test-webgame-payout-flow.js
node scripts/test-minigame-hub-flow.js
node scripts/test-dungeonworld-flow.js
npm run validate:data
npm run test:questions
npm run check:release
git diff --check
git status --short
```

## 중단·보고 조건

다음 중 하나라도 필요하면 임의 구현하지 말고 주 에이전트에게 보고합니다.

- 사용자 문구·customId·command schema 변경
- repository API 또는 데이터 migration
- 기존 테스트 의미 변경이나 assertion 완화
- 순환 require
- 허용 파일 밖 비즈니스 로직 수정
- unrelated working tree 변경과 충돌
- 특정 모듈을 1,500줄 이상으로 옮겨야만 하는 구조

## 완료 기준

- 기준 문서 Phase 0~5 완료
- `handlers.js` 목표 600줄 이하 또는 초과 이유 보고
- router 목표 350줄 이하 또는 초과 이유 보고
- 기존 named export 전부 유지
- 기존 flow 테스트 무수정 통과 우선
- 신규 router 계약 테스트 release gate 포함
- 전체 `check:release` 통과
- Slash Command 재등록 불필요
- worktree clean, 로컬 커밋 완료

## 완료 보고 형식

1. 브랜치·커밋 목록
2. 분할 전/후 파일별 줄 수
3. 모듈별 책임과 dependency injection 구조
4. 기존 export 유지 결과
5. 라우팅 우선순위·단일 dispatch 검증 결과
6. 기존 테스트 무수정/수정 구분과 이유
7. 표적·전체 테스트 결과
8. 수정하지 않은 command schema·데이터 구조 확인
9. 남은 큰 모듈과 후속 후보
10. 실제 Discord QA 대기 여부
