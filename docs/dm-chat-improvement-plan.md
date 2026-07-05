# DM 대화 고도화 v1 계획서 — 운영 편의·대화 초기화·비용 가시성 (완성 배포판)

DM 대화 연습 기능의 고도화 v1 전체 명세이자 구현 완료 기록입니다. 기준 문서는 [dm-chat-mvp-plan.md](dm-chat-mvp-plan.md)이고, 이 계획서는 그 2단계(운영 편의) 전부와 3단계 중 **보존 정책과 무관한 항목(대화 초기화·비용 가시성)** 을 완성 배포판 수준으로 상세화한 것입니다. 절대 조건: **안전 흐름 후퇴 금지** — 어떤 변경도 "민감 감지 시 AI 미호출 + 운영진 알림 + 기록"을 약화시킬 수 없다.

상태: 2026-07-05 구현 완료. 배포 후 대상 Discord 환경에서 slash command 스키마 갱신을 위해 `npm run deploy`를 실행해야 한다.

## 0. 완성 정의 (이것이 전부 참이면 완료)

1. 같은 사용자 반복 안전 감지 시 알림 채널 전송이 스로틀되고, 로그 저장·DM 로그 채널 전송은 전량 유지된다
2. `/운영현황` 종류에 "DM대화"가 추가되어 당일 요약 수치가 로그 파일 실측과 일치한다
3. `/admin` DM 로그 섹션에 사용자·안전감지·개수 필터가 동작한다 (읽기 전용 유지)
4. 참여자가 DM에서 "새로 시작"으로 AI history 기준점을 초기화할 수 있다 (로그는 보존)
5. `npm run check:release` 전체 통과 + `DM_CHAT_ENABLED=false` 회귀 확인 + 새 env/`npm run deploy` 후속이 문서화된다

## 1. 작업 A — 안전 알림 스로틀 (2-a)

- 새 env `SAFETY_ALERT_THROTTLE_MINUTES` (기본 10, `0`이면 스로틀 해제). `.env.example`·`docs/railway-env-guide.md` 동시 갱신.
- `src/dmChatLogging.js` `sendDmChatSafetyAlert`에 사용자별 마지막 알림 시각을 **메모리 Map**으로 유지(재시작 시 초기화 허용, 상태 파일 금지). 간격 내 재감지는 알림 채널 전송만 생략한다.
- 생략된 건수를 메모리에 누적해, 간격 경과 후 첫 알림 embed에 "이 알림 전 N건이 스로틀로 생략되었어요 (로그에는 모두 기록됨)"를 표기한다.
- **스로틀 대상은 안전 알림 채널 전송 하나뿐이다.** 로그 저장(`dmChatRepository`), DM 로그 채널 embed, 참여자 고정 안내 문구는 전량 유지 — 이 원칙이 코드 주석이 아니라 테스트(6절)로 증명되어야 한다.

## 2. 작업 B — `/운영현황` DM 대화 요약 (2-b)

- `src/deploy-commands.js`의 `/운영현황` 종류 choices에 `{ name: 'DM대화', value: 'dmChat' }` 추가. **command 스키마 변경이므로 merge 후 운영자가 `npm run deploy`를 직접 실행해야 한다 — PR 설명에 명시.**
- `src/handlers.js`에서 `dmChat` 분기 처리. 요약 수치는 `src/dmChatRepository.js`에 조회 함수를 추가해 계산한다 (KST 당일 기준, `minigameReport.js` embed 패턴 준수):
  - 오늘 대화한 사용자 수 (`role=user` 기준 distinct)
  - 오늘 user 메시지 수 / assistant 응답 수
  - 오늘 안전 감지 수 (input/output 구분 표기)
  - 오늘 오류 수 (`error` 필드 존재 레코드)
  - AI 호출 가시성: 당일 assistant 레코드 수를 "오늘 AI 응답 수"로 노출 — **별도 카운터 파일을 만들지 않고 기존 로그에서 파생**한다 (3-c 비용 가시성의 v1 구현으로 간주; 토큰 단위 집계는 범위 밖).
- example/demo 레코드와 `isExample` 데이터는 집계에서 제외한다.

## 3. 작업 C — `/admin` DM 로그 필터 (2-c)

- `/api/admin/dm-chat-logs`에 쿼리 지원: `userId`(완전 일치), `safetyOnly=true`(입력/출력 감지 레코드만), `limit`(기본 기존값, 최대 100 — 초과 값은 100으로 clamp).
- `public/admin/*`에 필터 UI(사용자 ID 입력, 안전 감지만 체크박스, 개수 선택). 프런트 빌드 없음 — 기존 정적 자산 패턴 유지.
- **읽기 전용 유지**: 새 쓰기 경로를 만들지 않는다. `safetyDetection`은 기존대로 category/severity만 노출하고 `matchedKeyword`는 절대 응답에 포함하지 않는다 (필터 응답 경로에서도 동일 — 테스트로 확인).

## 4. 작업 D — 대화 초기화 (3-a)

