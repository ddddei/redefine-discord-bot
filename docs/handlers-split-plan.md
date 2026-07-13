# handlers.js 도메인 분할 계획 (D-2) — 동작 무변경 리팩터링

이 문서는 로드맵 D-2 "handlers.js 분할"의 구현 계획입니다. **이 문서만 보고 다른 컨텍스트 없이 구현을 시작할 수 있도록** 모듈 배정표, 불변 조건, 커밋 단위, 검증 명령까지 명시합니다. 구현 전 [AGENTS.md](../AGENTS.md), [src/AGENTS.md](../src/AGENTS.md), [scripts/AGENTS.md](../scripts/AGENTS.md)를 읽습니다.

> **구현 주체가 외부 AI(GPT/Codex)인 경우 8절 "작업 규율"이 계획 내용과 동급의 준수 사항입니다.** 위반 시 리뷰에서 반려됩니다.

## 0. 착수 게이트

- **PR #77(feat/webgame-weekly-payout)이 main에 머지된 후 착수합니다.** #77이 handlers.js에 웹게임 지급 핸들러 5개를 추가하므로, 그 전에 시작하면 분할 결과가 충돌합니다. (PR #76은 handlers.js를 건드리지 않아 무관.)
- 착수 시 3절 함수 배정표를 `grep -n "^async function \|^function " src/handlers.js` 결과와 대조해 누락·추가 함수를 확인하고, 차이가 있으면 같은 도메인 규칙으로 배정한 뒤 진행합니다. 배정표 기준 시점: 2026-07-11, 3,970줄, 최상위 함수 133개 + 모듈 상수 4개.

## 1. 배경과 목표

- `src/handlers.js`는 3,970줄로 모든 슬래시 명령·버튼·셀렉트·모달 처리가 한 파일에 있습니다. 기능 추가마다 이 파일을 수정하게 되어 병렬 작업 충돌 위험이 커지고 있습니다(웹게임 지급·미니게임·DM 트랙이 전부 이 파일을 지나감).
- 목표: **동작을 1비트도 바꾸지 않고** 도메인별 모듈로 함수를 이동해, handlers.js를 "조립 + 라우팅 + 재수출"만 하는 파일로 줄입니다(목표 900줄 이하).
- 이 작업은 기능 작업이 아닙니다. 버그를 발견해도 고치지 않고 보고만 합니다(7절).

## 2. 방식 결정 (대안 비교)

| 방식 | 판단 |
|---|---|
| **도메인별 팩토리 모듈 + handlers.js 재수출 (채택)** | 저장소에 이미 확립된 패턴 그대로: `createDungeonworldHandlers({ deps })`(src/dungeonworldHandlers.js), `createMinigameButtonHandler({ pointsRepository, getMemberDisplayName })`(src/minigameInteractions.js). 의존성을 명시적으로 주입해 모듈 로드 순서·env 파싱 타이밍이 바뀌지 않음 |
| `src/handlers/` 디렉터리 구조 | 저장소는 flat `src/*.js` 관례. 디렉터리 도입은 이 작업 범위 밖의 구조 결정 |
| 함수를 모듈에서 직접 `require`로 가져다 쓰기(팩토리 없이) | 각 모듈이 자체적으로 `createPointsRepository()`를 부르면 인스턴스가 늘고, env 주입 테스트(resetModule 패턴)와의 상호작용이 복잡해짐. 기각 |
| 한 번에 전부 이동 | 리뷰 불가능한 거대 diff. 단계별 커밋(5절) 채택 |

## 3. 목표 모듈 구성과 함수 배정표

### 3-1. 공통 구조

각 신규 모듈은 아래 형태를 따릅니다(= dungeonworldHandlers 관례):

```js
// src/<module>.js
function create<Domain>Handlers(deps) {
  const { pointsRepository, isOperator, getMemberDisplayName, recordParticipantCommandUse /* 필요한 것만 */ } = deps;

  // ... 이동해 온 함수들 (본문 무변경) ...

  return { handleXxxCommand, handleXxxButton, /* 이동한 핸들러 전부 */ };
}

module.exports = { create<Domain>Handlers };
```

- handlers.js는 상단에서 모든 팩토리를 호출해 구조 분해하고, `handleInteractionCreate`와 `module.exports`는 **그대로** 둡니다(함수 참조 이름이 동일하므로 분기 코드·수출 코드는 수정 불필요).
- 모듈 간 순환 참조 금지. 신규 모듈은 handlers.js를 require하지 않습니다.

### 3-2. 신규 모듈 배정표 (함수 이름이 키 — 줄 번호는 참고용, 착수 시 재확인)

