# Discord interaction handlers 모듈 분할 v1 계획서 — 기능 무변경 구조 정리

**상태: 구현 완료 — 공개 façade·router·참여자·운영자 도메인 factory와 구조 계약 검증을 완료했습니다.**

### 2026-07-11 구현 메모

- `src/handlers.js`는 기존 named export와 repository 조립 수명주기를 보존하는 68줄 공개 façade가 됐습니다.
- 최상위 select → button → modal → command 분기는 `src/interactionRouter.js`의 주입형 factory로 이동했습니다.
- 권한·표시명·환경값 helper는 `src/interactionContext.js`로 이동했습니다.
- 2차 안전 분할에서 repository 비의존 참여자 UI helper를 `src/participantInteractionUi.js`, 운영자 UI/payload helper를 `src/operatorInteractionUi.js`로 이동했습니다.
- 두 UI 모듈은 각각 customId·문구·payload 구조를 고정하는 집중 계약 테스트로 보호합니다.
- 3차 분할에서 포인트·상점·체크인·미션·교환·인증 참여자 흐름을 `createActivityParticipantHandlers(deps)` factory로 이동했습니다. `pointsRepository`는 composition runtime에서 한 번 생성해 주입합니다.
- Factory 계약 테스트가 주입 repository의 포인트·상점·미션 대표 호출과 공개 handler 구성을 검증합니다.
- 4차 분할에서 포인트 조정·교환 검토·인증 검토·포인트 로그 운영 흐름을 `createActivityOperatorHandlers(deps)` factory로 이동했습니다. 인증 상태 변경 뒤 interaction 갱신, DM, 운영 로그 순서를 유지합니다.
- 운영 factory 계약 테스트가 주입 repository의 포인트·교환·인증 대표 상태 변경과 운영자 식별정보 전달을 검증합니다.
- 5차 분할에서 미션·상점 목록/UI, 토큰·modal 검증, 오늘의 미션 공지, 허브 select/button/modal, 관리 명령을 `createMissionShopHubHandlers(deps)` factory로 이동했습니다.
- 최종 정리에서 미션·상점 허브의 repository 비의존 UI·format·token·modal builder를 `missionShopHubUi.js`로 분리해 상태 처리 factory 745줄과 순수 UI 513줄로 목표 범위에 맞췄습니다.
- 6차 분할에서 운영 현황·환경/사전 점검·DM 안전 큐·운영 내보내기를 `createOperatorHubHandlers(deps)` factory로 이동했습니다.
- 채널 cache/fetch와 권한 확인은 순환 없이 양 factory가 재사용할 수 있도록 `src/interactionEnvironment.js` leaf helper로 이동했습니다.
- 7차 분할에서 안내·질문·공지·채널안내·리디·웹게임 연결/랭킹·참여자 메뉴를 `createParticipantHandlers(deps)`, `/게임지급` 흐름을 `createWebgameOperatorHandlers(deps)`로 이동했습니다.
- 웹게임 repository는 기존처럼 미리보기와 승인 실행 시점마다 새로 생성하며, factory 계약 테스트가 실행당 생성 횟수를 고정합니다.
- 최종 정리에서 runtime의 unused import를 제거하고 `sendEphemeralAfterUpdate`를 `src/interactionResponse.js` leaf helper로 이동했습니다.
- `missionShopHubHandlers.js`의 repository 비의존 UI·format·token·modal builder를 `missionShopHubUi.js`로 이동해 각각 745줄, 513줄로 정리했습니다.
- 기존 테스트가 `handlers.js`만 require cache에서 제거해 repository를 재조립하는 계약도 보존했습니다.
- `src/handlerRuntime.js`는 258줄이며 함수 선언 없이 repository 생성, factory 조립, routing dependency와 공개 export 제공만 담당합니다.
- `src/interactionRouter.js`는 91줄, 공개 `src/handlers.js`는 68줄입니다.
- 구조 계약 테스트가 공개 export 56개, runtime/router 크기, domain repository creator 금지, domain 순환 require 부재, `deploy-commands.js` hash를 고정합니다.

## 1. 배경

`src/handlers.js`는 2026-07-11 PR #77 머지 후 `main` 기준 4,023줄입니다. 다음 책임이 한 파일에 함께 있습니다.

- 공통 권한·환경·채널 점검
- 참여자 안내·질문·공지·리디 명령
- 포인트·상점·체크인·미션·교환·인증
- 미션·상점 운영 허브와 modal
- 운영 현황·내보내기·DM 안전 확인 큐
- 웹게임 연결·랭킹·주간 지급, 미니게임 랭킹, 던전월드 라우팅
- select menu·button·modal·slash command 최상위 dispatch

기능 자체는 넓은 smoke test로 보호되고 있지만 작은 변경도 대형 파일 충돌과 광범위한 리뷰를 유발합니다. 운영 콘솔 쓰기 Phase 1처럼 기존 저장 로직 재사용이 필요한 작업을 시작하기 전에 도메인 경계를 분명히 합니다.

## 2. 목표와 비목표

### 목표

