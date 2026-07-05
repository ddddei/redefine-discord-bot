# Codex 작업 지시서

## 작업 이름

DM 대화 고도화 v1 (운영 편의, 대화 초기화, 비용 가시성)

## 목표

프로젝트 리디파인 디스코드 봇의 DM 대화 연습 기능에 운영 편의 기능과 대화 초기화 기능을 추가한다. 이 작업은 `docs/dm-chat-improvement-plan.md` 전체를 구현하는 작업이며, `docs/dm-chat-mvp-plan.md`의 2단계 전부와 3-a/3-c 범위를 포함한다.

완료 시 다음이 모두 참이어야 한다.

1. 같은 사용자 반복 안전 감지 시 알림 채널 전송만 스로틀되고, DM 로그 저장과 DM 로그 채널 전송은 전량 유지된다.
2. `/운영현황` 종류에 `DM대화`가 추가되고, 당일 DM 요약 수치가 로그 파일 실측과 일치한다.
3. `/admin` DM 로그 섹션에서 사용자 ID, 안전 감지 여부, 개수 필터가 동작한다.
4. 참여자가 DM에서 정확히 "새로 시작"을 보내면 AI history 기준점만 초기화된다. 로그 원본은 삭제하지 않는다.
5. 당일 AI 응답 수는 별도 카운터 파일 없이 기존 assistant 로그에서 파생해 노출한다.

## 기준 문서

먼저 아래 문서를 읽고 현재 main 기준 코드와 비교한다.

- `docs/dm-chat-improvement-plan.md` (이번 작업의 기준 명세)
- `docs/dm-chat-mvp-plan.md` (DM 대화 전체 원칙, 성공 기준 S4~S7/S9~S11)
- `docs/railway-env-guide.md`
- `docs/operator-dashboard-guide.md`
- `docs/prelaunch-qa-checklist.md`
- `README.md`의 DM 대화 관련 섹션

## 현재 전제

- `src/dmChat.js`의 `handleDmChatMessage`가 DM 흐름을 처리한다.
- `src/dmChatLogging.js`의 `sendDmChatSafetyAlert`는 현재 안전 감지마다 알림 채널에 전송한다.
- `src/dmChatRepository.js`는 `version: 2` 로그를 읽고 쓰며, `countTodayUserMessages`와 `listRecentMessagesForAdmin`을 제공한다.
- `src/adminApi.js`의 `listRecentDmChatMessages`는 `matchedKeyword`를 노출하지 않고 `safetyDetection`을 category/severity 요약으로만 반환한다.
- `src/adminServer.js`의 `/api/admin/dm-chat-logs`는 현재 `limit`만 받는다.
- `public/admin/index.html`, `public/admin/admin.js`, `public/admin/admin.css`는 빌드 없이 정적 파일로 서빙된다.
- `/운영현황`은 `src/deploy-commands.js`의 command schema와 `src/handlers.js`의 `handleOperationStatusCommand` 분기를 함께 갱신해야 한다.
- 운영자 embed는 주로 `src/embeds.js`에 있고, 필요하면 기존 operator embed 패턴을 따른다.

## 중요 구현 원칙

1. **안전 흐름 후퇴 금지.** 어떤 변경도 "민감 감지 시 AI 미호출 + 운영진 알림 + 기록"을 약화할 수 없다.
2. 안전 알림 스로틀은 **알림 채널 전송에만** 적용한다. 사용자 메시지 저장, assistant 안내 저장, DM 로그 채널 embed 전송, 참여자 안내 응답은 전량 유지한다.
3. `SAFETY_ALERT_THROTTLE_MINUTES` 기본값은 10이다. `0`이면 스로틀을 끄고 기존 전량 알림 동작으로 돌아간다. 숫자가 아니면 기본값 10으로 처리한다.
4. `/admin`은 읽기 전용 MVP를 유지한다. 새 쓰기 API, 삭제 API, 수정 API를 만들지 않는다.
5. `matchedKeyword`, 실제 토큰, 실제 채널 ID, 참여자 개인정보 원문을 dashboard/API/docs/test fixture에 노출하지 않는다.
6. CommonJS, 새 npm dependency 금지, 저장은 repository 경유, 원자 저장 유지.
7. 새 상태 파일을 만들지 않는다. 스로틀은 메모리, 요약/AI 응답 수는 로그 파생, 초기화 기준점은 기존 DM 로그 파일 안에 저장한다.
8. `DM_CHAT_ENABLED=false`일 때 DM 대화 기능은 계속 침묵해야 한다.
9. slash command schema가 바뀌므로 구현 완료 보고와 PR 설명에 `npm run deploy` 필요 사실을 명시한다. Codex가 운영 Discord 환경에서 `npm run deploy`를 직접 실행하지 않는다.
10. git commit, git push는 하지 않는다.