**① `src/interactionShared.js` — 공용 컨텍스트/헬퍼 (팩토리 아님, 순수 함수라 직접 export)**

`getMemberDisplayName`, `memberHasPermission`, `isOperator`, `getConfiguredEnvValue`, `isGoogleSheetsLoggingEnabled`, `sendEphemeralAfterUpdate`, `createEmptyListEmbed`, `getOptionalStringOption`, `getEmbedJson`

- `isOperator`는 discord.js `PermissionFlagsBits`만 의존 — 순수하게 이동 가능.
- **주의**: handlers.js의 `isOperator`는 `createDungeonworldHandlers` 주입 인자로도 쓰인다(handlers.js 상단 조립부). 이동 후 handlers.js가 이 모듈에서 import해 그대로 주입.

**② `src/participantGuideHandlers.js` — 안내·공지·질문·레디·참여자 메뉴** (팩토리 deps: pointsRepository, recordParticipantCommandUse는 이 모듈로 이동)

`recordParticipantCommandUse`, `recordFaqFallbackQuestion`, `createNoticeEmbed`, `handleGuideCommand`, `handleGuideHubSelect`, `handleChannelGuideCommand`, `handleQuestionCommand`, `handleNoticeCommand`, `handleRediCommand`, `handleRediHelpCommand`, `handleRediScheduleCommand`, `handleRediRulesCommand`, `handleRediContactCommand`, `handleParticipantMenuButton`, `createParticipantMenuButtonRows`, `createParticipantOnboardingNextStepRow`, 상수 `PARTICIPANT_MENU_BUTTON_IDS`

- `handleParticipantMenuButton`이 포인트 임베드(`createPointBalanceEmbedForUser`)·미니게임 허브 payload를 참조하면 해당 함수를 deps로 주입(모듈 간 직접 require 대신). 착수 시 함수 본문의 참조 목록을 뽑아 deps를 확정.

**③ `src/pointsCheckinHandlers.js` — 포인트·체크인·포인트 로그** (deps: pointsRepository)

`handlePointCommand`, `handleCheckinCommand`, `handlePointManageCommand`, `handlePointLogCommand`, `createPointBalanceEmbedForUser`, `createPointTransactionLogEmbed`, `createInsufficientPointsDescription`

**④ `src/shopRedemptionHandlers.js` — 상점·교환 (참여자 + 운영자 처리 명령)** (deps: pointsRepository, getMemberDisplayName)

`handleShopCommand`, `replyWithShopSelection`, `createShopSelectRow`, `formatShopLimit`, `formatNullableCount`, `handleShopSelect`, `createRedemptionConfirmRow`, `createRedemptionCancelConfirmRow`, `handleRedemptionConfirmButton`, `handleRedemptionCommand`, `handleRedemptionManageCommand`, `getRedemptionFailureMessage`

**⑤ `src/missionSubmissionHandlers.js` — 미션·인증 (참여자 + 운영자 검토)** (deps: pointsRepository, getMemberDisplayName, isOperator)

`handleMissionCommand`, `replyWithMissionSelection`, `createMissionSelectRow`, `handleMissionSelect`, `createMissionSubmissionModal`, `handleMissionSubmissionModal`, `serializeAttachment`, `handleSubmissionCommand`, `getSubmissionFailureMessage`, `handleSubmissionManageCommand`, `handleSubmissionReviewButton`, `buildSubmissionReviewStatusEmbed`, `sendSubmissionReviewDm`, `getSubmissionReviewButtonAction`, `getSubmissionIdFromReviewButton`, `handleMissionManageCommand`, `getMissionUpdatesFromOptions`, `createMissionAdminResultEmbed`

**⑥ `src/missionHubHandlers.js` — 미션 관리 허브·템플릿·오늘의 미션 공지** (deps: pointsRepository, isOperator)

`formatAdminMissionLine`, `createAdminMissionListEmbed`, `getMissionHubSelection`, `formatMissionParticipantPreview`, `formatMissionTemplateLine`, `formatMissionTemplatePreview`, `formatWeekdayRecommendationLine`, `formatTodayMissionRecommendation`, `buildTodayMissionNoticeEmbed`, `buildTodayMissionNoticePayload`, `getTodayMissionNoticeMission`, `createAdminMissionHubEmbed`, `handleTodayMissionNoticePreview`, `handleTodayMissionNoticePublish`, `createMissionHubPayload`, `resolveMissionHubToken`, `getMissionHubTokenFromCustomId`, `getMissionTemplateIdFromCustomId`, `resolveMissionTemplateToken`, `getMissionHubStatusInput`, `createMissionHubModal`, `getMissionHubModalInput`, `handleMissionHubSelect`, `handleMissionTemplateSelect`, `handleMissionHubButton`, `handleMissionHubModal`

