# Codex 작업 지시서

## 작업 이름

참여자 DM 실운영 준비 v1 — 안전 확인 큐·자동 보존·비용 가시성·맞춤 연습

## 목표

이미 구현된 DM 대화 완성 운영판을 다시 만들지 않고, 실제 리디파인 참여자에게 단계적으로 열기 위한 운영 안전장치와 리허설 기준을 완성한다.

상세 범위와 완료 기준은 **`docs/dm-live-operation-readiness-v1-plan.md`가 기준 문서**다. 기존 DM의 확정 동작은 `docs/dm-chat-complete-plan.md`와 `docs/dm-chat-operation-guide.md`를 따른다.

## 절대 선행 조건

1. `production-data-safety-v1` 구현 PR이 `main`에 머지되어 있어야 한다.
2. `OPERATION_DATA_DIR`과 strict preflight를 포함한 최신 `main`에서 시작한다.
3. 선행 구현이 없으면 DM 코드를 수정하지 말고 `BLOCKED: production-data-safety-v1 미반영`으로 보고하고 종료한다.
4. 선행조건이 충족되면 `main`에서 `feat/dm-live-operation-readiness-v1` 브랜치를 생성한다.
5. `main` 직접 커밋 금지.

작업 시작 전 필독:

- `AGENTS.md`
- `src/AGENTS.md`
- `scripts/AGENTS.md`
- `data/AGENTS.md`
- `docs/AGENTS.md`
- `docs/dm-live-operation-readiness-v1-plan.md`
- `docs/dm-chat-complete-plan.md`
- `docs/dm-chat-mvp-plan.md`
- `docs/dm-chat-operation-guide.md`
- `docs/sensitive-question-alert-plan.md`
- `docs/incident-response-guide.md`
- `src/dmChat.js`
- `src/dmChatRepository.js`
- `src/dmChatLogging.js`
- `src/dmChatScenarios.js`
- `src/safety.js`
- `src/handlers.js`의 DM 운영현황 부분
- `src/adminApi.js`의 DM 읽기 API
- `scripts/cleanup-dm-chat-logs.js`

작업 시작 보고에 아래 출력 원문을 포함한다.

```bash
git branch --show-current
git log --oneline -5
git status --short
```

## 현재 구현 전제 — 다시 만들지 말 것

다음은 이미 구현되어 있으므로 회귀 테스트만 하고 중복 구조를 만들지 않는다.

- `DM_CHAT_ENABLED`·AI env 게이트
- OpenAI Responses API 호출과 30초 타임아웃
- 서버 멤버 제한과 비멤버 1회 안내
- 사용자별 일일 30회, 분당 5회 제한
- 사용자별 순차 처리
- 첫 DM 기록·운영진 열람·보존 안내
- 입력 민감 감지 시 AI 미호출·운영자 알림
- AI 출력 민감 감지 시 원문 차단
- 안전 알림 스로틀
- 2,000자 분할 전송과 타이핑 표시
- `새로 시작`, `연습 메뉴`, 6종 기본 시나리오, `오늘 연습 정리`
- 90일 로그·180일 안전 기록 정책
- 수동 cleanup dry-run/`--apply`/`--user`
- `/운영현황 종류:DM대화`, `/admin` 읽기 전용 DM 로그
- 자동 운영 백업의 DM 로그 포함

## 구현 원칙

1. DM은 대화·의사표현 연습 기능이다. 상담·진단·치료·위기 개입 기능처럼 표현하지 않는다.
2. 자동 안전 감지는 사람의 확인 신호이지 참여자 위험도 판정이 아니다.
3. 참여자를 점수화·등급화·낙인화하지 않는다.
4. 운영자가 AI인 척 대화에 몰래 개입하는 기능을 만들지 않는다.
5. `/admin`은 계속 읽기 전용이다.
6. `matchedKeyword`, 비밀값, raw authorization, 전체 DM 원문 묶음을 admin API나 참여자 응답에 노출하지 않는다.
7. 민감 감지 → 기록 → 운영 알림 흐름은 사용 제한·시나리오·자동 정리보다 우선한다.
8. `DM_CHAT_ENABLED=false`일 때 기존 비활성 동작이 유지되어야 한다.
9. 새 npm dependency 금지, CommonJS·Node 20 유지.
10. 실제 참여자 데이터·실제 민감 문장·실제 채널 ID를 fixture나 보고서에 넣지 않는다.

## 작업 A — 실계정 리허설 문서