- 트리거: 참여자가 DM으로 정확히 "새로 시작"(공백 trim 후 비교)을 보내면 초기화로 처리한다. 새 Slash Command는 추가하지 않는다.
- 동작: `data/dm-chat-logs.local.json`에 사용자별 초기화 시각을 기록하고, `getDmChatReply`에 전달하는 history를 그 시각 이후 메시지로만 구성한다. **로그 원본은 삭제하지 않는다.**
- 스키마: 최상위에 `historyResets: [{ userId, resetAt }]`(사용자당 최신 1건 유지) 추가, `version` 2 → 3. `normalizeData`가 version 2 파일(키 없음)을 안전하게 읽어야 한다. example fixture·`validate:data`·문서를 같은 PR에서 갱신 (저장 데이터 shape 변경 규칙).
- 응답 문구: "좋아요, 새 마음으로 다시 시작해요. 편하게 말을 걸어 주세요." 계열의 차분한 존댓말. 초기화 트리거 메시지도 평소처럼 로그 저장·DM 로그 채널 전송한다(AI 호출은 하지 않음).
- "새로 시작"이 민감 감지에 걸리는 경우는 없지만, **감지 검사→초기화 판정 순서**로 두어 안전 경로가 항상 먼저 평가되게 한다.

## 5. 작업 순서 외 공통 원칙

- CommonJS + 새 npm dependency 금지, 저장은 repository 경유 + 원자 저장, 새 상태 파일 금지 (스로틀=메모리, 요약/비용=로그 파생, 초기화=기존 로그 파일 내 키 추가).
- 새 env는 기존 동작 유지가 기본 원칙이다. 예외적으로 안전 알림 스로틀은 운영 알림 피로를 줄이기 위해 `SAFETY_ALERT_THROTTLE_MINUTES=10`을 기본값으로 둔다. PR 설명에 이 예외와 근거를 명시하고, 기존처럼 전량 알림을 받는 `0` 해제 경로를 railway 가이드에 기록한다.
- 참여자 문구는 기존 README/docs 톤(차분·직접·비난 없음) 유지, 신규 카피 전체 목록을 완료 보고에 포함.

## 6. 테스트

- `scripts/test-dm-chat-flow.js` 확장: ① 스로틀 간격 내 2번째 감지에서 알림 미전송 + 로그 2건 저장 ② 간격 경과 후 알림 재개 + 생략 건수 표기 ③ `SAFETY_ALERT_THROTTLE_MINUTES=0`이면 전량 전송 ④ "새로 시작" 후 AI 입력 history에 이전 메시지 미포함 + 로그 원본 보존 ⑤ version 2 로그 파일 로드 회귀
- `scripts/test-admin-dashboard-flow.js` 확장: `userId`/`safetyOnly`/`limit`(101 → 100 clamp) 필터 검증 + 필터 응답에 `matchedKeyword` 부재 확인
- `scripts/test-operator-hub-flow.js`(또는 해당 운영현황 테스트) 확장: `dmChat` 요약 수치가 픽스처 로그 기준 실측과 일치
- 기존 케이스 전부 무수정 통과 + `npm run validate:data` + `npm run check:release`

## 7. 실서버 수동 확인 (PR 설명에 결과 기재)

1. 테스트 계정으로 민감 키워드 DM 2회 연속 → 알림 1회 + 로그 채널 embed 2회 + `/admin` 2건 표시
2. `/운영현황` 종류 "DM대화" → 수치가 `data/dm-chat-logs.local.json` 실측과 일치
3. `/admin` 필터 3종 동작, 쓰기 요청 경로 부재
4. DM "새로 시작" → 안내 응답, 이후 대화에서 이전 맥락 미참조, 로그 보존
5. `DM_CHAT_ENABLED=false` 회귀 (전 기능 침묵)

## 8. 커밋/완료 조건/롤백

- 권장 커밋 4: ① 스로틀+테스트 ② 운영현황 dmChat 요약+테스트 ③ admin 필터+테스트 ④ 대화 초기화(스키마 v3)+fixture+문서(이 계획서·mvp-plan 완료 표기, README, railway 가이드, operator-dashboard 가이드)
- 완료 조건: 0절 완성 정의 전부 + [dm-chat-mvp-plan.md](dm-chat-mvp-plan.md) 성공 기준 S4~S7·S9~S11 충족 + 신규 카피 목록 보고 + `npm run deploy` 필요 사실 PR 명시. PR 하나.
- 롤백: 스로틀·초기화는 env/트리거 단위 소규모 diff — PR revert 또는 `SAFETY_ALERT_THROTTLE_MINUTES=0`. 스키마 v3은 하위 호환 읽기라 revert 후에도 version 3 파일을 v1 코드가 읽지 못하는 문제가 없도록 `normalizeData`가 미지의 키를 무시하는지 revert 경로를 QA에 포함.
- Codex 지시서: `prompts/codex/dm-chat-ops-visibility-v1.md` 기준 구현 완료.

## 9. 범위 밖 (이번에 진행하지 않음 — 확정 배제 아님)

- **3-b 로그 보존/삭제 정책**: 보존 기간·고지 문구를 운영진이 확정하기 전 구현 보류가 공식 방침 ([next-work-roadmap-2026-07.md](next-work-roadmap-2026-07.md) 3절 결정 대기 항목).
- OpenAI 토큰/비용 단위 정밀 집계 (v1은 응답 수 파생 지표로 갈음), DM 로그 외부 저장소 이전, `/admin` 쓰기 기능, 음성/이미지 DM, 다국어 응답.