**⑦ `src/shopHubHandlers.js` — 상점 관리 허브** (deps: pointsRepository, isOperator)

`formatAdminShopItemLine`, `createAdminShopListEmbed`, `getShopHubSelection`, `createAdminShopHubEmbed`, `createShopHubPayload`, `resolveShopHubToken`, `getShopHubTokenFromCustomId`, `getShopHubTypeInput`, `getShopHubStatusInput`, `createShopHubModal`, `getShopHubModalInput`, `handleShopHubSelect`, `handleShopHubButton`, `handleShopHubModal`, `handleShopManageCommand`, `getShopUpdatesFromOptions`, `createShopAdminResultEmbed`

**⑧ `src/operatorOpsHandlers.js` — 운영 허브·환경 점검·운영현황·내보내기** (deps: pointsRepository, dungeonworldRepository, isOperator)

상수 `OPERATOR_ENV_CHANNEL_CHECKS`, `getChannelPermissions`, `channelPermissionHas`, `resolveConfiguredChannel`, `inspectChannelEnvironment`, `createOperatorEnvironmentCheck`, `createOperatorPrelaunchCheck`, `createOperatorPrelaunchCheckPayload`, `createOperatorFirstDayCheckPayload`, `getOperatorHubEmbed`, `handleOperatorHubSelect`, `handleOperatorInvitationNoticeButton`, `handleOperatorPrelaunchCheckButton`, `handleOperatorPrelaunchOpenEnvironmentCheckButton`, `handleOperatorPrelaunchOpenMissionHubButton`, `handleOperatorPrelaunchOpenShopHubButton`, `handleOperationStatusCommand`, `createOperationSummaryEmbed`, `createPendingRedemptionsEmbed`, `createPendingSubmissionsEmbed`, `handleOperationExportCommand`, `createOperationExportEmbed`

**⑨ `src/webgameHandlers.js` — 게임연결·게임랭킹·게임지급** (deps: pointsRepository, isOperator)

`handleWebgameLinkCommand`, `handleWebgameRankingCommand`, `createWebgamePayoutPreviewPayload`, `handleWebgamePayoutCommand`, `handleWebgamePayoutConfirmButton`, `handleWebgamePayoutCancelButton`, 상수 `WEBGAME_PAYOUT_CONFIRM_PREFIX`, `WEBGAME_PAYOUT_CANCEL_ID`

- 버튼 prefix 상수 2개는 handleInteractionCreate 분기에서도 쓰이므로 팩토리와 별도로 모듈에서 export하고 handlers.js가 import.

**handlers.js에 남기는 것**: 전체 require·팩토리 조립, `pointsRepository`/`dungeonworldRepository`/`dungeonworldConfigRepository` 인스턴스 생성(현재 위치·순서 그대로 — env 파싱 타이밍 보존), `handleInteractionCreate` 전체(분기 순서 무변경), `module.exports`(수출 표면 무변경), 기존 dungeonworld·minigame 팩토리 호출부.

### 3-3. 배정 원칙 (배정표에 없는 함수를 만났을 때)

1. 특정 명령/버튼 계열에서만 쓰이면 그 도메인 모듈로.
2. 두 도메인 이상에서 쓰이면 `interactionShared.js`로.
3. 판단이 안 서면 **이동하지 않고 handlers.js에 남긴 뒤 7절 보고에 기재** — 잘못 옮기는 것보다 남기는 것이 안전.

## 4. 불변 조건 (하나라도 어기면 실패)

