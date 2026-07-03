# DM 대화 연습 기능 개발 계획 문서

## 1. 문서 목적

이 문서는 프로젝트 리디파인 디스코드 봇의 **DM 대화 연습 기능**에 대한 개발 계획 문서이다. 현재 구현 상태(v1), 전체 구조, 개발 접근 방식, 단계별 작업 범위, 성공 기준, 제약 조건, 위험과 롤백 기준을 정의한다.

이 문서는 아래 용도로 사용한다.

- 운영자/개발자가 DM 대화 기능의 확정 동작과 남은 작업을 구분해 파악한다.
- Codex 작업 지시서(`prompts/codex/dm-chat-*.md`)를 만들 때 범위와 원칙의 기준으로 삼는다.
- 각 단계 PR의 완료 여부를 성공 기준에 따라 판정한다.

"구현 완료"로 표기한 항목은 실제 코드 기준이며, 그 외는 계획이다. 구현되지 않은 동작을 운영 문서에 확정 동작처럼 쓰지 않는다.

---

## 2. 기능 정의와 범위

### 2.1 기능 정의

DM 대화 연습은 참여자가 봇과 1:1 DM으로 **사람들과 대화하기 전 짧은 연습**을 하는 기능이다.

- 상담·진단·치료를 하지 않는다. 위기 대응은 기존 민감 질문 감지 → 운영진 알림 흐름으로 연결한다.
- 모든 대화는 기록되며 운영진이 확인할 수 있다는 점을 첫 DM에서 고지한다.
- 기본값은 비활성화(`DM_CHAT_ENABLED=false`)이며, 운영진이 명시적으로 켠 경우에만 동작한다.

### 2.2 v1 구현 완료 범위

| 영역 | 내용 | 코드 |
| --- | --- | --- |
| DM 수신/응답 | env 게이트, 첫 안내 1회, 빈 내용(Intent 미설정) 안내, AI 응답/오류 fallback | `src/dmChat.js` |
| AI 응답 생성 | `mock`/`openai` provider, 사용자별 최근 이력 전달(기본 8, 최대 20), 입력 민감 키워드 시 생성 차단 | `src/ai.js` `getDmChatReply` |
| 안전 감지 | 기존 민감 질문 규칙 재사용, 감지 시 AI 미호출 + 안전 알림 + 고정 안내 문구 | `src/safety.js`, `src/dmChat.js` |
| 로그 저장 | `data/dm-chat-logs.local.json`(또는 `DM_CHAT_LOG_PATH`), 원자 저장(`pointsStore.saveJsonFile`) | `src/dmChatRepository.js` |
| 운영진 로그/알림 | DM 로그 채널 embed, 안전 알림 채널 embed("자동 판단 아님" 고지 포함) | `src/dmChatLogging.js` |
| 운영 안정 | 운영 백업 `dmChatLogs` 포함, KST 일일 사용자 메시지 제한, AI 응답 출력 안전 검사 | `src/operationBackup.js`, `src/dmChat.js`, `src/dmChatRepository.js`, `src/dmChatLogging.js` |
| `/admin` 열람 | `/api/admin/dm-chat-logs` + 읽기 전용 섹션, example 제외, safetyDetection은 category/severity만 노출 | `src/adminApi.js`, `src/adminServer.js`, `public/admin/*` |
| 테스트 | DM 흐름 스모크, admin 대시보드 스모크 | `scripts/test-dm-chat-flow.js`, `scripts/test-admin-dashboard-flow.js` |

### 2.3 이 계획에서 다루는 후속 범위

1. 운영 안정(구현 완료): 백업 포함, 사용량 제한, AI 응답 출력 안전 검사
2. 운영 편의: 안전 알림 스로틀, `/운영현황` DM 요약, `/admin` 필터
3. 품질/정책: 대화 초기화, 로그 보존/삭제 정책, 비용 모니터링

### 2.4 범위에서 제외 (이 계획에서 진행하지 않음)

- `/admin`에서 DM 응대/답장/삭제 등 쓰기 기능 (읽기 전용 MVP 원칙 유지)
- DM 로그의 외부 저장소 이전 (local JSON 유지; Sheets/DB는 `docs/google-sheets-integration-plan.md` 계열에서 별도 검토)
- 민감 키워드 감지를 자동 판단으로 확대 (키워드 감지 + 운영진 확인 원칙 유지)
- 새 npm dependency 추가
- 음성/이미지 DM 처리, 다국어 응답

