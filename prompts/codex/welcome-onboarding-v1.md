# Codex 작업 지시서

## 작업 이름

환영 자동화 v1 — 신규 입장자 환영 DM + 폴백 + 참여동의 리마인드 ("데려가는 다리")

## 목표

신규 서버 입장자에게 봇이 먼저 다가가는 흐름을 만든다: 입장 즉시 링크 버튼 3개가 담긴 환영 DM을 보내고, DM이 막힌 경우 환영 채널에 폴백 안내를 남기며, 24시간 뒤에도 참여동의 역할이 없으면 1회만 부드러운 리마인드 DM을 보낸다.

## 참고 문서

- 계획서: `docs/onboarding-welcome-plan.md` (확정 운영 값 포함 — 9절)
- 저장소 규약: `CLAUDE.md`, `AGENTS.md`, `src/AGENTS.md`, `scripts/AGENTS.md`
- 문구 톤 기준: `src/onboardingRoles.js`의 기존 안내문, `docs/onboarding-message-pack.md`

## 현재 전제

- 브랜치: `feat/welcome-onboarding-v1` (main에서 분기)
- 현재 `src/index.js`에는 `guildMemberAdd` 처리가 없고, 인텐트 목록(34~39행)에 `GuildMembers`가 없다.
- `src/index.js` 50행 `client.once('clientReady', ...)` 안에서 `startDailyMissionAnnouncementScheduler(client)` 등 스케줄러들을 시작하는 패턴이 있다.
- 슬래시 명령어 변경 없음 → `src/deploy-commands.js` 건드리지 않는다.

## 중요 구현 원칙 (재론 금지)

아래 값은 운영자 승인이 끝난 확정값이다. 재설계·재론 없이 이대로 구현한다.

1. 기능 게이트 `WELCOME_ONBOARDING_ENABLED` 기본 **false**. false면 이벤트 핸들러·스케줄러 모두 등록만 하고 즉시 return (또는 등록 자체를 생략).
2. 리마인드 대기 24시간(`WELCOME_REMINDER_HOURS` 기본 24, 0이면 리마인드 끔), **1인 1회**.
3. 리마인드 금지 시간대 KST **22시~익일 9시** (`WELCOME_REMINDER_QUIET` 기본 `22-9`). 환영 DM은 입장 직후 발송이므로 quiet 적용하지 않는다.
4. 폴백 채널 안내에서 **유저 멘션 금지** — 이름·멘션 없이 일반 안내문만.
5. 버튼은 전부 **링크 버튼**(ButtonStyle.Link). customId 버튼 신설 금지, `src/handlers.js` 수정 금지.
6. CommonJS, 외부 의존성 추가 금지.
7. 저장은 `saveJsonFileAtomic`(src/jsonStorage.js:4) 경유, 경로는 `src/operationDataPaths.js`의 `DEFINITIONS`(8행)에 `welcomeOnboarding: ['WELCOME_ONBOARDING_STATE_PATH', 'welcome-onboarding.local.json']` 항목을 추가해 `getOperationDataPaths()`로 얻는다 (기존 키들과 같은 방식).
8. KST 시각 계산은 `src/opsReminder.js`의 `getKstParts` 패턴(37행)을 미러링한다 (import하지 말고 동일 로직을 새 모듈에 작성 — opsReminder는 해당 함수를 export하지 않음).
9. 포인트·교환·미션 상태(`pointsRepository.js`) 접근 금지.

## 수정 가능 파일

이 목록 밖의 파일은 절대 수정하지 않는다.

- `src/welcomeOnboarding.js` (신규)
- `src/index.js`
- `src/operationDataPaths.js` (DEFINITIONS 1줄 추가만)
- `scripts/test-welcome-onboarding-flow.js` (신규)
- `scripts/check-release.js` (신규 테스트 등록)
- `.env.example`
- `docs/operation-guide.md`
- `docs/railway-env-guide.md`
- `docs/onboarding-welcome-plan.md` (문서 이력 1줄 추가만)

## 작업 1. `src/welcomeOnboarding.js` 신규 모듈

다음 함수를 구현하고 전부 `module.exports`로 내보낸다 (테스트에서 직접 호출).

