# Codex 작업 지시서

## 작업 이름

DM 대화 연습 운영 안정화 v1 (백업 포함, 일일 사용량 제한, 응답 출력 안전 검사)

## 목표

프로젝트 리디파인 디스코드 봇의 DM 대화 연습 기능(v1 구현 완료)에 운영 안정 장치 3가지를 추가한다.

1. 운영 백업 스냅샷에 DM 대화 로그를 포함한다. (현재 `src/operationBackup.js` 대상에 빠져 있어 재배포 시 유실 위험)
2. 사용자별 일일 사용량 제한을 추가해 비용 폭주와 남용을 막는다.
3. AI가 생성한 응답에도 민감 키워드 검사를 적용해 부적절 응답 전송을 막는다.

이 작업은 `docs/dm-chat-mvp-plan.md`의 "5.1 1단계: 운영 안정"을 구현하는 것이다. 범위·성공 기준·제약이 해당 문서에 정의되어 있으므로 먼저 읽는다.

## 참고 문서

- docs/dm-chat-mvp-plan.md (기준 문서, 특히 4장 접근 방식, 5.1, 7장 성공 기준 S1~S3, 8장 제약 조건)
- docs/export-and-backup-guide.md
- docs/railway-env-guide.md
- README.md의 DM 대화 섹션

## 현재 전제

- `src/dmChat.js`의 `handleDmChatMessage`가 DM 흐름을 처리한다: env 게이트 → 첫 안내 → 사용자 메시지 저장/로그 → 민감 감지 시 안전 흐름 → 일반 메시지는 `getDmChatReply`(src/ai.js)로 응답 생성.
- `src/dmChatRepository.js`가 `DM_CHAT_LOG_PATH` 또는 기본 `data/dm-chat-logs.local.json`에 원자 저장(`pointsStore.saveJsonFile`)한다.
- `src/operationBackup.js`가 여러 `data/*.local.json`을 스냅샷으로 만들고 `scripts/restore-operation-backup.js`가 복원한다. 현재 대상 목록에 `dm-chat-logs.local.json`이 없다.
- `src/safety.js`의 `detectSensitiveQuestion(text)`가 민감 감지를 담당한다.
- 테스트는 plain Node + assert 스모크 스크립트다: `scripts/test-dm-chat-flow.js`, `scripts/test-operation-backup-flow.js`.

## 중요 구현 원칙

1. **안전 흐름 후퇴 금지.** 민감 메시지는 사용량 제한 초과 여부와 무관하게 항상 감지 → 기록 → 운영진 알림 → 고정 안내 응답을 수행한다.
2. **기본값은 기존 동작 유지.** 새 env 미설정 시(제한 기본 30은 예외적으로 적용) 기존 흐름이 바뀌지 않아야 하고, `DM_CHAT_ENABLED=false`면 아무 것도 달라지지 않는다.
3. CommonJS, 새 npm dependency 금지, 저장은 repository 경유, JSON 직접 쓰기 금지.
4. 참여자 안내 문구는 차분한 존댓말로, 비난 없이 중립적으로 쓴다.
5. `.env`는 수정하지 않고 `.env.example`에만 placeholder를 추가한다. 실제 ID/토큰을 코드·문서에 쓰지 않는다.
6. git commit, git push는 하지 않는다.

## 수정 가능 파일

- src/operationBackup.js
- src/dmChat.js
- src/dmChatRepository.js
- scripts/restore-operation-backup.js (필요한 경우만)
- scripts/test-operation-backup-flow.js
- scripts/test-dm-chat-flow.js
- .env.example
- README.md
- docs/export-and-backup-guide.md
- docs/railway-env-guide.md
- docs/dm-chat-mvp-plan.md (구현 완료 표기 갱신)
- docs/prelaunch-qa-checklist.md

위 목록 밖의 파일 수정이 필요하다고 판단되면 작업 전에 사유를 요약한다.

## 작업 1. 백업 대상에 DM 로그 포함

`src/operationBackup.js`의 스냅샷 대상에 아래 항목을 추가한다.

- key: `dmChatLogs`
- 경로: `process.env.DM_CHAT_LOG_PATH || path.join(DATA_DIR, 'dm-chat-logs.local.json')`

주의:

- 파일이 없으면 기존 다른 대상과 동일한 방식으로 안전하게 건너뛴다.
- `scripts/restore-operation-backup.js`가 `dmChatLogs` 키를 복원하도록 하고, **이 키가 없는 이전 백업을 복원할 때 오류가 나지 않아야 한다.**
- `scripts/test-operation-backup-flow.js`에 다음 케이스를 추가한다:
  - DM 로그 파일이 있을 때 스냅샷에 포함된다.
  - `dmChatLogs` 키가 없는 스냅샷 복원이 실패하지 않는다.

## 작업 2. 사용자별 일일 사용량 제한

환경변수 `DM_CHAT_DAILY_LIMIT`를 추가한다.