---

## 3. 전체 구조

### 3.1 모듈 구조

```
Discord DM (messageCreate)
        │
        ▼
src/dmChat.js ──────────── 흐름 제어 (게이트 → 안내 → 감지 → 저장 → 응답)
   │        │        │
   │        │        └─► src/safety.js          입력(및 이후 출력) 민감 감지
   │        └─► src/ai.js getDmChatReply         mock/openai 응답 생성
   ▼
src/dmChatRepository.js ── data/dm-chat-logs.local.json (원자 저장)
   │
   ├─► src/dmChatLogging.js ─► DM 로그 채널 / 안전 알림 채널 (embed)
   ├─► src/adminApi.js listRecentDmChatMessages ─► /api/admin/dm-chat-logs ─► /admin
   └─► src/operationBackup.js 스냅샷 대상(dmChatLogs) ─► 백업 채널
```

### 3.2 데이터 구조 (`data/dm-chat-logs.local.json`, version 2)

```json
{
  "version": 2,
  "isExample": false,
  "notices": [{ "userId": "...", "username": "...", "displayName": "...", "sentAt": "ISO" }],
  "messages": [
    {
      "id": "dm_chat_<ts>_<rand>",
      "createdAt": "ISO",
      "userId": "...", "username": "...", "displayName": "...",
      "role": "user | assistant",
      "content": "...",
      "safetyDetection": { "category": "...", "severity": "...", "matchedKeyword": "..." },
      "safetyDetectionSource": "input | output | null",
      "error": null
    }
  ]
}
```

스키마 변경 시 `version`을 올리고 `normalizeData`에서 하위 버전을 안전하게 읽도록 유지한다. 저장 데이터 shape 변경은 repository, example fixture, 검증/스모크 테스트, 문서를 한 PR에서 함께 갱신한다.

### 3.3 환경변수 (확정 + 이 계획에서 추가 예정)

| 변수 | 상태 | 용도 |
| --- | --- | --- |
| `DM_CHAT_ENABLED` | 확정 | 기능 on/off (기본 off) |
| `DM_CHAT_HISTORY_LIMIT` | 확정 | AI에 전달할 사용자별 최근 대화 수 (기본 8, 최대 20) |
| `DM_CHAT_LOG_PATH` | 확정 | 로그 JSON 경로 |
| `DM_CHAT_LOG_CHANNEL_ID` | 확정 | 운영진 DM 로그 채널 (fallback: `LOG_CHANNEL_ID`) |
| `SAFETY_ALERT_CHANNEL_ID` | 확정 | 안전 알림 채널 (fallback: DM 로그 채널 → `LOG_CHANNEL_ID`) |
| `AI_ENABLED` / `AI_PROVIDER` / `AI_MODEL` / `OPENAI_API_KEY` | 확정 | 응답 생성 설정 |
| `DM_CHAT_DAILY_LIMIT` | 확정 | 사용자별 일일 user 메시지 상한 (미설정 시 기본 30, `0`이면 제한 해제) |
| `SAFETY_ALERT_THROTTLE_MINUTES` | 2단계 추가 | 같은 사용자 반복 안전 알림 묶음 간격 (기본 10) |

확정된 새 환경변수는 `.env.example`과 `docs/railway-env-guide.md`에 같은 PR에서 반영한다. 향후 단계에서 추가되는 변수도 같은 원칙을 따른다.

---

## 4. 개발 접근 방식

### 4.1 원칙