코드 구현에 앞서 `docs/dm-chat-live-rehearsal-guide.md`를 작성한다.

필수 내용:

- 테스트 역할 5종: 참여자, 비멤버, DM 차단, 운영자, 안전 담당 운영자
- 계획서 2.2절의 15개 시나리오
- 기대 결과·실제 결과·통과/실패/확인 대기 기록 표
- 테스트 DM 원문을 GitHub에 복사하지 않는 원칙
- 모바일 Discord 확인 항목
- Railway 재배포 후 DM 로그 유지 확인
- `/운영현황`·`/admin` 수치 대조

실계정 QA를 실제로 수행할 권한·계정이 없으면 문서만 준비하고 전 항목을 `운영자 확인 대기`로 보고한다. 수행한 척 표시하지 않는다.

## 작업 B — 첫 안내 이해도 점검

기존 첫 안내문에 다음 내용이 이미 명확히 있는지 감사한다.

- AI와 대화한다는 점
- 기록과 운영진 열람
- 보존 기간과 삭제 요청
- 상담·긴급 대응 대체 아님
- 연습 명령 사용법

문구를 무조건 늘리지 않는다. 누락·오해 가능성이 실제로 있는 문장만 수정한다.

리허설 가이드에 4개 이해도 질문을 포함하고, 답변을 저장소에 기록할 때는 개인 식별 정보 없이 통과 여부와 개선 문장만 남긴다.

참여자 카피는 차분한 존댓말을 유지하고 “위험 사용자”, “문제 행동”, “감시” 같은 표현을 사용하지 않는다.

## 작업 C — 안전 알림 확인 큐

### C-1. 저장 구조

선행 작업의 공통 경로 resolver를 통해 `dm-safety-reviews.local.json`을 사용한다. 신규 repository는 DM 로그 원문을 복제하지 않고 참조 중심으로 저장한다.

권장 레코드:

```js
{
  id,
  sourceLogId,
  userId,
  direction: 'input' | 'output',
  status: 'pending' | 'reviewed' | 'followUp' | 'closed',
  detectedAt,
  reviewedAt,
  reviewedBy,
  note,
  updatedAt
}
```

요구사항:

- `sourceLogId` 기준 중복 생성 방지
- 로그 원문·matchedKeyword를 큐 파일에 복제하지 않음
- 상태 전환 이력 또는 최소 updated 정보 보존
- 허용 상태 외 값 거부
- 운영자 note는 길이 제한과 trim 적용
- example fallback 금지
- 자동 백업 manifest 포함

### C-2. 생성 시점

입력 또는 출력 안전 감지가 실제 DM 로그에 저장된 뒤 큐 레코드를 생성한다. 큐 저장 실패가 참여자 안전 안내와 원본 로그 저장을 되돌리면 안 되지만, 운영 채널에 고우선 오류를 남긴다.

### C-3. 운영자 처리 UI

기존 `/운영현황 종류:DM대화` 화면 또는 그 내부 버튼/선택 메뉴에서 처리한다.

- pending 건수와 최근 목록
- 상세 로그를 확인할 위치
- `확인`, `후속 필요`, `종료` 처리
- 운영자 권한 검사
- interaction customId에 사용자 원문이나 민감값 포함 금지
- 같은 건 동시 처리 시 최신 상태 확인 후 충돌 안내

가능하면 DM 큐 처리를 `handlers.js`에 직접 대량 추가하지 말고 신규 `dmSafetyReview.js`·payload/helper 모듈로 분리한다.

`/admin`에는 상태별 건수와 최소 목록만 읽기 전용으로 노출한다. 상태 변경 버튼은 만들지 않는다.

## 작업 D — 로그 보존 자동 정리

### D-1. 환경변수

```env
DM_CHAT_CLEANUP_AUTO_ENABLED=false
DM_CHAT_CLEANUP_WEEKDAY=sunday
DM_CHAT_CLEANUP_TIME_KST=04:00
```

- 기본 비활성
- 허용 요일은 영문 소문자 7종
- 시각 형식은 `HH:MM`
- 잘못된 값은 기본값 사용 + 경고

### D-2. 구현