1. **module.exports 표면 동일**: 분할 전 `node -e "console.log(Object.keys(require('./src/handlers')).sort().join('\n'))"` 출력을 저장하고, 분할 후 동일한지 diff. 스모크 테스트 10개(`grep -ln "require.*src/handlers" scripts/*.js`)가 이 표면에 의존.
2. **테스트 파일 수정 0**: `scripts/` 아래 어떤 파일도 수정 금지. 기존 테스트 전체 무수정 통과가 "동작 무변경"의 증명.
3. **문자열 무변경**: 참여자/운영자 문구, customId, embed 제목·footer, console.error 메시지까지 전부. `git diff`에 문자열 리터럴 변경이 보이면 실패.
4. **함수 본문 무변경 이동**: 허용되는 변경은 (a) 함수를 파일 간 이동, (b) 팩토리 클로저로 감싸며 들여쓰기 1단 증가, (c) 참조를 deps 주입으로 치환하는 선언부뿐. 로직·조건·순서 재작성 금지. 검증: `git diff --color-moved=dimmed-zebra`에서 본문이 이동(moved)으로 표시되는지 확인.
5. **분기 순서 무변경**: `handleInteractionCreate`의 if 분기 순서는 라우팅 의미(prefix 매칭 우선순위)를 가짐. 재정렬 금지.
6. **인스턴스 생성 타이밍 보존**: `createPointsRepository()` 등 모듈 로드 시 1회 생성 구조 유지. 신규 모듈이 자체 인스턴스를 만들지 않는다(전부 주입). 테스트의 `resetModule('../src/handlers')` + env 주입 패턴이 계속 동작해야 함 — 신규 모듈도 테스트에서 reset될 수 있도록 상태를 팩토리 밖에 두지 않는다.
7. **신규 의존성 0, 신규 env 0, deploy-commands.js 무변경**(`npm run deploy` 불필요), data/·docs/ 참여자 문서 무변경.

## 5. 커밋 단위 (각 커밋 후 `npm run check:release` 전체 통과 필수)

작은 도메인부터 옮겨 패턴을 확립하고, 큰 도메인을 나중에:

1. `refactor(handlers): 공용 헬퍼를 interactionShared로 분리` — ①
2. `refactor(handlers): 웹게임 명령을 webgameHandlers로 분리` — ⑨ (가장 최근 코드라 이동 검증이 쉬움)
3. `refactor(handlers): 포인트·체크인을 pointsCheckinHandlers로 분리` — ③
4. `refactor(handlers): 상점·교환을 shopRedemptionHandlers로 분리` — ④
5. `refactor(handlers): 미션·인증을 missionSubmissionHandlers로 분리` — ⑤
6. `refactor(handlers): 미션 관리 허브를 missionHubHandlers로 분리` — ⑥
7. `refactor(handlers): 상점 관리 허브를 shopHubHandlers로 분리` — ⑦
8. `refactor(handlers): 운영 허브·운영현황을 operatorOpsHandlers로 분리` — ⑧
9. `refactor(handlers): 참여자 안내·메뉴를 participantGuideHandlers로 분리` — ② (참조가 가장 얽혀 있어 마지막)
10. `chore(release): 분할된 모듈 문법 검사를 check:release에 등록` — 신규 모듈 9개의 `node --check` 항목 추가(스모크는 기존 것이 커버)

중간 커밋에서도 저장소는 항상 동작 상태여야 합니다(이동한 도메인 + 아직 남은 도메인 공존 가능 — 팩토리 조립이 이를 보장).

## 6. 검증 방법

- 각 커밋 후: `npm run check:release` 전체 통과 (테스트 무수정).
- 최종:
  - `node -e "..."` export 표면 diff == 0 (4절 1).
  - `git diff main --stat`으로 handlers.js 감소량 확인(목표: 900줄 이하), 신규 모듈 합계가 감소량과 근사(순수 이동 증명).
  - `node --check` 신규 모듈 전부.
  - 수동 확인 불필요(동작 무변경이므로 Discord 실계정 QA 없음 — 스모크가 증명).

## 7. 보고 형식 (구현 완료 시)

1. 브랜치명(`refactor/handlers-split`)과 커밋 목록(위 5절 순서와 대조).
2. `check:release` 최종 실행 결과 요약(통과 항목 수).
3. 모듈별 줄수 표: handlers.js before/after + 신규 모듈 9개.
4. **이동하지 않고 남긴 함수 목록과 사유** (3-3 규칙 3 적용 건).
5. 작업 중 발견한 버그·이상 징후 목록 — **고치지 말고 보고만** (동작 무변경 원칙).

## 8. 작업 규율 (구현 주체가 외부 AI인 경우 필수)

- **브랜치 필수**: `refactor/handlers-split`. **main 직접 커밋 절대 금지** (과거 위반 사례 있음 — 위반 시 전체 반려).
- **로컬 커밋까지만**: push, PR 생성, `npm run deploy` 실행 금지. PR은 리뷰 후 사람이 만든다.
- **재위임 금지**: 다른 에이전트/하위 작업으로 넘기지 않는다.
- 커밋 메시지는 한국어, 5절의 제목 사용. CommonJS·2-스페이스·세미콜론·작은따옴표.
- 이 계획서를 브랜치에 함께 커밋한다.
- 범위 추가 금지: "김에 정리" 금지. 죽은 코드 발견 시에도 삭제하지 말고 7절 5에 보고.