1. **안전 우선.** 안전 감지/알림 경로는 사용량 제한 등 어떤 제한보다 우선한다. 제한에 걸린 사용자의 민감 메시지도 감지·알림·기록은 항상 수행한다.
2. **기본값은 보수적으로.** 새 동작은 env로 게이트하고, 미설정 시 기존 동작과 동일하게 유지한다.
3. **작은 단계, 독립 PR.** 각 단계는 단독으로 배포/롤백 가능해야 한다. 한 PR이 여러 단계를 묶지 않는다.
4. **기존 구조 재사용.** 감지는 `safety.js`, 저장은 `dmChatRepository.js`(원자 저장), 리포트는 미니게임 리포트(PR #51) 패턴, 백업은 `operationBackup.js` 스냅샷 패턴을 따른다. 새 저장 파일과 새 dependency를 만들지 않는다.
5. **개인정보 최소화.** 대시보드/리포트에는 표시명·ID 일부·시간·role·내용 일부·감지 요약만 노출한다. `matchedKeyword`, 토큰, 채널 ID는 노출하지 않는다.
6. **문서 동시 갱신.** 동작이 바뀌는 PR은 README, `docs/railway-env-guide.md`, `docs/operator-dashboard-guide.md`, `docs/prelaunch-qa-checklist.md` 중 해당 문서를 함께 갱신한다.

### 4.2 진행 절차 (Codex 구현)

1. 이 문서에서 해당 단계의 범위를 확인하고 Codex 작업 지시서(`prompts/codex/dm-chat-*-v1.md`)를 작성한다. 지시서에는 수정 가능 파일 목록, 구현 원칙, 작업 목록, 검증 명령, 완료 후 요약 항목을 명시한다.
2. 운영자가 지시서를 승인하면 `feat/*` 브랜치에서 Codex가 구현한다.
3. 구현 후 6장 검증 절차를 통과하면 PR을 올리고 merge commit으로 `main`에 합친다.
4. 단계 완료 시 이 문서의 해당 항목을 "구현 완료"로 갱신한다.

단계 → 지시서 매핑:

| 단계 | Codex 지시서 | 상태 |
| --- | --- | --- |
| 1단계 운영 안정 | `prompts/codex/dm-chat-hardening-v1.md` | 구현 완료 |
| 2단계 운영 편의 | `prompts/codex/dm-chat-ops-visibility-v1.md` | 1단계 완료 후 작성 |
| 3단계 품질/정책 | `prompts/codex/dm-chat-retention-v1.md` | 보존 정책 확정 후 작성 |

---

## 5. 단계별 개발 계획

### 5.1 1단계: 운영 안정 (구현 완료)

목표: 데이터 유실, 비용 폭주, 부적절 응답 세 가지 운영 리스크를 막는다.

상태: 구현 완료. S1~S3는 `scripts/test-operation-backup-flow.js`와 `scripts/test-dm-chat-flow.js`에서 확인한다.

**작업 1-a. 백업 대상에 DM 로그 포함 (구현 완료)**

- `src/operationBackup.js`의 스냅샷 대상에 `dmChatLogs`(경로: `DM_CHAT_LOG_PATH` 또는 기본 `data/dm-chat-logs.local.json`)를 추가한다.
- 복원 스크립트(`scripts/restore-operation-backup.js`)가 새 키를 안전하게 처리하는지 확인하고, 이전 백업(키 없음)을 복원할 때 오류가 나지 않아야 한다.
- 수정 파일: `src/operationBackup.js`, `scripts/restore-operation-backup.js`(필요 시), `scripts/test-operation-backup-flow.js`, `docs/export-and-backup-guide.md`

**작업 1-b. 사용자별 일일 사용량 제한 (구현 완료)**

- `DM_CHAT_DAILY_LIMIT`(기본 30, `0`이면 제한 해제)을 추가한다. 기준은 KST 당일 해당 사용자의 `role=user` 메시지 수이며, 별도 상태 파일 없이 기존 로그에서 계산한다.
- 상한 도달 시: 사용자 메시지는 평소대로 저장·로그 전송하되 AI를 호출하지 않고 "오늘 연습을 충분히 했어요. 내일 다시 이어가요." 계열의 고정 안내로 응답한다.
- 민감 감지 메시지는 상한과 무관하게 기존 안전 흐름(알림 + 안내)을 그대로 수행한다.
- 수정 파일: `src/dmChat.js`, `src/dmChatRepository.js`(당일 카운트 조회 추가), `scripts/test-dm-chat-flow.js`, `.env.example`, `docs/railway-env-guide.md`, `README.md`

**작업 1-c. AI 응답 출력 안전 검사 (구현 완료)**

- `handleDmChatMessage`에서 생성된 응답에 `detectSensitiveQuestion`을 적용한다. 감지 시 그 응답을 전송하지 않고 준비 중/재시도 안내로 대체하며, 로그 레코드에 감지 사실을 남긴다(운영진 로그 채널에서 구분 가능해야 함).
- 출력 감지는 참여자에게 안전 알림 문구를 보내는 사유가 아니다(참여자 잘못이 아님). 운영진 알림 채널 전송 여부는 로그 채널 embed 표시로 갈음한다.
- 수정 파일: `src/dmChat.js`, `src/dmChatLogging.js`, `scripts/test-dm-chat-flow.js`

완료 조건: 6장 검증 통과 + 아래 성공 기준 S1~S3 충족.

### 5.2 2단계: 운영 편의

목표: 운영진이 DM 운영 상태를 Discord와 `/admin`에서 빠르게 파악한다.

- **2-a. 안전 알림 스로틀**: 같은 사용자에 대해 `SAFETY_ALERT_THROTTLE_MINUTES`(기본 10) 내 반복 감지 시 알림 채널 전송을 생략하고, 로그 저장과 DM 로그 채널 전송은 모두 유지한다. 스로틀 상태는 메모리로만 유지한다(재시작 시 초기화 허용).
- **2-b. `/운영현황` DM 대화 요약**: 오늘 DM 사용자 수 / user 메시지 수 / 안전 감지 수 / 오류 수. `src/minigameReport.js` 패턴을 따른다. 새 Slash Command는 추가하지 않고 기존 `/운영현황` 종류 선택에 추가한다(command 스키마 변경 시 `npm run deploy` 필요 여부를 PR에 명시).
- **2-c. `/admin` DM 로그 필터**: `/api/admin/dm-chat-logs`에 `userId`, `safetyOnly`, `limit`(최대 100) 쿼리 지원과 프런트 필터 UI. 읽기 전용 유지.

수정 파일 후보: `src/dmChatLogging.js`, `src/handlers.js`, `src/dmChatRepository.js`, `src/adminApi.js`, `src/adminServer.js`, `public/admin/*`, `scripts/test-dm-chat-flow.js`, `scripts/test-admin-dashboard-flow.js`, `scripts/test-operator-hub-flow.js`, 관련 문서.

### 5.3 3단계: 품질과 정책

목표: 장기 운영을 위한 데이터 정책과 비용 가시성.

- **3-a. 대화 초기화**: DM에서 "새로 시작" 트리거(또는 `/대화초기화`)로 AI에 전달하는 history 기준점만 이동한다. 로그는 삭제하지 않는다.
- **3-b. 로그 보존 정책**: 보존 기간(운영진 확정, 예: 90일) 경과 메시지 정리 스크립트 + 참여자 요청 시 특정 사용자 기록 삭제 절차. `docs/production-data-reset-guide.md`와 연결한다. **개인 대화 데이터이므로 보존 기간과 고지 문구를 운영진이 확정하기 전에는 구현하지 않는다.**
- **3-c. 비용 모니터링**: OpenAI 호출 수를 일 단위로 기록하고 `/운영현황` DM 요약에 노출한다.

---

## 6. 검증 및 릴리즈 절차

모든 단계 공통. Codex 지시서의 "검증" 섹션에 그대로 포함한다.

```bash
node --check <수정한 src/scripts 파일 각각>
node scripts/test-dm-chat-flow.js
node scripts/test-admin-dashboard-flow.js
node scripts/test-operation-backup-flow.js   # 1-a 이후 항상
npm run validate:data
npm run check:release
```

- `npm run deploy`는 slash command 스키마를 바꾼 경우에만, 운영자가 직접 실행한다.
- git commit/push는 운영자 승인 후 진행한다 (Codex는 커밋하지 않는다).
- 실서버 수동 확인(각 단계 PR 설명에 결과 기재):
  1. `DM_CHAT_ENABLED=true`로 테스트 계정 DM → 첫 안내 1회 → 로그 채널 embed → `/admin` 표시.
  2. 민감 키워드 DM → 안전 알림 도착, AI 미호출.
  3. (1단계 후) 상한 초과 DM → 제한 안내, 민감 메시지는 여전히 알림.
  4. (1-a 후) 백업 embed에 DM 로그 포함, 복원 스크립트 정상 동작.

---

## 7. 성공 기준

각 항목은 테스트 또는 수동 확인으로 판정 가능해야 한다.

**1단계**

- S1. 백업 스냅샷과 복원에 DM 로그가 포함되고, DM 로그 키가 없는 이전 백업 복원도 실패하지 않는다. (`test-operation-backup-flow.js`)
- S2. `DM_CHAT_DAILY_LIMIT` 초과 시 AI 호출이 발생하지 않고 제한 안내가 전송되며, 초과 상태에서도 민감 메시지는 안전 알림이 전송된다. (`test-dm-chat-flow.js`)
- S3. 민감 키워드를 포함한 AI 응답이 참여자에게 전송되지 않고 대체 안내로 바뀌며, 로그에서 확인 가능하다. (`test-dm-chat-flow.js`)

**2단계**

- S4. 같은 사용자 연속 감지 시 스로틀 간격 내 알림 채널 전송이 1회로 줄고, 로그 저장은 전부 유지된다.
- S5. `/운영현황` DM 요약 수치가 로그 파일 기준 실제 수치와 일치한다.
- S6. `/admin` 필터가 동작하고 쓰기 요청 경로가 존재하지 않는다.

**3단계**

- S7. 대화 초기화 후 AI 입력에 이전 이력이 포함되지 않고, 로그 원본은 보존된다.
- S8. 보존 정리 스크립트가 기준일 이전 메시지만 제거하고 실행 결과를 요약 출력한다.

**공통 (모든 단계)**

- S9. `npm run check:release` 전체 통과, 기존 명령어/흐름 회귀 없음.
- S10. `DM_CHAT_ENABLED=false` 또는 새 env 미설정 시 기존 동작과 완전히 동일하다.
- S11. 새 env가 `.env.example`과 railway 가이드에 반영되어 있다.

---

## 8. 제약 조건

1. **CommonJS + 무의존성 유지.** `require`/`module.exports`, 새 npm dependency 금지. 테스트는 plain Node + `assert`.
2. **저장은 repository 경유.** DM 로그는 `dmChatRepository.js`, 포인트류는 `pointsRepository.js`만 사용. JSON 직접 쓰기 금지. 쓰기는 항상 원자 저장.
3. **읽기 전용 `/admin`.** DM 관련 쓰기 API를 만들지 않는다.
4. **개인정보.** `matchedKeyword`·토큰·실제 채널 ID를 대시보드/문서/코드 주석에 노출하지 않는다. example/demo/sample 기록과 2030년대 예시 날짜를 운영 데이터처럼 표시하지 않는다. `.env`와 `data/*.local.json`은 커밋하지 않는다.
5. **안전 흐름 후퇴 금지.** 어떤 변경도 "민감 감지 시 AI 미호출 + 운영진 알림 + 기록"을 약화시킬 수 없다. 감지는 키워드 기반이며 자동 판단이 아니라는 고지를 유지한다.
6. **참여자 문구 톤.** 차분하고 직접적인 존댓말, 기존 README/docs 문구와 일관되게. 제한 안내도 비난 없이 중립적으로 쓴다.
7. **성능 전제.** local JSON 전체 읽기/쓰기 구조는 MVP 기간(수십 명 규모) 동안 유지한다. 메시지 수가 수만 건 규모로 커지면 3-b 보존 정리 또는 저장소 이전을 먼저 진행한다.

---

## 9. 위험과 롤백

| 위험 | 대응 | 롤백 |
| --- | --- | --- |
| 백업 키 추가로 복원 스크립트가 이전 백업과 충돌 | 키 부재를 허용하는 방어 코드 + 테스트 (S1) | 스냅샷 대상 한 줄 제거 |
| 사용량 제한 오작동으로 정상 사용자 차단 | `DM_CHAT_DAILY_LIMIT=0`으로 즉시 해제 가능하게 설계 | env 변경만으로 해제 |
| 출력 안전 검사 과잉 차단(정상 응답까지 대체) | 감지 로그를 남겨 오탐 키워드를 운영진이 확인 → `safety.js` 규칙 조정 | 검사 분기 제거 |
| 알림 스로틀로 긴급 상황 누락 | 스로틀은 알림 채널만 적용, 로그/DM 로그 채널은 전량 유지 | env 0으로 해제 |
| OpenAI 장애/비용 급증 | 기존 오류 fallback 유지 + `AI_ENABLED=false`로 즉시 응답 생성 중단(기록·알림은 유지) | env 변경 |

모든 단계는 env 게이트 또는 소규모 diff이므로, 긴급 시 해당 PR revert 또는 env 변경으로 롤백한다.

---

## 10. 문서 이력

- 2026-07-03: 최초 작성. v1 구현 완료 범위 정리, 1~3단계 계획·성공 기준·제약 확정. 1단계 Codex 지시서 `prompts/codex/dm-chat-hardening-v1.md` 작성.