- 기존 cleanup 스크립트의 순수 계산·적용 로직을 재사용 가능한 모듈로 추출한다.
- CLI의 dry-run/`--apply`/`--user` 동작은 유지한다.
- 봇 프로세스 스케줄러는 단일 인스턴스를 전제로 한다.
- 주간 중복 실행 방지 상태는 `dm-chat-cleanup-state.local.json`에 저장한다.
- 정리 전 백업 사본 생성이 실패하면 삭제하지 않는다.
- JSON 파싱 오류가 있으면 원본을 수정하지 않는다.
- `DM_CHAT_RETENTION_DAYS=0`이면 건너뛴다.
- 삭제 대상이 전체 메시지의 50%를 초과하면 자동 적용을 중단하고 운영자 확인을 요청한다.
- 수동 `--apply`는 기존처럼 운영자의 명시적 판단으로 실행할 수 있다.
- 성공/실패 알림에는 삭제 건수·기준일·실행 방식만 포함하고 사용자 목록·원문을 넣지 않는다.

자동 정리 상태와 안전 큐 파일은 선행 작업의 백업 manifest에 포함되도록 갱신한다.

## 작업 E — 비용·장애 가시성

`/운영현황 종류:DM대화`를 다음까지 확장한다.

- 오늘과 최근 7일 user/assistant 메시지 수
- 오늘과 최근 7일 input/output tokens
- AI 성공·오류·타임아웃 수
- 일일 제한·버스트 제한 도달 수
- pending/followUp 안전 확인 큐 수
- 마지막 자동 정리 성공/실패 시각

금액 자동 환산은 구현하지 않는다. 모델 단가는 변할 수 있으므로 토큰과 모델명만 운영자에게 보여준다. `/admin`에는 기존 개인정보 최소화 원칙을 유지하고 필요한 집계만 추가한다.

연속 장애 자동 차단은 이번 v1에서 새 circuit breaker까지 만들지 않고, 런북에 `DM_CHAT_ENABLED=false` 중단 기준과 권한자를 명시한다. 단, 로그 저장 실패 시 AI 호출을 계속하지 않는 기존/신규 안전 가드는 테스트한다.

## 작업 F — 리디파인 맞춤 연습 팩

기존 6종을 유지하고 다음 6종을 추가한다.

| ID 후보 | 사용자 표시명 | 핵심 지침 |
| --- | --- | --- |
| group-first-hello | 모임 첫날 인사 | 짧은 첫인사, 친밀감·연락처 강요 금지 |
| take-a-break | 오늘은 쉬고 싶다고 말하기 | 죄책감·참여 압박 없이 전달 연습 |
| late-or-absent | 지각·결석 알리기 | 자세한 사유를 강요하지 않는 운영진 역할 |
| decline-dm | DM 제안 거절하기 | 어떤 정중한 거절도 존중, 보복 전개 금지 |
| track-opinion | 경험트랙 의견 말하기 | 원하는 점·어려운 점 표현, 평가 금지 |
| ask-operator-help | 운영진에게 도움 요청하기 | 필요한 도움 구체화, 상담·의료 판단 금지 |

요구사항:

- 기존 `연습 메뉴`에서 기본/리디파인 맞춤 구분이 읽기 쉬워야 함
- 정확 일치 트리거와 기존 상태 저장 패턴 재사용
- 3~5턴 안에 자연스럽게 마무리 가능
- 점수·등급·잘못/정답 평가 금지
- 안전 감지·사용 제한·`새로 시작` 우선순위 유지
- 기존 6종 ID와 저장 데이터 하위 호환
- 실제 참여자 사연을 콘텐츠에 복사하지 않음

## 작업 G — 운영 문서

갱신/신규:

- 신규 `docs/dm-chat-live-rehearsal-guide.md`
- `docs/dm-chat-operation-guide.md`
- `docs/prelaunch-qa-checklist.md`
- `docs/railway-env-guide.md`
- `docs/incident-response-guide.md`
- `docs/dm-live-operation-readiness-v1-plan.md` 완료 상태
- `.env.example`
- `README.md` 필요한 최소 요약

런북에는 다음을 분명히 쓴다.

- 안전 큐 상태는 운영 처리 상태이며 참여자 상태 판정이 아님
- 운영자 연락 판단 기준과 내부 책임자
- 삭제 요청과 백업 사본 한계
- 자동 정리 성공/실패 확인
- OpenAI 오류·비용 급증·로그 저장 실패 시 DM 중단
- 운영 종료 시 최종 백업과 비활성화

외부 전문기관·긴급 연락처는 최신 공식 정보가 확정되지 않은 상태에서 임의로 하드코딩하지 않는다.

## 수정 가능 파일

핵심:

- `src/dmChat.js`
- `src/dmChatRepository.js`
- `src/dmChatLogging.js`
- `src/dmChatScenarios.js`
- 신규 `src/dmSafetyReview.js`
- 신규 자동 cleanup scheduler/helper
- `src/index.js` scheduler 배선
- `src/handlers.js` 최소 배선
- `src/components.js`, `src/embeds.js` 또는 신규 DM 운영 payload helper
- `src/adminApi.js`, `src/adminServer.js` 읽기 응답만
- `src/operationBackup.js` 신규 local 상태 파일 manifest 포함
- `scripts/cleanup-dm-chat-logs.js`
- 관련 DM·운영자·admin·백업 테스트
- `scripts/check-release.js`
- `.env.example`
- 위 작업 G 문서

필요 시:

- `src/operationDataPaths.js`: 신규 파일 경로 등록만
- `data/*.example.json`: 신규 스키마 테스트 fixture만

금지:

- `pointsRepository.js` 포인트 로직 변경
- 웹게임·던전월드 로직 변경
- `/admin` 쓰기 기능
- 실제 `.env`, `*.local.json`, DM 원문 커밋
- 새 npm dependency
- 음성·이미지 분석
- 참여자 위험 점수
- 운영자 실시간 대화 개입

## 작업 순서와 권장 커밋

1. `docs: DM 실운영 리허설 기준 추가`
2. `feat: DM 안전 알림 확인 큐 추가`
3. `feat: DM 로그 주간 자동 정리 추가`
4. `feat: DM 운영 비용·장애 가시성 보강`
5. `feat: 리디파인 맞춤 DM 연습 6종 추가`
6. `test: DM 안전 큐·자동 정리·맞춤 연습 검증`
7. `docs: DM 실운영 런북과 환경 설정 갱신`

커밋 수가 달라지면 논리적 이유를 보고한다.

## 자동 테스트 요구사항

1. sourceLogId 중복 큐 방지
2. 허용되지 않은 큐 상태 거부
3. 권한 없는 운영 처리 차단
4. pending→reviewed/followUp/closed 상태 전환
5. 동시 처리 충돌
6. admin API의 matchedKeyword·원문·민감값 비노출
7. 자동 cleanup 기본 비활성
8. 주간 중복 실행 방지
9. 파싱 실패·백업 실패 시 원본 무변경
10. 보존 0일 건너뜀
11. 자동 삭제 비율 50% 초과 차단
12. 수동 cleanup CLI 회귀
13. 최근 7일 토큰·오류·제한 통계
14. 맞춤 시나리오 6종 시작·진행·종료
15. 기존 시나리오와 v4 로그 하위 호환
16. 시나리오 중 안전 감지 우선
17. `DM_CHAT_ENABLED=false` 회귀
18. 자동 백업에 safety review·cleanup state 포함

실 OpenAI API와 실제 Discord 계정 없이 가짜 client·temp fixture로 검증한다.

## 필수 검증

```bash
node --check src/dmChat.js
node --check src/dmChatRepository.js
node --check src/dmSafetyReview.js
node scripts/test-dm-chat-flow.js
node scripts/test-dm-chat-retention.js
node scripts/test-operator-hub-flow.js
node scripts/test-admin-dashboard-flow.js
node scripts/test-operation-backup-flow.js
npm run validate:data
npm run test:questions
npm run check:release
git diff --check
git status --short
```

브라우저 또는 실계정 QA를 수행하지 못한 항목은 `확인 대기`로 보고한다. 테스트 문서만 작성하고 실제 통과처럼 표시하지 않는다.

## 완료 보고 형식

1. 브랜치와 커밋 목록
2. 선행 `production-data-safety-v1` 확인 근거
3. 계획서의 100% 필수/150% 콘텐츠 구현 구분
4. 안전 큐 스키마·상태 전환·중복 방지 결과
5. 자동 정리 env·중단 조건·수동 cleanup 회귀
6. 오늘/7일 비용·장애 가시성 결과
7. 신규 참여자 문구와 맞춤 시나리오 6종 요약
8. 무수정 통과/확장/신규 테스트 구분
9. 실계정·Railway 운영자 확인 대기 체크리스트
10. 계획서와 다르게 구현한 지점
11. 수정 허용 목록 밖 파일과 사유

## 게시 제한

- `git push`, PR 생성, 머지, Railway Variables 변경, 실제 DM 활성화 금지
- 로컬 브랜치 커밋까지만 수행
- Slash Command 스키마를 변경하지 않았다면 `npm run deploy` 불필요
- 실제 토큰·채널 ID·참여자 DM·민감 사연을 보고서에 포함하지 않음