1. `src/handlers.js`를 repository·handler 조립과 하위 호환 export를 담당하는 얇은 진입점으로 축소합니다.
2. interaction 종류별 라우팅과 도메인 동작을 분리합니다.
3. 기존 command name, option, customId, modalId, 응답 문구, ephemeral 여부, 권한 검사를 그대로 유지합니다.
4. 현재 `require('../src/handlers')`를 사용하는 테스트와 런타임 import를 변경 없이 통과시킵니다.
5. 후속 기능이 필요한 도메인 모듈만 수정할 수 있는 구조를 만듭니다.

### 비목표

- 신규 기능, 문구 개선, UX 변경
- Slash Command 스키마 변경
- admin 쓰기 기능이나 운영 리마인더 구현
- repository·JSON 스키마·환경변수 변경
- customId 규칙 변경
- Discord 권한 정책 변경
- ESM·TypeScript·프레임워크·새 dependency 도입
- 테스트 assertion 약화 또는 대규모 snapshot 재생성

## 3. 절대 보존 계약

다음은 구현 편의를 이유로 바꾸지 않습니다.

### 3.1 런타임 계약

- `src/index.js`는 계속 `handleInteractionCreate`를 `src/handlers.js`에서 import합니다.
- `src/todayMissionAutoPublish.js` 등 기존 import 경로를 유지합니다.
- `pointsRepository`, dungeonworld repository/config, DM safety review repository는 프로세스당 기존과 같은 수로 생성합니다.
- `dotenv` 로딩 순서와 module-load env 해석을 바꾸지 않습니다.

### 3.2 Discord 계약

- select → button → modal → slash command의 기존 분기 순서
- DM 안전 확인 버튼을 다른 일반 버튼보다 먼저 판별하는 순서
- 운영자 권한 `ManageMessages || Administrator`
- 응답 방식(`reply`, `update`, modal, ephemeral)과 공개 범위
- 기존 command name·option name·customId·modalId
- 알 수 없는 interaction을 조용히 무시하는 동작

### 3.3 데이터·안전 계약

- 모든 포인트·교환·인증·미션·상점 상태 변경은 기존 `pointsRepository` 경유
- 안전 감지와 DM 안전 큐 우선순위 유지
- example 데이터 제외, strict preflight, 공통 운영 데이터 경로 유지
- 로그·알림 실패가 기존 상태 변경을 되돌리지 않는 경로 유지
- 실제 `.env`, `*.local.json`, 사용자 ID, 참여자 원문 커밋 금지

### 3.4 테스트·export 계약

현재 `handlers.js`가 export하는 이름을 v1 완료 시점까지 모두 유지합니다. 기존 테스트가 새 내부 모듈을 직접 import하도록 일괄 변경하지 않습니다. 새 모듈에는 집중 테스트를 추가할 수 있지만 기존 공개 진입점 테스트를 대체하지 않습니다.

## 4. 제안 구조

파일명은 구현 중 실제 결합도를 보고 미세 조정할 수 있지만 책임 경계는 유지합니다.

| 모듈 | 책임 |
| --- | --- |
| `src/interactionContext.js` | 표시명, 권한, env 읽기, 공통 채널 권한 등 순수·공통 helper |
| `src/participantHandlers.js` | 안내·질문·공지·채널안내·리디·온보딩 메뉴·웹게임 연결/랭킹 |
| `src/activityParticipantHandlers.js` | 포인트·상점·체크인·미션·교환·인증 참여자 흐름과 select/button/modal |
| `src/activityOperatorHandlers.js` | 포인트·교환·인증 관리, 포인트 로그, 인증 검토 버튼 |
| `src/webgameOperatorHandlers.js` | `/게임지급` 미리보기·확정과 웹게임 지급 repository 연결 |
| `src/missionShopHubHandlers.js` | 미션·템플릿·오늘의 미션·상점 운영 허브와 modal |
| `src/operatorHubHandlers.js` | 운영현황·환경 점검·첫날 점검·내보내기·DM 안전 큐 |
| `src/interactionRouter.js` | interaction 종류와 command/customId를 handler 함수에 매핑 |
| `src/handlers.js` | repository 생성, factory 조립, router 생성, 기존 export façade |

던전월드의 기존 `createDungeonworldHandlers`, 미니게임의 `createMinigameButtonHandler` 패턴을 참고합니다. 새 도메인 모듈은 module-level singleton을 각자 만들지 않고 필요한 repository와 helper를 factory 인자로 받습니다.

## 5. 구현 단계

### Phase 0 — 계약 고정

- 현재 `handlers.js` export 목록을 테스트로 고정합니다.
- command/select/button/modal 라우팅 표를 코드 또는 테스트 fixture로 명시합니다.
- 핵심 우선순위 회귀 테스트를 추가합니다.
  - DM 안전 버튼 우선
  - 인증 검토·교환·미니게임·던전월드 버튼 분기
  - participant/shop/mission select 분기
  - mission/shop/submission modal 분기
  - 알 수 없는 interaction 무응답

### Phase 1 — 공통 helper와 참여자 안내 분리

- 부작용이 적은 권한·표시명·env helper부터 이동합니다.
- 안내·질문·공지·리디·웹게임 연결/랭킹을 분리합니다.
- 기존 `handlers.js` export는 새 모듈 함수를 재노출합니다.

