# Codex 작업 지시서

## 작업 이름

DM 대화 완성 운영판 v1 (접근 제어·견고성·보존 정책·연습 시나리오·운영 런북)

## 목표

DM 대화 연습 기능을 실참여자 상대로 즉시 운영 가능한 완성 상태로 끌어올린다. 작업 범위·세부 스펙·운영 결정값은 **`docs/dm-chat-complete-plan.md`가 기준 문서**다(운영 결정 3건은 2026-07-05 사용자 승인으로 확정: 보존 90일/안전 180일·멤버 제한 기본 켬·분당 5회). 이 지시서보다 상세하므로 반드시 먼저 정독한다. 충돌 시 계획서를 따르고 보고서에 충돌 지점을 남긴다.

## 선행 조건 (작업 전 확인 — 위반 시 작업 전체 무효)

1. `git log --oneline -3`으로 main 최신 확인 후, **반드시 `main`에서 새 브랜치 `feat/dm-chat-complete-v1`을 만들어 그 브랜치에서만 커밋한다. `main`에 직접 커밋하는 것은 금지이며, 보고서 1번 항목에 `git branch --show-current` 출력을 그대로 첨부한다.**
2. `docs/dm-chat-complete-plan.md`, `docs/dm-chat-mvp-plan.md`(현재 구현 상태·제약 8절), `src/dmChat.js`·`src/dmChatRepository.js`·`src/dmChatLogging.js`·`src/ai.js`를 먼저 읽는다.

## 참고 문서

- docs/dm-chat-complete-plan.md (기준 문서 — 0.1절 확정 결정값, 1~6절 작업 A~F, 8절 테스트)
- docs/dm-chat-mvp-plan.md (기존 확정 동작·성공 기준·제약 — 특히 8절 제약 조건은 이번 작업에도 전부 적용)
- docs/production-data-reset-guide.md (삭제 절차 연결 대상)
- AGENTS.md, src/AGENTS.md, scripts/AGENTS.md, data/AGENTS.md

## 현재 전제

- DM 대화는 v1+하드닝+운영 가시성까지 구현 완료: env 게이트, 첫 안내 1회(notices), 민감 감지 시 AI 미호출+알림, 일일 30회 제한, 출력 안전 검사, 알림 스로틀, `새로 시작` 초기화(historyResets), `/운영현황 종류:DM대화`, `/admin` 필터, 백업 포함. 로그 스키마 version 3.
- AI 호출은 `src/ai.js`의 `getDmChatReply`(openai Responses API, `max_output_tokens`)이며 타임아웃이 없다.
- 로그 저장은 `dmChatRepository.js`(원자 저장) 경유만 허용, `/admin`은 읽기 전용.

## 중요 구현 원칙

1. **안전 흐름 후퇴 금지가 최우선이다.** "민감 감지 시 AI 미호출 + 운영진 알림 + 기록"은 멤버 제한·분당 제한·순차 처리·시나리오 등 이번의 어떤 게이트보다 우선한다. 각 신규 게이트마다 "민감 메시지는 여전히 알림된다"를 테스트로 증명한다. 단 하나의 예외: 비멤버(작업 A-1)는 참여자가 아니므로 감지·알림 대상이 아니다(계획서 1.1).
2. **기존 사용자 차단 사고 방지.** 멤버 확인 API 오류는 허용 쪽 폴백 + 콘솔 경고. `DM_CHAT_MEMBER_ONLY=false`·`DM_CHAT_BURST_LIMIT_PER_MINUTE=0`·`DM_CHAT_RETENTION_DAYS=0`으로 각 기능을 개별 해제할 수 있어야 한다.
3. **스키마 version 4 하위 호환.** v2·v3 파일을 관용 로드(normalizeData)하고, 구코드가 v4 파일을 읽어도 크래시 없어야 한다(신규 필드 무시 수준 확인). 스키마 변경·example 픽스처·validate/스모크·문서를 같은 PR에서 갱신(CLAUDE.md 규칙).
4. **삭제 스크립트는 파괴적 작업이다.** 기본 dry-run, `--apply` 없이는 어떤 쓰기도 하지 않는다. `--apply` 시 정리 전 로컬 백업 사본 생성(계획서 3.1). 로그 파일 직접 편집 유도 금지 — 모든 정리는 스크립트 경유.
5. **개인정보 원칙 유지**: `matchedKeyword`·토큰 원문·채널 ID를 대시보드·리포트·문서에 노출하지 않는다. `/admin`에 토큰 사용량을 노출하지 않는다(운영 요약만). 시나리오·리캡 프롬프트에 "평가·점수·등급 표현 금지"를 포함한다(계획서 5.2).
6. 참여자 카피는 차분한 존댓말, 독촉·비난 없음. 신규 카피(비멤버 안내·분당 안내·notice v2·시나리오 6종 전체 문구·리캡)를 보고서에 전량 첨부한다.
7. CommonJS, 신규 npm 의존성 금지, 저장은 repository 경유, `/admin` 읽기 전용 유지, `pointsRepository.js` 무접촉.
8. **slash command 스키마 무변경**(deploy 불필요) — `/운영현황`의 기존 `DM대화` choice 내부 응답만 확장한다.
9. **git push, PR 생성, `npm run deploy`, `.env` 수정 금지. 로컬 커밋까지만.** (`.env.example`은 수정 대상)

