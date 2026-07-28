# 환영 자동화 v1 개발 계획 문서 (데려가는 다리)

## 1. 배경 / 문제

참여자 온보딩이 ②(서버 진입 후 참여동의 인증 전 이탈)·③(인증 후 첫 행동을 시작하지 못함) 구간에서 막히고 있다. 현재 봇은 `guildMemberAdd`를 처리하지 않아 **신규 입장자에게 먼저 하는 행동이 없고**, 모든 흐름이 참여자가 스스로 `/안내`를 입력해야 시작된다. 슬래시 명령어가 낯선 참여자에게는 시작점이 없다.

- 착수 게이트: 없음 (참여자 입장이 이미 진행 중이므로 즉시 착수 가치 있음). 단, **기능 게이트 기본 off**로 구현하고 운영 확인 후 켠다.

## 2. 전체 구조

### 2.1 모듈 흐름

```
guildMemberAdd (index.js에 이벤트 연결, GuildMembers 인텐트 추가)
  └─ src/welcomeOnboarding.js (신규 모듈)
       ├─ 환영 DM 발송 (링크 버튼 3개)
       ├─ DM 실패(차단) 시 환영 채널 폴백 안내
       └─ data/welcome-onboarding.local.json 에 상태 기록

시간 스케줄러 (opsReminder.js 의 tick 패턴 재사용, setInterval)
  └─ 참여동의 리마인드: 입장 N시간 경과 + 동의 역할 없음 + 미발송 → 1회 DM
```

- 버튼은 전부 **링크 버튼**(URL)으로 구성해 새 interaction 핸들러를 만들지 않는다:
  1. "① 참여동의 하러 가기" → `https://discord.com/channels/<GUILD_ID>/<WELCOME_CONSENT_CHANNEL_ID>`
  2. "② 이름표 고르기" → 이름표 채널 링크
  3. "③ 참여자 가이드 열기" → `PARTICIPANT_GUIDE_URL` (기존 env 재사용)
- DM 본문에서 `/안내` 입력법도 한 줄 안내한다 (버튼이 안 보이는 환경 대비).

### 2.2 저장 스키마 — `data/welcome-onboarding.local.json` (version 1)

```json
{
  "version": 1,
  "members": {
    "<userId>": {
      "joinedAt": "ISO8601",
      "welcomeDmStatus": "sent | failed | disabled",
      "fallbackPostedAt": "ISO8601 | null",
      "reminderSentAt": "ISO8601 | null"
    }
  }
}
```

- 저장은 `saveJsonFileAtomic`(src/jsonStorage.js) + `getOperationDataPaths`(src/operationDataPaths.js) 경유. `*.local.json`이므로 커밋 금지 대상(기존 .gitignore 규칙에 부합).
- 개인정보 최소화: userId와 시각만 저장. 이름·메시지 내용 저장 안 함.

### 2.3 환경변수

| 변수 | 상태 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `WELCOME_ONBOARDING_ENABLED` | 추가 | `false` | 전체 기능 게이트 |
| `WELCOME_CONSENT_CHANNEL_ID` | 추가 | 없음(필수) | 참여동의 채널 (버튼 링크 대상) |
| `WELCOME_NAMETAG_CHANNEL_ID` | 추가 | 없음(선택) | 이름표 채널. 없으면 버튼 ② 생략 |
| `WELCOME_FALLBACK_CHANNEL_ID` | 추가 | 없음(선택) | DM 실패 시 안내할 환영 채널. 없으면 폴백 생략 |
| `WELCOME_REMINDER_HOURS` | 추가 | `24` | 리마인드 대기 시간. `0`이면 리마인드 끔 |
| `WELCOME_REMINDER_QUIET` | 추가 | `22-9` | KST 발송 금지 시간대 (밤 시간 DM 방지) |
| `PARTICIPANT_GUIDE_URL` | 기존 | — | 버튼 ③ 링크 (src/participantInteractionUi.js:104 와 동일 소스) |
| `GUILD_ID` | 기존 | — | 채널 링크 URL 구성에 사용 |

- 동의 완료 판정: `src/onboardingRoles.js`의 `ONBOARDING_ROLE_TYPES`(온보딩-천천히/기본/활동/참여자) 중 하나라도 보유하면 완료로 본다. 별도 env 불필요 — 기존 모듈 재사용.

## 3. 접근 방식 (원칙)

1. 안전 우선: 기본 off, 켜기 전까지 어떤 신규 입장자에게도 발송하지 않는다.
2. 리마인드는 **1인 1회**, 금지 시간대(기본 22시~익일 9시 KST) 회피. 반복 독촉 금지.
3. 새 interaction 핸들러 0개 — 링크 버튼만 사용해 dispatcher(src/handlers.js) 미수정.
4. 기존 구조 재사용: 스케줄러는 `opsReminder.js` tick 패턴, 저장은 `jsonStorage.js`, 문구 톤은 `onboardingRoles.js`의 기존 안내문과 통일.
5. 포인트·교환·미션 상태를 건드리지 않는다 (`pointsRepository.js` 무관 — 금기 위반 없음).
6. 문서·`.env.example`·스모크 테스트 동시 갱신.

## 4. 단계별 계획

### 4.1 1단계: 환영 DM + 폴백 (독립 배포 가능)

