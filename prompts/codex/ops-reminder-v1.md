# 작업 지시서 — 운영 콘솔 Phase 3: 지연 감지·운영 리마인더 v1

> **2026-07-11 현행화:** PR #79·#80으로 콘솔 Phase 1·2가 완료된 `main` 기준이다. 계획·지시서는 5.6 Sol, 구현은 서브 에이전트, 최종 검수는 다시 5.6 Sol이 담당한다.

> **구현 상태:** 코드와 자동 검증 완료. Railway 단일 인스턴스·Discord 운영 채널·375px 모바일 QA는 확인 대기.

## 목표

1. `/admin`에서 교환·인증·반응 후속 확인의 대기 시간과 지연 여부를 본다.
2. active 미션의 마감 임박·마감 경과를 운영자에게 표시한다.
3. 기본 비활성 스케줄러가 지정 KST 슬롯에 운영 전용 채널로 요약을 최대 1회 보낸다.
4. 재시작·중복 interval·발송 실패에도 같은 슬롯을 반복 전송하지 않는다.
5. 참여자 상태·포인트·DM을 바꾸지 않는다.

## 비목표

- 참여자 독려 DM·공개 채널 공지
- 미션 자동 종료, 인증 자동 승인, 포인트 지급
- 주간 운영 리포트
- 외부 cron 서비스·새 dependency
- 다중 Railway replica 지원
- Slash Command 변경

## 현재 구조

- 부팅: `src/index.js`; 기존 daily mission, backup, DM cleanup 스케줄러 패턴을 참고한다.
- 운영 데이터 경로: `src/operationDataPaths.js`; 원자 저장: `src/jsonStorage.js`.
- 대기 원천: `pointsRepository.listPendingRedemptions`, `listPendingSubmissions`, `listRecentReactionApprovals`, `listMissionsForAdmin`.
- 콘솔 큐: `src/adminApi.js`의 today queue·reaction follow-up·mission status 응답.
- admin Phase 1·2의 write token·감사 로그와 리마인더는 독립이다. 리마인더는 읽기 계산과 자체 발송 이력만 쓴다.

## env 계약

| 변수 | 기본값 | 의미 |
| --- | --- | --- |
| `OPS_REMINDER_ENABLED` | `false` | 전체 on/off |
| `OPS_REMINDER_CHANNEL_ID` | 빈 값 | 운영 전용 채널. 없으면 `ADMIN_CONSOLE_LOG_CHANNEL_ID`, 그다음 `LOG_CHANNEL_ID` |
| `OPS_REMINDER_SLOTS` | `10:00` | KST `HH:MM`, 쉼표 구분, 중복 제거, 최대 4개 |
| `OPS_REMINDER_SLOT_WINDOW_MINUTES` | `5` | 슬롯 뒤 실행 허용 창, 1~15분 |
| `OPS_REMINDER_REDEMPTION_HOURS` | `48` | 교환 지연 임계값, 1~720 |
| `OPS_REMINDER_SUBMISSION_HOURS` | `24` | 인증 지연 임계값, 1~720 |
| `OPS_REMINDER_FOLLOWUP_HOURS` | `24` | 알림 후속 지연 임계값, 1~720 |
| `OPS_REMINDER_MISSION_DEADLINE_HOURS` | `24` | active 미션 마감 임박 범위, 1~168 |
| `OPS_REMINDER_HISTORY_PATH` | 공통 데이터 경로 | 개별 override |
| `ADMIN_DASHBOARD_URL` | 빈 값 | 메시지의 선택적 HTTPS 콘솔 링크 |

잘못된 값은 안전한 기본값으로 정규화하고 시작 시 경고한다. 실제 `.env`는 수정하지 않는다.

## 시간·지연 계약

- 시간대는 KST다. 테스트 가능한 순수 helper에서 date/slot 계산을 수행한다.
- `waitingHours`는 `max(0, floor((now-createdAt)/1h))` 정수다. 미래·잘못된 시각은 0과 `invalidTimestamp:true`로 표시하고 지연 집계에서 제외한다.
- overdue는 `waitingHours >= threshold`다.
- 날짜만 있는 미션 `endDate`는 KST 해당 날짜 23:59:59로 해석한다. ISO timestamp가 있으면 해당 instant를 사용한다.
- active 미션만 집계하며 `deadlineStatus`는 `upcoming|dueSoon|overdue|none`이다.
- 지연 계산은 `src/opsDelayPolicy.js`의 순수 helper 한 곳에서 수행하고 admin API와 리마인더가 함께 사용한다. 프런트에서 임계값을 다시 계산하지 않는다.

## 중복·실패 계약

발송 이력은 `OPS_REMINDER_HISTORY_PATH` → `OPERATION_DATA_DIR/ops-reminders.local.json` → 저장소 기본 경로 순으로 해석하며 최근 120개 슬롯만 보관한다.

1. 슬롯 실행 전 `{ dateKst, slot, status:'reserved', reservedAt }`를 원자 저장한다.
2. 예약이 이미 있으면 상태와 무관하게 다시 시도하지 않는다.
3. 발송 성공 시 같은 레코드를 `sent`로, 채널 없음·조회/전송 실패 시 `skipped` 또는 `failed`로 원자 갱신한다.
4. 예약 후 프로세스가 죽으면 그 슬롯 알림을 잃을 수 있지만 중복 전송보다 안전한 at-most-once를 우선한다.
5. 같은 프로세스의 동시 tick은 in-memory lock으로 막는다.
6. 슬롯 전에는 보내지 않고, 슬롯 뒤 window 안에서만 예약한다. window가 지나면 소급 발송하지 않는다.
7. 대기·지연·마감 신호가 전부 0이면 `skipped-empty`로 기록하고 메시지를 보내지 않는다.
8. 채널 실패는 봇·admin을 종료시키지 않는다. 다음 슬롯은 정상 시도한다.