### Phase 2 — 참여 활동 분리

- 포인트·상점·체크인·미션·교환·인증 참여자 흐름을 이동합니다.
- select/button/modal helper와 처리 함수가 같은 도메인 모듈에 있도록 합니다.
- `pointsRepository`는 composition root에서 주입합니다.
- PR #76의 오늘·최근 7일·누적 랭킹 계약을 그대로 유지합니다.

### Phase 3 — 운영 처리와 미션·상점 허브 분리

- 포인트·교환·인증 관리와 검토 버튼을 이동합니다.
- PR #77의 `/게임지급` 미리보기·확정·중복 방지 경로를 별도 운영 모듈로 이동합니다.
- 미션·템플릿·오늘의 미션·상점 허브를 별도 모듈로 이동합니다.
- 대형 UI builder가 도메인 경계를 넘어 순환 참조하지 않게 합니다.

### Phase 4 — 운영 허브와 router 분리

- 운영 현황·환경 점검·내보내기·DM 안전 큐를 이동합니다.
- 최상위 `handleInteractionCreate`를 `interactionRouter.js`의 factory로 구성합니다.
- `handlers.js`는 의존성 조립과 호환 export만 남깁니다.

### Phase 5 — 정리와 문서화

- 사용하지 않는 import·dead helper 제거
- 신규 모듈별 책임 주석과 테스트 안내 추가
- 실제 코드 기준 파일 크기·export 계약·남은 결합 보고

## 6. 크기와 품질 목표

숫자를 맞추기 위한 인위적 분할은 금지하지만 다음을 목표로 합니다.

- `src/handlers.js`: 600줄 이하
- `src/interactionRouter.js`: 350줄 이하
- 신규 도메인 모듈: 가능하면 각 1,000줄 이하
- 순환 `require` 없음
- repository singleton 중복 생성 없음
- `handlers.js`의 기존 named export 전부 유지
- `src/deploy-commands.js` diff 없음

목표를 넘는 모듈이 있으면 억지로 helper 파일을 늘리지 말고 이유와 후속 분할 후보를 완료 보고에 남깁니다.

## 7. 커밋 전략

권장 커밋은 다음과 같습니다.

1. `test: interaction handler 공개 계약과 라우팅 우선순위 고정`
2. `refactor: 공통 context와 참여자 안내 handler 분리`
3. `refactor: 참여 활동 handler 분리`
4. `refactor: 운영 처리와 미션 상점 허브 분리`
5. `refactor: 운영 허브와 interaction router 분리`
6. `docs: handler 모듈 구조와 테스트 안내 갱신`

각 커밋은 최소 관련 표적 테스트를 통과해야 합니다. 마지막에 한꺼번에 고치는 방식으로 진행하지 않습니다.

## 8. 필수 검증

### 정적·구조 검사

```bash
node --check src/handlers.js
node --check src/interactionRouter.js
git diff --check
```

- `src/deploy-commands.js` 변경 없음
- 기존 `handlers.js` export 누락 없음
- 순환 require 없음
- `.env`, `*.local.json`, 실제 데이터 변경 없음

### 표적 회귀

```bash
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
```

### 전체 게이트

```bash
npm run validate:data
npm run test:questions
npm run check:release
```

실제 Discord 계정 QA는 command schema와 동작을 바꾸지 않는 리팩터링이므로 신규 필수 항목으로 만들지 않습니다. 자동 테스트로 증명할 수 없는 interaction 경로는 기존 prelaunch 체크리스트를 그대로 `운영자 확인 대기`로 둡니다.

## 9. 중단 조건

다음 상황에서는 범위를 넓혀 해결하지 말고 구현을 중단해 보고합니다.

- 기존 테스트를 통과시키기 위해 참여자/운영자 문구를 바꿔야 함
- command option 또는 customId 변경이 필요함
- repository API 변경이나 데이터 migration이 필요함
- 순환 참조를 피하려고 `handlers.js`와 신규 모듈이 서로 import해야 함
- admin 쓰기·리마인더 등 신규 기능을 함께 구현해야 함
- unrelated user change와 같은 파일에서 충돌함

## 10. 완료 보고

완료 보고에는 다음을 포함합니다.

1. 브랜치와 커밋 목록
2. 분할 전·후 파일별 줄 수
3. 최종 모듈 책임표
4. 유지한 `handlers.js` 공개 export 목록과 호환 근거
5. router 분기 우선순위 검증 결과
6. repository 생성·주입 구조
7. 기존 테스트 무수정 통과 여부와 불가피한 테스트 변경 이유
8. 표적·전체 테스트 결과
9. Slash Command 재등록 불필요 확인
10. 남은 결합과 후속 후보

## 11. 롤백

기능과 데이터 스키마를 바꾸지 않으므로 PR revert가 기본 롤백입니다. 분할 도중 특정 단계가 불안정하면 이후 커밋을 계속 쌓지 않고 마지막 통과 커밋으로 돌아가 원인을 보고합니다. 데이터 파일을 되돌리거나 수정하는 롤백은 수행하지 않습니다.