```js
function createWelcomeOnboardingConfig(env = process.env)
// → { enabled, guildId, consentChannelId, nametagChannelId, fallbackChannelId,
//     reminderHours, quietStartHour, quietEndHour, guideUrl }
// - enabled: env.WELCOME_ONBOARDING_ENABLED === 'true'
// - reminderHours: 정수 파싱, 유효하지 않으면 24. 0이면 리마인드 비활성.
// - WELCOME_REMINDER_QUIET 형식 "22-9". 파싱 실패 시 22/9로 폴백하고 console.warn 1회.
// - guideUrl: env.PARTICIPANT_GUIDE_URL trim (src/participantInteractionUi.js:104와 동일 방식)

function createWelcomeDmPayload(config)
// → { content, components } — 링크 버튼 구성:
//   ① "🌱 참여동의 하러 가기" → https://discord.com/channels/<guildId>/<consentChannelId>
//   ② "🏷️ 이름표 고르기" → nametagChannelId 링크 (nametagChannelId 없으면 버튼 생략)
//   ③ "📖 참여자 가이드 열기" → guideUrl (guideUrl 없으면 버튼 생략)
//   한 ActionRow에 담는다 (최대 3개라 1행이면 충분).

function createFallbackMessagePayload(config)
// → 폴백 채널용 { content } — 멘션 없음.

function createReminderDmPayload(config)
// → 리마인드 DM { content, components } — 버튼은 ①만 재사용.

async function handleGuildMemberAdd(member, { config, store, log })
// - config.enabled false → 아무것도 안 함
// - member.user.bot === true → 무시
// - DM 발송 성공 → store에 { joinedAt, welcomeDmStatus: 'sent' } 기록
// - DM 발송 실패(에러 코드 50007 포함 모든 에러) → welcomeDmStatus: 'failed' 기록 후,
//   fallbackChannelId가 있으면 해당 채널에 createFallbackMessagePayload 발송,
//   성공 시 fallbackPostedAt 기록. 폴백 실패는 log로만 남기고 throw하지 않는다.

function isReminderDue(record, member, config, now)
// → boolean. 조건 전부 충족 시 true:
//   joinedAt + reminderHours*3600*1000 <= now
//   record.reminderSentAt 없음
//   member가 src/onboardingRoles.js의 ONBOARDING_ROLE_TYPES 역할명
//   ('온보딩-천천히','온보딩-기본','온보딩-활동','참여자') 중 어느 것도 갖고 있지 않음
//   현재 KST 시각이 quiet 구간(22시~익일 9시) 밖
//   reminderHours > 0

async function runWelcomeReminderTick(client, { config, store, now, log })
// - store의 미발송 대상 순회 → guild.members.fetch(userId)로 잔류·역할 확인
//   (fetch 실패 = 탈퇴로 보고 대상에서 제외, 레코드에 leftAt 기록)
// - isReminderDue true인 대상에게 createReminderDmPayload 발송, reminderSentAt 기록
// - DM 실패 시 reminderSentAt에 현재 시각 기록(재시도 안 함) + welcomeDmStatus 유지

function startWelcomeOnboardingScheduler(client, env = process.env)
// - setInterval 10분. src/opsReminder.js의 startOpsReminder(208행 export) 시작 패턴 참고.
// - 테스트를 위해 resetWelcomeOnboardingForTests() 도 export (기존 resetOpsReminderForTests 패턴)
```

저장 함수 `readWelcomeState(env)` / `saveWelcomeState(state, env)`도 같은 모듈에 둔다. 스키마는 계획서 2.2절의 version 1 그대로. 로드 실패(파일 없음·파싱 오류) 시 `{ version: 1, members: {} }`로 시작.

### 사용자 노출 문구 (이 문구를 그대로 사용 — 임의 수정 금지)

환영 DM `content`:

```
🌱 리디파인에 와 주셔서 고마워요.

처음이라 낯설 수 있는데, 아래 버튼을 순서대로 눌러 보면 금방 익숙해져요.
① 참여동의 확인 → ② 이름표 고르기 → ③ 참여자 가이드

서두르지 않아도 괜찮아요. 읽기만 해도, 이모지 반응만 눌러도 참여예요.
채팅창에 /안내 를 입력하면 언제든 시작 메뉴를 다시 볼 수 있어요.
```

폴백 채널 안내 `content` (멘션 없음):

```
🌱 새로 오신 분들께 — 처음이라면 참여동의 채널의 안내를 먼저 확인해 주세요.
채팅창에 /안내 를 입력하면 시작 메뉴가 열려요. 궁금한 점은 운영진에게 편하게 물어봐 주세요.
```

리마인드 DM `content`:

```
🌱 어제 리디파인에 와 주셨죠. 천천히 하셔도 괜찮아요.

준비가 되면 아래 버튼으로 참여동의 안내만 먼저 확인해 주세요.
확인이 끝나면 다른 채널들이 열려요. 어려운 점이 있으면 운영진에게 편하게 말씀해 주세요.
```

## 작업 2. `src/index.js` 연결

- 인텐트 목록(34~39행)에 `GatewayIntentBits.GuildMembers` 추가. 단, `WELCOME_ONBOARDING_ENABLED !== 'true'`면 추가하지 않는 조건 분기(계획서 7절 위험 대응 — 포털 미활성 상태에서 기동 실패 방지).
- `client.on('guildMemberAdd', ...)` 등록: `handleGuildMemberAdd(member, ...)` 호출, 에러는 try/catch로 잡아 `console.error`만 (봇 다운 금지). 기존 `messageReactionAdd`(77행) 핸들러의 에러 처리 방식을 미러링.
- `clientReady`(50행) 블록에 `startWelcomeOnboardingScheduler(client)` 추가 (기존 스케줄러 시작 줄들 뒤).