수정 파일:
- `src/welcomeOnboarding.js` (신규): 설정 파서, 환영 DM payload 빌더, `handleGuildMemberAdd`, 폴백 발송, 상태 저장
- `src/index.js`: `GatewayIntentBits.GuildMembers` 추가(34행 인텐트 목록), `client.on('guildMemberAdd', ...)` 연결
- `.env.example`: 신규 env 5종 + 주석
- `scripts/test-welcome-onboarding-flow.js` (신규): 가짜 member/channel 객체로 발송·폴백·비활성 게이트 검증
- `package.json`: `check:release`에 신규 테스트 포함 (기존 나열 방식 확인 후 동일하게)
- `docs/operation-guide.md`, `docs/railway-env-guide.md`: 운영 절차·env 안내 추가

### 4.2 2단계: 참여동의 리마인드 (1단계와 독립 롤백 가능)

수정 파일:
- `src/welcomeOnboarding.js`: `startWelcomeReminderScheduler` 추가 (setInterval 10분 tick, due 판정: joinedAt+N시간 경과·동의 역할 없음·reminderSentAt 없음·quiet 시간 아님·멤버 잔류 확인)
- `src/index.js`: `clientReady`(50행)에서 스케줄러 시작
- `scripts/test-welcome-onboarding-flow.js`: due 판정·1회 발송·quiet 회피 케이스 추가

### 4.3 운영 단계 (코드 외)

- **Discord Developer Portal에서 Server Members Intent(privileged) 활성화** — 이걸 켜지 않으면 `guildMemberAdd`가 오지 않는다. 배포 전 필수.
- Railway에 env 설정 후 `WELCOME_ONBOARDING_ENABLED=true`.
- 참여동의 채널 최상단 안내문 단순화(운영진 수기 작업, 이 계획 범위 밖 권고).

## 5. 성공 기준

- S1: `WELCOME_ONBOARDING_ENABLED` 미설정 상태에서 `node scripts/test-welcome-onboarding-flow.js` 실행 시 "발송 0건" 검증 통과.
- S2: 활성 상태 가짜 member 입장 시 DM payload에 링크 버튼(참여동의 채널 URL, 가이드 URL) 포함이 테스트로 확인된다.
- S3: DM send가 오류(코드 50007)를 던지는 가짜 유저에서 폴백 채널 send가 1회 호출되고 상태가 `failed`+`fallbackPostedAt` 기록됨을 테스트로 확인.
- S4: joinedAt 25시간 전 + 동의 역할 없음 가짜 멤버가 리마인드 due로 판정되고, 발송 후 두 번째 tick에서 재발송되지 않음을 테스트로 확인.
- S5: quiet 시간대(예: KST 23시)로 고정한 clock에서 due여도 발송이 보류됨을 테스트로 확인.
- S6: `npm run check:release` 전체 통과.
- S7: (수동) 스테이징 계정으로 실제 입장 → DM 수신 → 버튼 3개 링크 정상 이동 확인.

## 6. 제약 조건

- CommonJS, 외부 의존성 추가 없음.
- 포인트/교환/미션 상태 미접촉 (pointsRepository 경유 대상 아님 — 환영 상태는 신규 local.json).
- admin 대시보드 읽기 전용 유지 (이번 범위에서 admin 미수정).
- `deploy-commands.js` **변경 없음** → 머지 후 `npm run deploy` 불필요.
- 신규 인텐트(GuildMembers)는 privileged — 포털 활성화 없이는 봇 기동 시 로그인 오류가 날 수 있으므로, 코드에서 인텐트 추가와 포털 활성화를 같은 배포 타이밍에 맞춘다.

## 7. 위험 / 롤백

| 위험 | 대응 |
| --- | --- |
| DM 일괄 발송으로 스팸 인식 | 입장 이벤트당 1건 + 리마인드 1회 제한. 대량 재발송 로직 없음 |
| 밤 시간 DM으로 부담 | quiet 시간대 기본 22-9 적용 (환영 DM은 입장 직후라 예외, 리마인드만 적용) |
| GuildMembers 인텐트 미활성 상태 배포 | 기동 로그에 경고 출력 + 기능 게이트 off면 인텐트 요청 자체를 건너뛰는 분기 |
| 저장 파일 손상 | `saveJsonFileAtomic` 원자 저장 + 로드 실패 시 빈 상태로 시작(발송 이력만 잃음, 중복 DM 최대 1회 위험을 수용) |
| 롤백 | `WELCOME_ONBOARDING_ENABLED=false` 즉시 중지, 또는 단계별 단일 커밋 revert |

## 8. 범위 제외

- 환영 메시지의 공개 채널 자동 게시(전원 대상) — 공지는 운영진 수기 유지 (자동 공지는 톤 통제 어려움)
- 리마인드 2회차 이상, 단계별 드립 캠페인 — 부담 유발 위험, v1에서 하지 않음
- `/안내` 버튼형 개편(기존 customId 버튼 재설계) — 기존 UI 안정성 유지, 별도 트랙
- admin 대시보드에 환영 현황 표시 — 운영 콘솔 트랙에서 재론

## 9. 확정된 운영 값 (2026-07-28 승인)

| 항목 | 확정값 |
| --- | --- |
| 리마인드 대기 시간 | 24시간 |
| quiet 시간대 | 22시~익일 9시 KST |
| 폴백 채널에서 유저 멘션 여부 | 멘션 안 함 (이름 없이 일반 안내) |
| 환영 DM 문구 | 구현 시 초안 제출 → 운영자 승인 후 반영 |

## 10. 문서 이력

- 2026-07-28: v1 초안 작성
- 2026-07-28: 운영 값 확정(리마인드 24h, quiet 22-9, 멘션 없음), 계획 승인
- 2026-07-28: 구현(welcome-onboarding-v1)
