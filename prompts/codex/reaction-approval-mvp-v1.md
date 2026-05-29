# Codex 작업 지시서

## 작업 이름

미션 인증 채널 반응 승인 MVP v1

## 목표

프로젝트 리디파인 디스코드 봇의 미션 인증 흐름을 더 자연스럽게 개선한다.

현재 `/인증` 명령어는 기능적으로 동작하지만, 참여자가 미션 코드, 내용, 첨부파일을 직접 입력해야 해서 실제 참여자 UX가 번거롭다.

이번 작업에서는 참여자가 지정된 미션 인증 채널에 글, 사진, 영상 등을 올리면 운영자가 해당 메시지에 이모지 반응을 눌러 승인/반려할 수 있는 흐름을 추가한다.

핵심 목표:

* 참여자는 미션 인증 채널에 자유롭게 인증 메시지를 올린다.
* 운영자는 해당 메시지에 ✅ 반응을 눌러 승인한다.
* 봇은 승인 반응을 감지해 작성자에게 여정 포인트를 지급한다.
* 운영자는 ❌ 반응으로 반려 처리할 수 있다.
* 같은 메시지에 대해 중복 지급되지 않게 한다.
* 운영자 권한이 있는 사람이 누른 반응만 처리한다.
* 포인트 지급/반려 기록은 저장소와 로그에 남긴다.
* 기존 `/인증` 명령어는 보조 기능으로 유지한다.
* Google Sheets, PostgreSQL, 웹 관리자 페이지는 구현하지 않는다.

## 현재 전제

현재 참여자 명령어:

* /포인트
* /상점
* /교환
* /체크인
* /미션
* /인증

현재 운영자 명령어:

* /포인트관리
* /교환관리
* /포인트로그
* /인증관리
* /운영현황
* /미션관리
* /상점관리
* /운영내보내기

현재 데이터 저장 구조:

* src/pointsStore.js
* src/pointsRepository.js
* data/*.example.json
* data/*.local.json

data/*.local.json은 커밋하지 않는다.

## 이번 작업의 기본 정책

### 참여자 기본 인증 방식

참여자는 `/인증`을 직접 입력하지 않아도 된다.

기본 흐름:

1. 참여자가 미션 인증 채널에 글/사진/영상 인증 메시지를 올린다.
2. 운영자가 메시지를 확인한다.
3. 운영자가 ✅ 반응을 누른다.
4. 봇이 작성자에게 기본 미션 인증 포인트를 지급한다.
5. 봇이 지급 로그를 남긴다.
6. 가능하면 해당 메시지에 확인 완료 답글을 남긴다.

### 반려 방식

운영자가 ❌ 반응을 누르면 반려 처리한다.

반려 시:

* 포인트는 지급하지 않는다.
* 해당 메시지를 반려 처리한 기록을 남긴다.
* 가능하면 해당 메시지에 “운영진이 확인했어요. 이번에는 포인트 지급 대상은 아니에요.” 정도의 부드러운 답글을 남긴다.

### 기본 지급 포인트

환경변수로 설정할 수 있게 한다.

* MISSION_REACTION_REWARD_POINTS

기본값은 20P로 둔다.

### 인증 채널

환경변수로 설정한다.

* MISSION_SUBMISSION_CHANNEL_ID

이 채널에서 발생한 반응만 처리한다.

채널 ID가 설정되어 있지 않으면 반응 승인 기능은 동작하지 않고, console.warn으로 안내한다.

### 승인/반려 이모지

환경변수로 설정 가능하게 하되 기본값을 둔다.

* MISSION_APPROVE_EMOJI=✅
* MISSION_REJECT_EMOJI=❌

기본값:

* 승인: ✅
* 반려: ❌

### 운영자 권한

운영자 권한이 있는 사용자의 반응만 처리한다.

기준:

* Administrator 권한
* ManageMessages 권한
* 또는 OPERATOR_ROLE_ID 환경변수에 해당하는 역할

OPERATOR_ROLE_ID는 선택 사항이다.

환경변수가 없으면 Administrator 또는 ManageMessages 권한 기준으로 판단한다.

### 중복 지급 방지

같은 메시지에 대해 포인트가 두 번 지급되면 안 된다.

기준:

* messageId 기준으로 처리 기록 저장
* 이미 approved 상태인 messageId는 다시 지급하지 않는다.
* 이미 rejected 상태인 messageId에 ✅가 눌렸을 때는 운영 정책상 재승인을 허용하지 않아도 된다.
* MVP에서는 이미 처리된 메시지는 다시 처리하지 않는 방향으로 한다.

## 중요 주의사항

* 기존 `/인증` 명령어는 삭제하지 않는다.
* 기존 `/미션`, `/체크인`, `/포인트`, `/상점`, `/교환` 동작을 깨지 않는다.
* 새 Slash Command는 추가하지 않는다.
* 단, Discord reaction event 처리를 위해 index/client 초기화와 handler 구조 수정은 가능하다.
* .env 파일은 수정하지 않는다.
* .env.example에는 placeholder만 추가한다.
* 실제 토큰, 실제 채널 ID, 실제 개인정보는 작성하지 않는다.
* data/*.local.json은 커밋하지 않는다.
* package.json, package-lock.json은 수정하지 않는다.
* Railway, GitHub 설정은 변경하지 않는다.
* Google Sheets 연동은 구현하지 않는다.
* PostgreSQL 연동은 구현하지 않는다.
* 웹 관리자 페이지는 구현하지 않는다.
* npm run deploy는 실행하지 않는다.
* git commit, git push는 하지 않는다.
* 새 Slash Command가 없으므로 보통 npm run deploy는 필요 없다.
* 단, Discord Developer Portal 또는 Railway 환경변수에서 인텐트/권한 설정은 사용자가 별도로 확인해야 할 수 있다.

## Discord 권한/인텐트 주의

reaction event를 받으려면 Discord client에 필요한 intents/partials가 있어야 한다.

필요 가능성이 높은 항목:

* GatewayIntentBits.Guilds
* GatewayIntentBits.GuildMessages
* GatewayIntentBits.GuildMessageReactions
* Partials.Message
* Partials.Channel
* Partials.Reaction
* Partials.User

현재 프로젝트 구조에 맞게 최소 범위로 추가한다.

주의:

* MessageContent intent는 가능하면 요구하지 않는다.
* 이번 기능은 메시지 본문을 읽지 않아도 지급 처리가 가능해야 한다.
* 메시지 작성자, messageId, channelId, message URL 정도만 사용한다.
* 첨부파일 상세 정보는 권한/intent에 따라 제한될 수 있으므로 필수로 만들지 않는다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

* src/index.js
* src/handlers.js
* src/embeds.js
* src/logging.js
* src/pointsRepository.js
* src/pointsStore.js
* src/reactionApproval.js
* scripts/test-reaction-approval-flow.js
* scripts/test-participant-ux-flow.js
* scripts/test-point-activity-flow.js
* scripts/check-release.js
* .env.example
* docs/participant-command-guide.md
* docs/operation-guide.md
* docs/prelaunch-qa-checklist.md
* docs/point-data-structure-plan.md
* README.md
* prompts/codex/reaction-approval-mvp-v1.md

src/reactionApproval.js가 없으면 새로 만든다.

## 작업 1. 환경변수 placeholder 추가

.env.example에 아래 placeholder를 추가한다.

* MISSION_SUBMISSION_CHANNEL_ID=
* MISSION_REACTION_REWARD_POINTS=20
* MISSION_APPROVE_EMOJI=✅
* MISSION_REJECT_EMOJI=❌
* OPERATOR_ROLE_ID=

주의:

* 실제 값은 넣지 않는다.
* .env 파일은 수정하지 않는다.

## 작업 2. reaction approval 저장 구조 추가

src/pointsRepository.js 또는 새 helper에 반응 승인 기록 저장 구조를 추가한다.

추천 저장 파일:

* data/reaction-approvals.local.json

example 파일을 새로 만들 필요가 있다면:

* data/reaction-approvals.example.json

다만 example 파일을 만들 경우 개인정보 없는 더미 데이터만 사용한다.

저장 구조 예시:

{
"version": 1,
"records": [
{
"messageId": "discord_message_id",
"channelId": "discord_channel_id",
"guildId": "discord_guild_id",
"authorId": "participant_user_id",
"authorDisplayName": "participant_display_name",
"status": "approved",
"rewardPoints": 20,
"transactionId": "tx_xxx",
"reviewedBy": "operator_user_id",
"reviewedByDisplayName": "operator_display_name",
"reviewEmoji": "✅",
"messageUrl": "https://discord.com/channels/...",
"createdAt": "ISO string",
"reviewedAt": "ISO string"
}
]
}

상태값:

* approved
* rejected

필요 함수 후보:

* getReactionApprovalData()
* saveReactionApprovalData(data)
* findReactionApprovalByMessageId(messageId)
* createReactionApprovalRecord(input)
* approveReactionMessage(input)
* rejectReactionMessage(input)
* hasReactionMessageBeenReviewed(messageId)
* listRecentReactionApprovals(limit)

주의:

* 같은 messageId는 중복 처리하지 않는다.
* approved 처리 시 pointTransactions에 earn 거래를 남긴다.
* rejected 처리 시 포인트 지급하지 않는다.
* 기존 포인트 repository 함수와 일관된 방식으로 구현한다.
* local JSON 저장소는 MVP용이라는 문서 주석을 남긴다.

## 작업 3. reactionApproval handler 추가

src/reactionApproval.js를 새로 만들거나 기존 handler 파일에 기능을 추가한다.

핵심 함수 후보:

* handleMissionReactionApproval(reaction, user, client)
* isApprovalEmoji(emoji)
* isRejectEmoji(emoji)
* isMissionSubmissionChannel(channelId)
* isOperatorMember(member)
* buildMessageUrl(guildId, channelId, messageId)
* getReactionRewardPoints()
* shouldIgnoreReaction(reaction, user)
* fetchReactionContext(reaction, user)

처리 흐름:

1. 봇 자신의 반응이면 무시한다.
2. MISSION_SUBMISSION_CHANNEL_ID가 없으면 무시하고 warn만 남긴다.
3. 반응이 발생한 채널이 MISSION_SUBMISSION_CHANNEL_ID와 다르면 무시한다.
4. 반응 이모지가 승인/반려 이모지가 아니면 무시한다.
5. reaction.message가 partial이면 fetch를 시도한다.
6. user가 bot이면 무시한다.
7. guild member를 fetch한다.
8. 운영자 권한을 확인한다.
9. 메시지 작성자가 bot이면 무시한다.
10. 메시지 작성자와 반응 작성자가 같으면 가능하면 무시한다.
11. messageId가 이미 처리됐는지 확인한다.
12. ✅이면 포인트 지급 및 approved 기록 저장
13. ❌이면 rejected 기록 저장
14. 운영자 로그 채널에 알림 전송
15. 가능하면 원본 메시지에 thread/reply 또는 reaction reply를 남긴다.

주의:

* 알림 실패가 포인트 지급 실패로 이어지지 않게 한다.
* 원본 메시지 답글 실패도 전체 처리 실패로 만들지 않는다.
* 포인트 지급과 승인 기록 저장은 가능한 한 함께 처리한다.
* 에러는 console.error로 남긴다.

## 작업 4. index/client에 reaction event 연결

src/index.js 또는 현재 Discord client 초기화 파일을 확인한다.

필요한 경우 intents/partials를 추가한다.

예시 방향:

* GatewayIntentBits.GuildMessageReactions
* GatewayIntentBits.GuildMessages
* Partials.Message
* Partials.Channel
* Partials.Reaction
* Partials.User

client.on('messageReactionAdd', async (reaction, user) => { ... })를 등록한다.

주의:

* 기존 interactionCreate handler를 깨지 않는다.
* reaction handler 에러가 프로세스를 죽이지 않도록 try/catch 처리한다.
* check-release에서 문법 오류가 나지 않게 한다.

## 작업 5. 포인트 지급 로직 연결

승인 시 기존 포인트 지급 함수를 재사용한다.

거래 기록 예시:

type: earn
source: mission_reaction_approval
amount: rewardPoints
reason: 미션 인증 채널 반응 승인
metadata:

* messageId
* channelId
* messageUrl
* reviewedBy
* reviewEmoji

주의:

* 같은 messageId는 중복 지급하지 않는다.
* 기존 /포인트로그에서 확인 가능해야 한다.
* 기존 /포인트에서 보유 포인트에 반영되어야 한다.

## 작업 6. 운영자 로그 알림

기존 logging.js 구조를 확인하고 가능한 범위에서 보강한다.

승인 알림 예시:

미션 인증 반응 승인

참여자: @user
지급 포인트: 20P
승인자: @operator
원본 메시지: 링크
처리 상태: 지급 완료

반려 알림 예시:

미션 인증 반응 반려

참여자: @user
승인자: @operator
원본 메시지: 링크
처리 상태: 포인트 미지급

채널 기준:

1. ACTIVITY_REVIEW_CHANNEL_ID
2. LOG_CHANNEL_ID
3. 없으면 console.warn

주의:

* 실제 채널 ID는 문서에만 placeholder로 안내한다.
* 알림 실패 시 console.warn을 남긴다.

## 작업 7. 참여자 답글

가능하다면 원본 인증 메시지에 짧게 답글을 남긴다.

승인 답글 예시:

확인했어요. 여정 포인트 20P가 지급됐습니다.

반려 답글 예시:

운영진이 확인했어요. 이번에는 포인트 지급 대상은 아니에요.

주의:

* 답글 실패가 전체 처리 실패로 이어지지 않게 한다.
* 공개 채널에 남는 문구이므로 부드럽고 짧게 쓴다.
* 민감한 개인정보나 내부 처리 ID를 남기지 않는다.

## 작업 8. /운영현황 또는 내보내기 반영

가능하면 /운영현황 요약 또는 /운영내보내기 전체 데이터에 reaction approval 기록 수를 포함한다.

MVP에서 어렵다면 문서에만 남겨도 된다.

우선순위:

1. 포인트 로그에 기록 남기기
2. reaction approval local JSON에 기록 남기기
3. 운영 로그 채널 알림
4. 운영현황 연동

운영현황 연동은 가능하면 진행하되 과도하면 생략 가능하다.

## 작업 9. 테스트 스크립트 추가

scripts/test-reaction-approval-flow.js를 새로 만든다.

역할:

* Discord 실제 API 없이 reaction approval repository/helper를 테스트한다.
* Node 기본 assert만 사용한다.
* os.tmpdir() 아래 테스트용 파일만 사용한다.
* 실제 data/*.local.json은 만들지 않는다.

테스트 항목:

* approve emoji 판별
* reject emoji 판별
* 미션 인증 채널 판별
* message URL 생성
* reward points 기본값 20 처리
* messageId 기준 중복 승인 방지
* 승인 시 포인트 지급 거래 생성
* 승인 기록 저장
* 중복 승인 시 추가 지급 방지
* 반려 기록 저장
* 반려 시 포인트 미지급
* 이미 반려된 메시지 재처리 방지
* 운영자 권한 helper 단위 테스트가 가능하면 포함

성공 시 출력:

reaction approval flow smoke test passed

## 작업 10. check-release 반영

scripts/check-release.js에 아래 파일 문법 검사 또는 smoke test를 반영한다.

* src/reactionApproval.js
* scripts/test-reaction-approval-flow.js

가능하다면 check-release에서 아래 테스트도 실행하도록 한다.

* node scripts/test-points-store.js
* node scripts/test-points-repository.js
* node scripts/test-point-activity-flow.js
* node scripts/test-admin-management-flow.js
* node scripts/test-operation-export-flow.js
* node scripts/test-participant-ux-flow.js
* node scripts/test-reaction-approval-flow.js

기존 validate:data, test:questions 흐름은 유지한다.

## 작업 11. 문서 보강

### README.md

보강 내용:

* 미션 인증 채널 반응 승인 기능 추가
* 참여자는 인증 채널에 글/사진/영상 업로드 가능
* 운영자가 ✅ 반응을 누르면 포인트 지급
* ❌ 반응은 반려 처리
* 기존 /인증 명령어는 보조 기능으로 유지

### docs/participant-command-guide.md

보강 내용:

* 기본 인증 방식은 미션 인증 채널에 올리는 방식
* 글/사진/영상 모두 채널에 올릴 수 있음
* 운영진 확인 후 포인트 지급
* /인증 명령어는 직접 제출이 필요한 경우 사용하는 보조 방식

### docs/operation-guide.md

보강 내용:

* 운영자는 미션 인증 채널을 확인한다.
* 지급 대상이면 ✅ 반응을 누른다.
* 지급 대상이 아니면 ❌ 반응을 누른다.
* 같은 메시지에 중복 지급되지 않는다.
* 운영자 권한이 없는 사용자의 반응은 무시된다.
* 인증 채널 ID와 로그 채널 ID 환경변수 설정 필요

### docs/prelaunch-qa-checklist.md

보강 내용:

* MISSION_SUBMISSION_CHANNEL_ID 설정 확인
* MISSION_REACTION_REWARD_POINTS 확인
* MISSION_APPROVE_EMOJI 확인
* MISSION_REJECT_EMOJI 확인
* OPERATOR_ROLE_ID 사용 여부 확인
* 봇 권한 확인

  * View Channel
  * Read Message History
  * Add Reactions
  * Send Messages
* reaction intent 동작 확인
* 참여자 메시지에 운영자가 ✅ 반응 시 포인트 지급 확인
* 중복 ✅ 반응 시 중복 지급 방지 확인
* ❌ 반응 시 반려 기록 확인
* /포인트로그에서 지급 기록 확인
* /포인트에서 참여자 포인트 반영 확인

### docs/point-data-structure-plan.md

보강 내용:

* reaction approval record 구조
* messageId 기준 중복 지급 방지
* local JSON 저장소는 MVP용
* 장기 운영 시 Google Sheets 또는 PostgreSQL 검토 필요

## 작업 12. .env.example 보강

아래 값을 추가한다.

MISSION_SUBMISSION_CHANNEL_ID=
MISSION_REACTION_REWARD_POINTS=20
MISSION_APPROVE_EMOJI=✅
MISSION_REJECT_EMOJI=❌
OPERATOR_ROLE_ID=

주의:

* 실제 값은 쓰지 않는다.
* .env 파일은 수정하지 않는다.

## 검증

작업 완료 후 아래 명령어를 실행한다.

* node scripts/test-points-store.js
* node scripts/test-points-repository.js
* node scripts/test-point-activity-flow.js
* node scripts/test-admin-management-flow.js
* node scripts/test-operation-export-flow.js
* node scripts/test-participant-ux-flow.js
* node scripts/test-reaction-approval-flow.js
* npm run validate:data
* npm run test:questions
* npm run check:release

주의:

* npm run deploy는 실행하지 않는다.
* 새 Slash Command는 추가하지 않았으므로 보통 npm run deploy는 필요 없다.
* 단, 실제 운영 전에는 Railway 환경변수와 Discord bot intents/권한을 확인해야 한다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

* 변경된 파일 목록
* reaction approval 기능 요약
* MISSION_SUBMISSION_CHANNEL_ID 사용 방식
* ✅ 승인 시 포인트 지급 방식
* ❌ 반려 시 처리 방식
* 운영자 권한 검사 방식
* messageId 중복 지급 방지 방식
* 포인트 로그 기록 방식
* 운영자 로그 알림 방식
* 원본 메시지 답글 여부
* 기존 /인증 명령어는 유지했다는 점
* 새 Slash Command는 추가하지 않았다는 점
* npm run deploy는 실행하지 않았다는 점
* Railway 환경변수 설정이 필요하다는 점
* Discord reaction intent/권한 확인이 필요하다는 점
* node scripts/test-points-store.js 결과
* node scripts/test-points-repository.js 결과
* node scripts/test-point-activity-flow.js 결과
* node scripts/test-admin-management-flow.js 결과
* node scripts/test-operation-export-flow.js 결과
* node scripts/test-participant-ux-flow.js 결과
* node scripts/test-reaction-approval-flow.js 결과
* npm run validate:data 결과
* npm run test:questions 결과
* npm run check:release 결과