## 수정 가능 파일

- `src/dmChat.js`
- `src/dmChatLogging.js`
- `src/dmChatRepository.js`
- `src/adminApi.js`
- `src/adminServer.js`
- `src/handlers.js`
- `src/deploy-commands.js`
- `src/embeds.js`
- `src/components.js` (운영자 허브 select에도 DM 대화 항목을 노출해야 한다고 판단되는 경우만)
- `src/operationalRecords.js` (example/demo 제외 helper 확장이 필요한 경우만)
- `public/admin/index.html`
- `public/admin/admin.js`
- `public/admin/admin.css`
- `scripts/test-dm-chat-flow.js`
- `scripts/test-admin-dashboard-flow.js`
- `scripts/test-operator-hub-flow.js`
- `scripts/test-slash-command-docs-consistency.js` (command schema 문서 일관성 테스트가 깨지는 경우만)
- `scripts/validate-data.js` (DM 로그 example fixture를 추가하는 경우만)
- `data/dm-chat-logs.example.json` (필요한 경우 새로 추가, `data/*.local.json`은 절대 커밋하지 않음)
- `.env.example`
- `README.md`
- `docs/railway-env-guide.md`
- `docs/operator-dashboard-guide.md`
- `docs/prelaunch-qa-checklist.md`
- `docs/dm-chat-mvp-plan.md`
- `docs/dm-chat-improvement-plan.md`

위 목록 밖의 파일 수정이 필요하면 먼저 사유를 요약한다.

## 작업 1. 안전 알림 스로틀

`src/dmChatLogging.js`의 `sendDmChatSafetyAlert`에 사용자별 메모리 스로틀을 추가한다.

요구사항:

- 새 env: `SAFETY_ALERT_THROTTLE_MINUTES`
  - 기본 10
  - `0`이면 스로틀 해제
  - 음수/문자/NaN은 기본 10
- module-level `Map`으로 사용자별 마지막 안전 알림 전송 시각과 생략 건수를 관리한다. 재시작 시 초기화되어도 된다.
- 같은 사용자에게 스로틀 간격 내 안전 감지가 다시 발생하면 알림 채널 전송만 생략한다.
- 생략 건수는 누적하고, 간격 경과 후 다음 알림 embed에 아래 계열의 필드를 추가한다.
  - `스로틀 생략`: `이 알림 전 N건이 스로틀로 생략되었어요. 로그에는 모두 기록돼요.`
- 스로틀되어도 `sendDmChatOperatorLog` 경로와 repository 저장 경로는 건드리지 않는다.
- 반환값은 기존 boolean 호출부와 충돌하지 않게 유지한다. 테스트가 전송 여부를 판단할 수 있으면 좋다.

테스트:

- `scripts/test-dm-chat-flow.js`
  - 같은 사용자 민감 DM 2회 연속: 안전 알림 채널 전송 1회, DM 로그 채널 embed 2회 이상, 로그 저장 2건 이상.
  - 스로틀 간격 경과 후 다음 감지: 안전 알림 전송 재개, 생략 건수 표기.
  - `SAFETY_ALERT_THROTTLE_MINUTES=0`: 반복 감지 전량 알림 전송.
  - 서로 다른 사용자는 서로 스로틀하지 않는다.

## 작업 2. `/운영현황` DM 대화 요약

`/운영현황`의 `종류` choices에 `{ name: 'DM대화', value: 'dmChat' }`를 추가하고, handler에서 해당 분기를 구현한다.

요약 기준:

- KST 당일 기준.
- example/demo/sample/isExample 레코드와 2030년대 예시 날짜는 제외한다. 기존 `filterOperationalRecords` 패턴을 재사용한다.
- 오늘 대화한 사용자 수: 당일 `role === 'user'` 레코드의 distinct `userId`.
- 오늘 user 메시지 수.
- 오늘 assistant 응답 수.
- 오늘 안전 감지 수: input/output 구분 표기.
- 오늘 오류 수: `error` 필드가 있는 레코드 수.
- AI 호출 가시성: 당일 assistant 레코드 수를 `오늘 AI 응답 수`로 노출한다. 별도 카운터 파일을 만들지 않는다.

구현 방향:

- `src/dmChatRepository.js`에 당일 요약 조회 함수를 추가한다. 함수명은 기존 네이밍에 맞춘다.
- `src/embeds.js`에 DM 대화 요약 operator embed를 추가하거나, 기존 operator embed 패턴을 재사용한다.
- `src/handlers.js`의 `handleOperationStatusCommand`에서 `dmChat` 분기를 추가한다.
- `src/deploy-commands.js`에 slash command choice를 추가한다.

테스트:

- `scripts/test-operator-hub-flow.js`에 `dmChat` 요약 수치가 fixture 로그 기준 실측과 일치하는 케이스를 추가한다.
- `/운영현황 종류:DM대화`가 ephemeral 응답을 만들고 expected embed title/fields를 포함하는지 확인한다.
- slash command choices에 `DM대화`가 포함되는지 확인한다.

## 작업 3. `/admin` DM 로그 필터

`/api/admin/dm-chat-logs`에 query filter를 추가하고, 정적 dashboard에 필터 UI를 붙인다.

API 요구사항:

- `userId`: 완전 일치 필터.
- `safetyOnly=true`: input/output 안전 감지 레코드만 반환.
- `limit`: 기본 기존값 유지, 최대 100 clamp. 기존 `parseLimit` 동작을 재사용한다.
- 응답은 계속 `{ data, meta }` 형태를 유지한다.
- `safetyDetection`은 category/severity/source 정도만 노출한다. `matchedKeyword`는 어떤 경로에서도 응답에 포함하지 않는다.

프런트 요구사항:

- `public/admin/index.html`의 DM CHAT 섹션에 사용자 ID 입력, 안전 감지만 체크박스, 개수 선택을 추가한다.
- `public/admin/admin.js`에서 필터 값을 query string으로 반영해 `/api/admin/dm-chat-logs`를 다시 호출한다.
- `public/admin/admin.css`는 기존 dashboard 톤을 유지한다.
- dashboard는 계속 읽기 전용임을 화면 문구와 기능 모두에서 유지한다.

테스트:

- `scripts/test-admin-dashboard-flow.js`
  - `userId` 완전 일치 필터.
  - `safetyOnly=true` 필터.
  - `limit=101`이 100으로 clamp.
  - 필터 응답에도 `matchedKeyword`가 없다.
  - 쓰기 요청 경로가 생기지 않는다.

## 작업 4. "새로 시작" 대화 초기화

참여자가 DM으로 정확히 "새로 시작"을 보내면 AI history 기준점만 초기화한다.

흐름:

1. `DM_CHAT_ENABLED`와 DM payload 확인은 기존 순서 유지.
2. 첫 안내, 사용자 메시지 저장, DM 로그 채널 전송은 기존처럼 수행한다.
3. 민감 감지를 먼저 평가한다. 민감 감지 시 기존 안전 흐름으로 종료한다.
4. 민감하지 않고 trim한 내용이 정확히 `새로 시작`이면 초기화 처리한다.
5. AI 호출은 하지 않는다.
6. 안내 응답을 assistant record로 저장하고 DM 로그 채널에도 전송한다.

저장 스키마:

- `src/dmChatRepository.js`
  - `CURRENT_DM_CHAT_LOG_VERSION`을 3으로 올린다.
  - 최상위 `historyResets: [{ userId, resetAt }]`를 추가한다.
  - 사용자당 최신 1건만 유지한다.
  - version 2 파일처럼 `historyResets`가 없는 파일도 안전하게 읽는다.
- `listRecentMessages` 또는 새 helper가 AI history를 만들 때 reset 시각 이후 메시지만 반환하도록 한다.
- 로그 원본 `messages`는 삭제하지 않는다.
- `data/*.local.json`은 수정하거나 커밋하지 않는다.