## 수정 가능 파일

- src/dmChat.js, src/dmChatRepository.js, src/dmChatLogging.js, src/ai.js (타임아웃·usage 반환만)
- src/dmChatScenarios.js (신규 — 시나리오 콘텐츠 상수)
- src/handlers.js (`/운영현황` DM 요약 토큰 줄 — 위임 패턴 유지), src/embeds.js (필요 시 요약 embed만)
- scripts/cleanup-dm-chat-logs.js (신규), scripts/test-dm-chat-retention.js (신규)
- scripts/test-dm-chat-flow.js, scripts/test-operator-hub-flow.js (확장), scripts/check-release.js (등록만)
- data/dm-chat-logs.example.json (스키마 v4 반영 — 존재한다면), scripts/validate-data.js (해당 스키마를 검증하고 있다면)
- .env.example (신규 3종), docs/railway-env-guide.md
- docs/dm-chat-operation-guide.md (신규 런북 — 계획서 6절 목차 그대로), docs/dm-chat-mvp-plan.md (3-b 구현 완료 표기·env 표 갱신), docs/dm-chat-complete-plan.md (완료 표기), docs/production-data-reset-guide.md (삭제 절차 연결), README.md (DM 절 한 단락)

위 목록 밖 파일 수정이 필요하면 사유를 보고서에 요약한다.

## 작업 순서 (계획서 1~6절 = A~F, 커밋 7개)

1. A — 멤버 확인(길드 캐시→fetch, 10분 인메모리 캐시, 비멤버 1회 안내 후 침묵, 오류 시 허용 폴백)·분당 버스트 5회(안내는 1분 1회)·사용자별 순차 처리(promise 체인)·openai 30초 타임아웃
2. B — 2,000자 문장 경계 분할(최대 2조각)·sendTyping(실패 무시)·전역 AI 오류 10분 5회 경고(스로틀 1회)
3. C — 스키마 v4(noticeVersion·activeScenarios)·cleanup 스크립트(dry-run 기본·`--apply`·`--user`·안전 레코드 180일·notices/historyResets 보존 규칙·백업 사본)·FIRST_NOTICE v2(보존 기간 env 렌더·기존 사용자 재고지 1회)
4. D — assistant 레코드 `tokens: { input, output }`(usage 없으면 null)·`/운영현황` 토큰 줄
5. E — dmChatScenarios.js 6종(계획서 5.1 표의 지침 요지를 시나리오별 프롬프트로 구체화)·트리거(`연습 메뉴`/`연습: <이름>`/`연습 끝`)·상태 저장·`오늘 연습 정리`·FIRST_NOTICE 사용법 줄
6. 테스트 — test-dm-chat-flow 확장(계획서 8절 케이스 전부: 비멤버·폴백·분당·순차·분할·재고지 1회·시나리오·시나리오 중 민감 감지 우선)·test-dm-chat-retention 신규·operator-hub 토큰 검증·v2/v3 파일 관용 로드·check-release 등록
7. 문서 — 런북 신규·mvp-plan 상태 갱신·env 2종 문서·README·계획서 완료 표기

## 검증 (필수)

```bash
npm run check:release                       # 전체 게이트 (신규·확장 테스트 포함)
node scripts/test-dm-chat-flow.js           # 단독 성공 한 줄
node scripts/test-dm-chat-retention.js
node scripts/test-operator-hub-flow.js
node scripts/test-admin-dashboard-flow.js   # 무수정 통과 (admin 회귀 없음 증명)
node scripts/test-operation-backup-flow.js  # 무수정 통과 (백업 회귀 없음 증명)
node scripts/cleanup-dm-chat-logs.js        # dry-run이 기본이고 아무것도 바꾸지 않는지 직접 확인
```

- 타임아웃·usage는 가짜 openai 클라이언트 주입으로 검증(실 API 호출 금지 — `AI_PROVIDER=mock` 또는 주입 클라이언트만 사용).
- Discord 실계정이 필요한 항목(실제 DM 왕복, 멤버/비멤버 계정, 알림 채널 수신)은 수행 불가 — 계획서 9절 QA 목록을 보고서에 "운영자 확인 대기" 체크리스트로 옮겨 적는다. 통과한 척 보고하지 않는다.

## 보고 형식

1. **`git branch --show-current` 출력 원문** + 커밋 해시 7개와 각 내용 (main 직접 커밋이 아님을 증명)
2. `check:release` 결과, 무수정 통과 테스트(admin·백업) / 확장 테스트 구분 목록
3. 신규 참여자 카피 전량 (비멤버·분당·notice v2·시나리오 6종 문구·리캡)
4. cleanup 스크립트 dry-run 출력 예시 (기준일·대상 수 요약 형태)
5. 스키마 v4 변경 요약과 v2/v3 관용 로드 확인 결과
6. 계획서 대비 다르게 구현했거나 해석이 필요했던 지점
7. 운영자 확인 대기 체크리스트 (실계정 QA)
8. 수정 가능 파일 목록 밖을 건드렸다면 그 사유
