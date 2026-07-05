# Codex 작업 지시서

## 작업 이름

운영 관리 웹 콘솔 v1 — Phase 3: 지연 감지 배지 + 운영 채널 요약 알림 (리마인더 v1)

## 선행 조건

**Phase 1 완료**(`admin-console-write-v1.md` — 처리 큐 화면, 감사 로그)가 main에 머지되어 있어야 한다. Phase 2(웹게임 운영)와는 독립 — 병행 가능. 기준 문서는 `docs/ops-console-master-plan.md` 5.4절과 로드맵 D-1.

## 목표

운영자가 놓치기 쉬운 지연·마감 시점을 시스템이 먼저 알려준다.

완료 시 다음이 모두 참이어야 한다.

1. 콘솔 처리 큐의 각 대기 건에 **지연 배지**가 붙는다(경과 시간이 임계값 초과 시).
2. 하루 1~2회, Discord 운영 채널에 **지연·대기 요약 알림**이 자동 발송된다.
3. 같은 날 같은 슬롯의 알림은 중복 발송되지 않는다(재시작 포함).
4. 알림 기능 전체가 env로 꺼지며(기본 off), 꺼진 상태에서 봇·콘솔 동작에 어떤 변화도 없다.

## 현재 전제

- 봇과 adminServer는 같은 Node 프로세스(`src/index.js` 부팅). 스케줄러는 이 프로세스 안의 단순 `setInterval` 기반 체크 루프로 충분하다 — 새 dependency(cron 라이브러리) 금지.
- 대기·지연 데이터는 전부 `pointsRepository` 읽기 메서드로 계산 가능: `listPendingRedemptions`, `listPendingSubmissions`, `listRecentReactionApprovals`, `getOperatorSupportSummary` 등.
- 발송 이력은 신규 `data/ops-reminders.local.json`(원자 저장, `data/*.local.json` 커밋 금지).
- 시간대는 한국 시간 기준 — 기존 `getKoreanDateString` 패턴 재사용.

## env 설계 (전부 `.env.example`에 추가)

| 변수 | 기본 | 의미 |
| --- | --- | --- |
| `OPS_REMINDER_ENABLED` | `false` | 전체 on/off |
| `OPS_REMINDER_CHANNEL_ID` | — | 알림 채널 (미설정 시 `ADMIN_CONSOLE_LOG_CHANNEL_ID` 폴백, 둘 다 없으면 발송 생략+경고 로그 1회) |
| `OPS_REMINDER_SLOTS` | `10:00` | 발송 시각(HH:MM, 쉼표 구분, 최대 4개, KST) |
| `OPS_REMINDER_REDEMPTION_HOURS` | `48` | 교환 대기 지연 임계값 |
| `OPS_REMINDER_SUBMISSION_HOURS` | `24` | 인증 대기 지연 임계값 |
| `OPS_REMINDER_FOLLOWUP_HOURS` | `24` | 반응 후속 확인 지연 임계값 |

## 중요 구현 원칙

1. **읽기 전용 계산.** 리마인더는 상태를 바꾸지 않는다 — 유일한 쓰기는 발송 이력 파일.
2. **중복 방지.** 발송 전 `{ date, slot }` 키로 이력 확인, 발송 성공 후 기록. 프로세스 재시작·슬롯 시각을 지나 부팅된 경우에도 같은 날 같은 슬롯은 1회만. 지나간 슬롯의 소급 발송은 하지 않는다.
3. **조용한 실패.** 채널 조회·발송 실패는 콘솔 경고 로그만 남기고 봇 동작에 영향 없음. 재시도는 다음 슬롯에 맡긴다.
4. **알림 문구는 운영자 대상** — 차분하고 간결한 한국어. 형식 예: `[운영 리마인더 07-05 10:00] 교환 대기 3건(최장 52시간 경과) · 인증 대기 1건 · 후속 확인 0건 — 콘솔에서 처리: <URL>`. 콘솔 URL은 env(`ADMIN_DASHBOARD_URL`, 선택)로, 없으면 URL 생략. **대기 0건이면 발송 생략**(무소식 알림으로 채널을 채우지 않는다).
5. **참여자 알림 아님.** 참여자 개인 DM·공개 채널 발송 금지 — 운영 채널 한정. (체크인 독려 등 참여자 리마인더는 별도 결정 후 후속 지시서.)
6. 지연 배지는 콘솔 읽기 API 응답에 `waitingHours`·`overdue: true/false` 필드를 추가하는 방식 — 프런트는 이 값만 렌더링(임계값 계산을 프런트에 복제하지 않는다).
7. 새 dependency 금지, slash command 변경 없음(`npm run deploy` 불필요).
8. **git push, PR 생성, `npm run deploy`, `.env` 수정 금지. 로컬 커밋까지만** — 브랜치 `feat/ops-reminder-v1`.