응답 문구:

아래 계열의 차분한 존댓말을 사용한다.

```text
좋아요, 새 마음으로 다시 시작해요. 편하게 말을 걸어 주세요.
```

테스트:

- `scripts/test-dm-chat-flow.js`
  - "새로 시작" 후 다음 AI 호출 history에 이전 메시지가 포함되지 않는다.
  - "새로 시작" user record와 assistant 안내 record는 로그에 남는다.
  - 로그 원본은 삭제되지 않는다.
  - version 2 로그 파일을 읽어도 오류가 없고, 저장 후 version 3/historyResets 형태가 된다.
  - " 새로 시작 "처럼 앞뒤 공백이 있는 입력은 trim 후 초기화로 처리된다.
  - "새로 시작해줘"처럼 정확히 일치하지 않는 입력은 일반 대화로 처리된다.

## 작업 5. 문서와 env 반영

다음을 함께 갱신한다.

- `.env.example`
  - `SAFETY_ALERT_THROTTLE_MINUTES=10`
- `docs/railway-env-guide.md`
  - 기본값 10, `0` 해제, 스로틀 대상은 안전 알림 채널 전송뿐이라는 점.
- `README.md`
  - DM 대화 운영 편의 요약.
- `docs/operator-dashboard-guide.md`
  - `/운영현황 종류:DM대화`와 `/admin` DM 로그 필터 설명.
- `docs/prelaunch-qa-checklist.md`
  - 스로틀, DM 요약, admin 필터, "새로 시작", `DM_CHAT_ENABLED=false` 회귀 확인.
- `docs/dm-chat-mvp-plan.md`
  - 2단계 + 3-a/3-c 구현 완료 표기.
  - 성공 기준 S4~S7/S9~S11 충족 근거 갱신.
- `docs/dm-chat-improvement-plan.md`
  - 완료 시 구현 완료 표기와 실제 신규 카피 목록 반영.

주의:

- 보존 정책 3-b는 구현하지 않는다.
- OpenAI 토큰/비용 단위 정밀 집계는 구현하지 않는다.
- `/admin` 쓰기 기능은 구현하지 않는다.

## 검증

작업 완료 후 아래를 실행하고 결과를 보고한다.

```bash
node --check src/dmChat.js
node --check src/dmChatLogging.js
node --check src/dmChatRepository.js
node --check src/adminApi.js
node --check src/adminServer.js
node --check src/handlers.js
node --check src/deploy-commands.js
node --check src/embeds.js
node scripts/test-dm-chat-flow.js
node scripts/test-admin-dashboard-flow.js
node scripts/test-operator-hub-flow.js
npm run validate:data
npm run test:questions
npm run check:release
```

정적 dashboard를 수정했으므로 가능한 경우 `.claude/launch.json`의 local admin 실행 설정이나 임시 QA 인증값으로 admin server를 띄운 뒤 `/admin`을 열어 필터 UI를 수동 확인한다.

수동 확인 항목:

1. `/admin` 접속과 Basic Auth.
2. DM 로그 필터 3종 동작.
3. 필터 변경 후 화면이 깨지지 않고 읽기 전용 안내가 유지됨.
4. `/api/admin/dm-chat-logs?safetyOnly=true&limit=101` 응답에 `matchedKeyword`가 없음.

주의:

- slash command schema가 바뀌므로 `npm run deploy` 필요 사실만 보고한다. 운영 Discord 대상에 직접 deploy하지 않는다.
- git commit, git push는 하지 않는다.

## 완료 후 요약

완료 보고에 아래를 포함한다.

- 변경된 파일 목록.
- 안전 알림 스로틀 기준, 기본값, 해제 방법.
- 스로틀 중에도 유지되는 기록/로그 경로.
- `/운영현황 종류:DM대화` 요약 항목과 산출 기준.
- `/admin` DM 로그 필터 query와 노출/비노출 필드.
- "새로 시작" 초기화 저장 스키마와 history 기준점 처리.
- 신규/변경 참여자 안내 문구 전문.
- `.env.example`와 운영 문서 반영 내역.
- `npm run deploy` 후속 필요 여부.
- 자동 검증과 수동 `/admin` 확인 결과.