- 미설정 시 기본 30. `0`이면 제한 해제. 숫자가 아니면 기본값으로 처리.
- 기준: KST 당일, 해당 사용자의 `role === 'user'` 메시지 수. 기존 로그 파일에서 계산하고 별도 상태 파일을 만들지 않는다. KST 날짜 계산은 기존 코드의 방식(`getKoreanDateString` 등 기존 helper가 있으면 재사용)을 따른다.
- `src/dmChatRepository.js`에 당일 사용자 메시지 수를 반환하는 함수를 추가한다 (예: `countTodayUserMessages(userId)` — 함수명은 기존 네이밍에 맞춘다).

`src/dmChat.js` 흐름 변경:

1. 사용자 메시지 저장·운영진 로그 전송까지는 기존과 동일하게 수행한다.
2. 민감 감지된 메시지는 제한과 무관하게 기존 안전 흐름을 그대로 진행한다.
3. 민감하지 않은 메시지이고 저장 직전 시점의 당일 카운트가 이미 상한 이상이면, AI를 호출하지 않고 아래 계열의 고정 안내로 응답하고 assistant 레코드로 저장한다.

   "오늘은 연습을 충분히 했어요. 내일 다시 이어서 연습해요. 급한 일이나 어려운 일이 있다면 운영진에게 문의해 주세요."

주의:

- 제한 안내 응답 자체는 `role: 'assistant'`로 저장하고 운영진 로그 채널에도 기존처럼 전송한다.
- 상한 판정 기준(저장 전/후 카운트)이 테스트에서 명확히 드러나게 구현한다.

테스트(`scripts/test-dm-chat-flow.js`)에 추가:

- 상한 도달 시 AI 호출이 발생하지 않고 제한 안내가 전송된다.
- 상한 초과 상태에서 민감 메시지를 보내면 안전 알림이 여전히 전송된다.
- `DM_CHAT_DAILY_LIMIT=0`이면 제한이 적용되지 않는다.

## 작업 3. AI 응답 출력 안전 검사

`src/dmChat.js`에서 `getDmChatReply`가 반환한 응답에 `detectSensitiveQuestion`을 적용한다.

- 감지되면 그 응답을 참여자에게 전송하지 않고, 아래 계열의 대체 안내로 바꾼다.

  "지금은 답변을 만들지 못했어요. 잠시 후 다시 말을 걸어 주세요."

- 저장하는 assistant 레코드에 출력 감지 사실이 남아야 한다. 기존 `safetyDetection` 필드를 재사용하되, 입력 감지와 구분 가능해야 한다 (예: 레코드에 `safetyDetectionSource: 'output'` 같은 보조 필드 — 필드명은 기존 스타일에 맞추고, `data/dm-chat-logs.local.json` shape이 바뀌므로 `docs/dm-chat-mvp-plan.md` 3.2 스키마 설명도 갱신한다).
- 운영진 DM 로그 채널 embed에서 출력 감지 건이 구분되어 보여야 한다 (`src/dmChatLogging.js` 수정이 필요하면 수정 가능 파일에 추가하고 사유를 요약한다).
- 이 경우 참여자에게 안전 알림용 문구를 보내지 않는다 (참여자의 잘못이 아니다). `sendDmChatSafetyAlert`도 호출하지 않는다.

테스트(`scripts/test-dm-chat-flow.js`)에 추가:

- 민감 키워드가 포함된 mock 응답이 참여자에게 전송되지 않고 대체 안내로 바뀐다.
- 저장된 레코드에서 출력 감지가 확인된다.

## 작업 4. 문서와 env 반영

- `.env.example`: `DM_CHAT_DAILY_LIMIT=30` placeholder 추가 (DM_CHAT 블록에).
- `docs/railway-env-guide.md`: 변수 설명과 `0` 해제 동작 추가.
- `README.md` DM 대화 섹션: 일일 제한과 응답 안전 검사 한 줄씩 추가.
- `docs/export-and-backup-guide.md`: 백업 대상에 DM 로그 포함됨을 반영.
- `docs/prelaunch-qa-checklist.md`: 제한 초과 안내, 출력 감지 대체 응답, 백업 포함 확인 항목 추가.
- `docs/dm-chat-mvp-plan.md`: 5.1의 세 작업을 구현 완료로 표기하고 3.2/3.3 표를 갱신.

## 작업 5. 검증

작업 완료 후 아래를 실행하고 결과를 보고한다.

```bash
node --check src/operationBackup.js
node --check src/dmChat.js
node --check src/dmChatRepository.js
node scripts/test-dm-chat-flow.js
node scripts/test-operation-backup-flow.js
node scripts/test-admin-dashboard-flow.js
npm run validate:data
npm run check:release
```

주의:

- 새 Slash Command를 추가하지 않았으므로 `npm run deploy`는 실행하지 않는다.
- git commit, git push는 하지 않는다.

## 완료 후 요약

- 변경된 파일 목록
- 백업 스냅샷/복원에 DM 로그가 포함되는 방식과 이전 백업 호환 처리
- 사용량 제한 판정 기준(당일 정의, 카운트 시점)과 해제 방법
- 출력 안전 검사에서 감지 시 저장 레코드 형태
- 추가/변경된 참여자 안내 문구 전문
- `.env.example`와 문서 반영 내역
- 성공 기준 S1~S3(docs/dm-chat-mvp-plan.md 7장) 충족 여부
- 전체 테스트 결과