## 수정 가능 파일

- `src/opsReminder.js` (신규 — 스케줄 루프·요약 계산·발송·이력)
- `src/index.js` (부팅 시 `startOpsReminder({ client, repository })` 연결 — env off면 no-op)
- `src/adminApi.js` (대기 건 응답에 `waitingHours`/`overdue` 추가)
- `public/admin/admin.js`, `public/admin/admin.css` (지연 배지)
- `scripts/test-ops-reminder-flow.js` (신규), `scripts/check-release.js`
- `.env.example`
- `docs/operator-dashboard-guide.md`, `docs/operation-guide.md`, `docs/prelaunch-qa-checklist.md`, `README.md`

## 작업 1. `src/opsReminder.js`

- `buildReminderSummary(repository, { now, thresholds })` — 대기 건수·최장 경과·지연 건수 계산. 순수 함수로 테스트 주입 가능하게.
- `formatReminderMessage(summary, { slot, dashboardUrl })` — 문구 생성(0건이면 null).
- `startOpsReminder({ client, repository, env, historyPath })` — 1분 간격 체크 루프, 슬롯 도달+미발송이면 발송. 반환값에 `stop()` 포함(테스트 정리용).

## 작업 2. 콘솔 지연 배지

- 대기 목록 API 항목에 `waitingHours`(정수, 올림)·`overdue` 추가.
- 프런트: `overdue` 항목에 배지(예: "52시간 경과") — 기존 다크 톤에서 눈에 띄되 요란하지 않게. 모바일 375px 확인.

## 작업 3. 테스트 — `scripts/test-ops-reminder-flow.js`

가짜 client(발송 기록 배열)와 임시 이력 파일로 격리. `now` 주입으로 시각 제어. 필수 검증:

1. 임계값 초과 건만 지연으로 집계, `waitingHours` 계산 정확.
2. 슬롯 시각 도달 시 1회 발송, 같은 날 같은 슬롯 재체크 시 미발송(이력 파일 기준 — 재시작 시뮬레이션 포함).
3. 대기 0건이면 발송 생략.
4. `OPS_REMINDER_ENABLED=false`면 루프가 시작되지 않는다.
5. 채널 미설정 시 발송 생략 + 크래시 없음.
6. 문구에 건수·최장 경과·슬롯이 포함된다.
7. adminApi 응답의 `overdue`가 임계값 env를 따른다.

## 작업 4. 문서 반영

- `operation-guide.md`: 리마인더 동작·임계값 조정법.
- `operator-dashboard-guide.md`: 지연 배지 의미.
- `prelaunch-qa-checklist.md`: env off 기본 확인 + on 시 발송 확인 항목.
- `README.md` 한 줄.

## 검증

```bash
node --check src/opsReminder.js && node --check src/index.js && node --check src/adminApi.js
node scripts/test-ops-reminder-flow.js
node scripts/test-admin-dashboard-flow.js
npm run check:release
```

Discord 실채널 발송은 로컬에서 확인 불가 — "확인 대기"로 보고(가짜 client 테스트로 대체 증명).

## 완료 보고 형식

구현 요약 / 수정 파일 목록 / 통과한 검증 명령 / 확인 대기 항목(실채널 발송) / 후속: Railway env 설정 목록, `npm run deploy` 불필요.