local JSON이므로 단일 bot instance만 지원한다. 다중 replica에서는 스케줄러를 활성화하지 않는다.

## 메시지 개인정보 최소화

- 운영 채널 한 곳에 총건수·지연건수·최장 대기·마감 임박 수만 보낸다.
- 참여자 ID·표시명, 인증 내용, DM 원문, 점수, 포인트 잔액을 포함하지 않는다.
- `ADMIN_DASHBOARD_URL`은 `https://` URL만 허용하며 아니면 생략한다.
- 예: `[운영 리마인더 07-11 10:00] 교환 3건(지연 1, 최장 52시간) · 인증 1건 · 후속 0건 · 마감 임박 미션 2건`

## 구현 작업

### 1. 공통 지연 정책

`src/opsDelayPolicy.js` 신규:

- env 임계값 정규화
- `getWaitingMetadata`, `getMissionDeadlineMetadata`
- repository 결과를 입력받는 `buildOpsDelaySummary`
- admin API가 항목별 metadata를 붙일 수 있는 helper
- example-like 레코드 제외

### 2. 스케줄러·이력

`src/opsReminder.js` 신규:

- env/slot 정규화
- `formatOpsReminderMessage`
- 이력 read/reserve/finish, 원자 저장, 120개 제한
- `runOpsReminderTick({ client, repository, env, now, historyPath })`
- `startOpsReminder`는 env off면 timer를 만들지 않고, on이면 즉시 안전 tick 후 30초 interval을 만들며 `{ started, stop, runNow }` 반환
- module-level 시작 중복 방지와 테스트 reset helper

`src/index.js`는 기존에 생성된 공유 `pointsRepository`가 있다면 주입한다. 새 repository를 불필요하게 중복 생성하지 않는다. 현재 composition 구조상 공유가 불가능하면 한 번 생성해 adminServer와 reminder에 함께 전달하도록 최소 변경한다.

### 3. 경로·백업

- `operationDataPaths`에 `opsReminders`와 `OPS_REMINDER_HISTORY_PATH` 추가
- operation backup snapshot/manifest에 비필수 항목으로 포함
- restore allowlist·백업 테스트·문서를 함께 갱신
- example fixture나 별도 schema migration은 만들지 않는다

### 4. admin UI

- today queue의 교환·인증 항목에 `waitingHours`, `overdue`, `invalidTimestamp`
- reaction follow-up 항목에 같은 metadata
- mission status 항목에 `deadlineStatus`, `hoursUntilDeadline`
- 지연·마감 배지는 서버 응답만 렌더링
- 기본 다크 톤과 375px 레이아웃 유지

### 5. 테스트

`scripts/test-ops-reminder-flow.js` 신규, release gate 등록. 최소 검증:

1. threshold 경계(`==` 포함), 미래·invalid timestamp
2. KST 자정·날짜형 endDate·ISO deadline
3. example 제외와 개인정보 없는 메시지
4. 슬롯 전/창 안/창 밖, 잘못된 슬롯 정규화
5. 예약 선기록, 같은 프로세스 동시 tick, 재시작 중복 차단
6. 성공·empty·채널 없음·fetch 실패·send 실패 이력 상태
7. env off timer 미생성, start 중복 방지, stop 정리
8. 120개 이력 제한과 원자 저장 실패 시 발송하지 않음
9. admin API metadata가 같은 공통 정책 결과와 일치
10. operation backup/restore manifest 포함
11. 기존 admin Phase 1·2와 dashboard·backup 테스트 회귀

## 수정 가능 파일

- `src/opsDelayPolicy.js`, `src/opsReminder.js` 신규
- `src/index.js`, `src/adminApi.js`, `src/adminServer.js`(repository 공유가 필요한 최소 변경만)
- `src/operationDataPaths.js`, `src/operationBackup.js`
- `scripts/restore-operation-backup.js`, `scripts/test-operation-backup-flow.js`
- `public/admin/admin.js`, `public/admin/admin.css`
- `scripts/test-ops-reminder-flow.js`, `scripts/test-admin-dashboard-flow.js`, `scripts/check-release.js`
- `.env.example`, `README.md`
- `docs/operation-guide.md`, `docs/operator-dashboard-guide.md`, `docs/prelaunch-qa-checklist.md`, `docs/railway-env-guide.md`, `docs/ops-console-master-plan.md`, `docs/next-work-roadmap-2026-07.md`
- 관련 `AGENTS.md`는 책임 설명이 바뀔 때만 수정

## 금지

- points·redemption·submission·mission 상태 변경
- 참여자 DM·공개 채널 발송
- admin write token을 reminder 인증으로 재사용
- 새 dependency, 실제 `.env`/local 데이터 수정
- 기존 assertion 약화, Slash Command 변경·deploy
- push·PR·merge·원격 브랜치 정리

## 검증

```bash
node --check src/opsDelayPolicy.js
node --check src/opsReminder.js
node --check src/index.js
node --check src/adminApi.js
node scripts/test-ops-reminder-flow.js
node scripts/test-admin-dashboard-flow.js
node scripts/test-admin-write-flow.js
node scripts/test-admin-webgame-ops-flow.js
node scripts/test-operation-backup-flow.js
npm run check:release
git diff --check
```

## 완료 보고

구현 요약 / at-most-once 근거 / 공통 지연 정책 / 수정 파일 / 표적·전체 테스트 / 수동 확인 대기(실채널·모바일·Railway) / 운영자가 설정할 env와 채널 ID / `npm run deploy` 불필요 확인.