## 작업 3. `src/operationDataPaths.js`

`DEFINITIONS`(8행)에 한 줄 추가:

```js
welcomeOnboarding: ['WELCOME_ONBOARDING_STATE_PATH', 'welcome-onboarding.local.json'],
```

다른 코드는 수정하지 않는다.

## 작업 4. `.env.example` 과 문서

`.env.example`에 추가 (기존 주석 스타일 유지):

```
# 환영 자동화 (기본 꺼짐). 켜기 전에 Discord 개발자 포털에서 Server Members Intent를 활성화해야 합니다.
WELCOME_ONBOARDING_ENABLED=false
WELCOME_CONSENT_CHANNEL_ID=
WELCOME_NAMETAG_CHANNEL_ID=
WELCOME_FALLBACK_CHANNEL_ID=
# 참여동의 리마인드 대기 시간(시간 단위, 0이면 끔) / KST 발송 금지 시간대
WELCOME_REMINDER_HOURS=24
WELCOME_REMINDER_QUIET=22-9
```

- `docs/railway-env-guide.md`: 위 env 6종 표 추가 + "Server Members Intent 활성화 필수" 경고.
- `docs/operation-guide.md`: 운영 절차 절 추가 — 켜는 순서(포털 인텐트 → env → 재배포), 끄는 방법(env false), 데이터 파일 위치.
- `docs/onboarding-welcome-plan.md` 문서 이력에 "구현(welcome-onboarding-v1)" 1줄 추가.

## 깨질 기존 테스트

없음 — 신규 모듈이며 기존 export를 변경하지 않는다. 확인 차원에서 `npm run check:release` 전체를 돌려 회귀가 없음을 보인다. (`src/index.js`는 테스트에서 직접 require되지 않음 — `scripts/check-release.js`의 `node --check` 문법 검사만 통과하면 된다.)

## 신규 테스트 — `scripts/test-welcome-onboarding-flow.js`

`assert` 기반 플레인 Node 스크립트 (`scripts/AGENTS.md` 규칙). 가짜 member/user/channel/guild 객체를 만들어 다음 케이스를 전부 검증:

1. 게이트 off: `WELCOME_ONBOARDING_ENABLED` 미설정 config로 `handleGuildMemberAdd` 호출 → user.send 호출 0회, store 기록 없음. (S1)
2. 정상 발송: enabled config + 가짜 member → user.send 1회, payload.components의 링크 버튼 URL에 consentChannelId와 guideUrl 포함, store에 `welcomeDmStatus: 'sent'`. (S2)
3. 봇 계정 무시: `member.user.bot = true` → 발송 0회.
4. DM 차단 폴백: user.send가 code 50007 에러를 던지는 가짜 유저 → fallback 채널 send 1회, `welcomeDmStatus: 'failed'` + `fallbackPostedAt` 기록, 폴백 content에 멘션 문자열(`<@`) 미포함. (S3)
5. 리마인드 due: joinedAt 25시간 전 + 동의 역할 없음 + KST 12시 고정 now → `isReminderDue` true. 발송 후 `reminderSentAt` 기록 → 두 번째 tick에서 발송 0회. (S4)
6. quiet 보류: 같은 조건 + KST 23시 고정 now → false. KST 8시도 false. KST 9시는 true. (S5)
7. 동의 완료 제외: '참여자' 역할 보유 가짜 member → false.
8. reminderHours=0 → 항상 false.
9. 저장 파일 손상: 깨진 JSON 파일 경로로 `readWelcomeState` → `{ version: 1, members: {} }` 반환.

시각 고정은 `now` 파라미터 주입으로 한다 (실제 시계 사용 금지). KST 계산 검증: UTC로 `2026-07-28T03:00:00Z` = KST 12시.

`scripts/check-release.js`에 두 항목 등록 (기존 패턴 미러링, 예: 59행 `test-ops-reminder-flow.js` 항목):
- `node --check scripts/test-welcome-onboarding-flow.js` 문법 검사
- `node scripts/test-welcome-onboarding-flow.js` 실행

마지막 줄에 성공 한 줄 출력 (기존 테스트 스타일).

## 검증 명령

```bash
node --check src/welcomeOnboarding.js
node --check src/index.js
node scripts/test-welcome-onboarding-flow.js
npm run check:release
```

전부 통과해야 완료다.

## 완료 후 요약 (보고 체크리스트)

- [ ] 수정 파일 목록 (수정 가능 목록 밖 파일 0개 확인)
- [ ] 신규 테스트 케이스 9개 구현 여부와 실행 결과
- [ ] `npm run check:release` 통과 로그 마지막 줄
- [ ] 계획서 성공 기준 S1~S6 각각의 판정 근거 (S7은 운영자 수동 확인으로 남김)
- [ ] 커밋: 구현 브랜치에 지시서·계획서 포함 1~2개 커밋, 푸시까지. PR 생성은 리뷰 단계에서.
