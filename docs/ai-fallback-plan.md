# /질문 AI 폴백 실구현 계획 (D-3)

이 문서는 로드맵 D-3 "AI 폴백"의 구현 계획입니다. **이 문서만 보고 다른 컨텍스트 없이 구현을 시작할 수 있도록** 현행 흐름, 함수 시그니처, 안전 게이트, 테스트까지 명시합니다. 구현 전 [AGENTS.md](../AGENTS.md), [src/AGENTS.md](../src/AGENTS.md), [scripts/AGENTS.md](../scripts/AGENTS.md)를 읽습니다.

> **구현 주체가 외부 AI(GPT/Codex)인 경우 9절 "작업 규율"이 계획 내용과 동급의 준수 사항입니다.**

## 0. 착수 게이트

- 독립 작업 — 선행 PR 없음. 단, **D-2(handlers 분할)와 동시 진행 금지**: 둘 다 `handleQuestionCommand`를 만진다. 먼저 착수하는 쪽이 끝난 뒤 다른 쪽을 시작한다.
- OpenAI 실호출 QA에는 운영자의 `OPENAI_API_KEY`가 필요 — 없으면 해당 항목은 "확인 대기"로 보고(6절).

## 1. 현행 상태 (2026-07-11 실측)

`/질문` 처리(`src/handlers.js`의 `handleQuestionCommand`)는 이미 4단 폴백 구조이고, AI 단계만 스텁입니다:

```
1. detectSensitiveQuestion(question)  → 감지 시: 안전 안내 reply + sendSensitiveQuestionAlert. 종료
2. findFaqAnswer(question)            → 매치 시: FAQ 답변 reply. 종료
3. findKnowledgeAnswer(question)      → 매치 시: 지식 embed reply. 종료
4. getAiFallbackAnswer(question)      → 값이 있으면: "운영진 확인이 필요한 질문이에요" embed(ephemeral)
                                         + recordFaqFallbackCandidate + sendUnansweredQuestionLog. 종료
5. (4가 null이면) 정적 안내 embed + recordFaqFallbackQuestion + sendUnansweredQuestionLog
```

- `getAiFallbackAnswer`(`src/ai.js:248`)는 **동기 함수이며 `AI_PROVIDER=mock`일 때만** 고정 문구를 반환. `openai` provider는 지원하지 않음(항상 null → 5단계로 떨어짐).
- `src/ai.js`에는 DM 대화용 실호출 인프라가 이미 완비: `getOpenAiClient()`, `getConfiguredMaxOutputTokens()`, `hasSensitiveKeyword()`, AbortController 타임아웃 패턴(`getDmChatReply`), 테스트용 `options.openaiClient` 주입.
- 출력 안전 패턴 선례(`src/dmChat.js:528`): AI 출력에 `detectSensitiveQuestion`을 다시 돌려 감지 시 안전 폴백 문구로 대체.
- env(`.env.example:94-99`): `AI_ENABLED`, `AI_PROVIDER`(none|mock|openai), `AI_MODEL`, `AI_MAX_TOKENS`, `AI_LOG_ENABLED`, `OPENAI_API_KEY`.

## 2. 목표와 범위

- 목표: `AI_PROVIDER=openai`에서 `/질문`이 FAQ·지식창고 매칭에 실패했을 때, **등록된 FAQ/지식 근거 안에서만** 짧은 보조 답변을 생성해 준다. 근거가 없으면 지어내지 않고 운영진 확인 안내로 남는다.
- 범위 제외: DM 대화(`dmChat.js`) 변경, FAQ/지식 데이터 수정, 벡터 검색(RAG — [api-rag-plan.md](api-rag-plan.md) 별도), `/질문` 외 다른 명령의 AI 적용, 운영현황 AI 사용량 리포트(v2 후보).

## 3. 설계

### 3-1. 핵심 원칙 — 금기와의 결합

저장소 금기 "미확정 운영 정책을 FAQ/지식에 하드코딩하지 않는다 — 불확실성은 운영자에게 라우팅"이 이 기능의 설계 축입니다:

1. **폐쇄 근거(closed-book 금지, grounded-only)**: 프롬프트에 FAQ/지식 상위 후보를 근거로 주입하고, "근거에 없는 내용은 답하지 말고 운영진 확인을 안내하라"를 시스템 지시로 강제.
2. **AI 답변임을 항상 표기**: 현행 4단계의 embed 제목("운영진 확인이 필요한 질문이에요")과 `OPERATOR_CHECK_FOOTER`를 유지하고, 본문 끝에 고정 문구 `이 답변은 AI가 등록된 안내를 바탕으로 정리한 참고용이에요. 정확한 내용은 운영진이 확인 후 안내드려요.` 추가.
3. **운영 가시성 유지**: AI가 답해도 `recordFaqFallbackCandidate` + `sendUnansweredQuestionLog`는 현행대로 호출 — 운영자가 FAQ 승격 여부를 계속 판단할 수 있어야 함.

### 3-2. 안전 게이트 (총 4겹, 순서 고정)

| 겹 | 위치 | 동작 |
|---|---|---|
| 입력 1 | `handleQuestionCommand` 1단계 (기존) | `detectSensitiveQuestion` 감지 시 AI 경로에 진입 자체를 안 함 |
| 입력 2 | `ai.js` (기존 `hasSensitiveKeyword`) | 민감 키워드 포함 질문은 null 반환 |
| 출력 1 | `ai.js` 신규 | AI 응답 텍스트에 `detectSensitiveQuestion(text)` — 감지 시 응답 폐기(null 반환) → 5단계 정적 안내로 폴백 (dmChat.js:528 패턴 재사용) |
| 출력 2 | `ai.js` 신규 | 응답 길이 상한(1,000자) 초과 시 폐기(null) — 프롬프트 이탈 신호로 간주 |

### 3-3. 근거 후보 조회 — `src/search.js`에 신규 함수

```js
// 기존 scoreFaqItem / scoreKnowledgeItem을 재사용해, 단독 답변 임계값에는 못 미치지만
// 근거로 쓸 만한 상위 후보를 돌려준다. 기존 findFaqAnswer/findKnowledgeAnswer는 무변경.
listAnswerCandidates(userQuestion, { limit = 3 } = {})
// → [{ source: 'faq'|'knowledge', title, body, score }] score 내림차순, 최소 점수 미달 항목 제외
```

- 최소 점수는 기존 `findFaqAnswer`의 채택 임계값보다 낮게(구현 시 기존 임계값 상수를 확인해 그 50~70% 수준으로 정하고, 5절 테스트로 고정). **후보가 0건이면 AI를 호출하지 않고 null** — 근거 없는 생성 원천 차단이자 비용 절약.

### 3-4. `src/ai.js` — `getAiFallbackAnswer` 재구현 (async 전환)

```js
async function getAiFallbackAnswer(question, options = {}) → string | null
```

- 게이트(순서대로, 하나라도 걸리면 null): 빈 질문 / `AI_ENABLED !== 'true'` / `hasSensitiveKeyword` / provider가 mock·openai 외.
- `mock`: **현행 고정 문구 동일 반환** (기존 테스트·QA 호환 — async여도 반환값 동일).
- `openai`: `AI_MODEL`·클라이언트 없으면 null. `client.responses.create`에 아래 입력, `max_output_tokens`는 기존 `getConfiguredMaxOutputTokens()`, 타임아웃은 신규 `AI_QUESTION_TIMEOUT_MS`(기본 8000ms, `getDmChatTimeoutMs` 패턴 복제 — DM용 env를 재사용하지 않음: 용도가 다르고 독립 조정 필요).
- 시스템 지시(신규 상수 `QUESTION_FALLBACK_INSTRUCTIONS`):
  - 프로젝트 리디파인 참여자 질문에 답하는 보조 안내자다.
  - **아래 '등록된 안내' 안의 내용만 근거로** 답한다. 근거에 없으면 반드시 "등록된 안내에서 찾지 못했다"고 말하고 운영진 확인을 안내한다.
  - 일정·정책·금액·장소는 근거에 명시된 경우에만 언급한다. 추측·일반 상식으로 채우지 않는다.
  - 차분하고 직접적인 한국어, 2~5문장.
- 사용자 입력: 질문 + `listAnswerCandidates` 결과를 `[등록된 안내 1] 제목: … 내용: …` 형식으로 주입(후보 본문은 항목당 500자로 절단).
- 응답 후처리: trim → 출력 게이트 2겹(3-2) → 통과 시 3-1의 AI 표기 문구를 붙여 반환.
- 오류·타임아웃: catch 후 null 반환(콘솔 warn 1줄) — **어떤 경우에도 throw로 명령을 죽이지 않는다.**

### 3-5. `handleQuestionCommand` 변경 (src/handlers.js — 최소 diff)

- 4단계를 `await getAiFallbackAnswer(question)`으로 변경.
- **Discord 3초 응답 제한 대응**: AI 경로 진입 직전(1~3단계 모두 불발 + `AI_ENABLED==='true'` + provider가 mock/openai)에만 `await interaction.deferReply({ ephemeral: true })` 후 결과를 `editReply`로. AI 비활성(현행 기본값) 경로는 defer 없이 기존 `reply` 그대로 — **AI_ENABLED=false에서 현행과 바이트 동일 동작**이 회귀 기준.
- defer 이후 AI가 null이면 5단계 정적 안내를 `editReply`로 보낸다(내용 동일).

### 3-6. env·문서

- `.env.example`: `AI_QUESTION_TIMEOUT_MS=` 추가(주석: /질문 AI 폴백 타임아웃, 기본 8000). `AI_PROVIDER` 주석에 openai가 /질문 폴백에도 적용됨을 명시.
- [railway-env-guide.md](railway-env-guide.md): AI 폴백 활성 조건(AI_ENABLED + AI_PROVIDER=openai + AI_MODEL + OPENAI_API_KEY) 1절 추가.
- [operation-guide.md](operation-guide.md) 또는 [operator-command-guide.md](operator-command-guide.md)의 `/질문` 설명에 AI 보조 답변 표기·한계 문단 추가.

## 4. 수정 대상 파일 (이 목록 밖 수정 금지)

| 파일 | 변경 내용 |
|---|---|
| `src/search.js` | `listAnswerCandidates` 신설 + export. 기존 함수 무변경 |
| `src/ai.js` | `getAiFallbackAnswer` async 재구현(3-4), `QUESTION_FALLBACK_INSTRUCTIONS`·타임아웃 헬퍼 추가. DM 대화 함수들 무변경 |
| `src/handlers.js` | `handleQuestionCommand` 4단계 await + defer/editReply 분기(3-5)만 |
| `scripts/test-ai-fallback.js` **(신규)** | 5절 |
| `scripts/test-questions.js` | **무변경** (기존 FAQ 매칭 QA가 회귀 가드) |
| `scripts/check-release.js` | 신규 테스트 문법 검사 + 스모크 등록 |
| `.env.example`, `docs/railway-env-guide.md`, 운영 문서 1곳 | 3-6 |

**건드리지 않는 것**: `deploy-commands.js`(명령 스키마 무변경 → `npm run deploy` 불필요), `safety.js`, `dmChat.js`, FAQ/지식 데이터, 민감 질문 알림 흐름(`sendSensitiveQuestionAlert`).

## 5. 테스트 방법

`scripts/test-ai-fallback.js` (신규, `assert`, `options.openaiClient` mock 주입 — `test-dm-chat-flow.js`의 모의 클라이언트 패턴 참고, 마지막에 성공 1줄 출력):

1. `AI_ENABLED=false` → null (호출 0회)
2. `AI_ENABLED=true, AI_PROVIDER=mock` → 현행 고정 문구 그대로 (회귀)
3. `openai` + 모의 클라이언트: 정상 응답 → AI 표기 문구가 끝에 붙는지, 근거 후보가 프롬프트 입력에 포함되는지(모의 클라이언트가 받은 input 검증)
4. 민감 키워드 질문 → 호출 없이 null / **출력에 민감 표현** 반환하는 모의 응답 → null (출력 게이트)
5. 1,000자 초과 모의 응답 → null
6. 모의 클라이언트 throw / 타임아웃(abort) → null (명령 생존)
7. `listAnswerCandidates`: 임계값 이상 후보 정렬·limit, 후보 0건이면 AI 미호출(모의 클라이언트 호출 카운트 0)
8. `handleQuestionCommand` 통합(핸들러 mock interaction — `test-minigame-hub-flow.js` 패턴): ⓐ AI_ENABLED=false에서 현행 정적 안내와 동일 reply(defer 미발생) ⓑ mock provider에서 deferReply → editReply 순서, `recordFaqFallbackCandidate`·`sendUnansweredQuestionLog` 호출 유지 ⓒ FAQ 매치 질문은 AI 미호출

회귀: `npm run test:questions` 무수정 통과, `npm run check:release` 전체 통과.

수동 검증(선택, OPENAI_API_KEY 보유 시): 테스트 서버에서 `AI_PROVIDER=openai`로 ⓐ FAQ 언저리 질문(근거 있음) ⓑ 완전 무관 질문(근거 0건 → AI 미호출·정적 안내) ⓒ 민감 질문(1단계 차단) 각 1회.

## 6. 롤백 방법

- `git revert` 한 번. env는 `AI_ENABLED=false`(기본값)로 두면 코드 롤백 없이도 **기능이 완전히 꺼진 현행 동작**이므로, 운영 중 문제 시 1차 대응은 env 끄기 → 2차가 revert. deploy 불필요.

## 7. 운영 결정 칸 (구현과 병행 가능 — 배포 활성화 전 확정)

- **결정 칸 A — 활성화 시점**: 구현 머지 ≠ 활성화. Railway에 `AI_ENABLED=true` + `AI_PROVIDER=openai`를 켜는 시점은 운영 판단: `[ ]` 머지 직후 / `[ ]` 테스트 서버 1주 관찰 후 — 결정일: ______
- **결정 칸 B — 모델·예산**: `AI_MODEL` 값과 월 비용 상한(질문량 예측 기준). 기본 제안: 소형 모델 + `AI_MAX_TOKENS=500` 유지 — 결정일: ______

## 8. 주의사항

- **이 기능의 실패 모드는 "AI가 그럴듯한 오답을 확신 있게 말하는 것"** — 리뷰는 3-2 게이트 4겹과 3-4 시스템 지시의 근거 강제, 후보 0건 시 미호출을 최우선 검증.
- AI 응답 문구도 참여자 카피 규칙(차분·직접·존댓말)을 따른다 — 시스템 지시가 강제하지만, mock·표기 문구 등 고정 문자열은 기존 문서 톤과 대조.
- `handleQuestionCommand` diff는 최소로 — D-2 분할이 이 함수를 곧 이동하므로 여기서 구조를 바꾸지 않는다.

## 9. 작업 규율 (구현 주체가 외부 AI인 경우 필수)

- **브랜치 필수**: `feat/ai-question-fallback`. **main 직접 커밋 절대 금지.**
- **로컬 커밋까지만**: push·PR 생성·`npm run deploy` 금지. **재위임 금지.**
- 4절 파일 목록 밖 수정 금지. 실 OpenAI 호출을 테스트에 넣지 않는다(모의 클라이언트만).
- 커밋 한국어, CommonJS·2-스페이스·세미콜론·작은따옴표. 이 계획서를 브랜치에 함께 커밋.
- 보고 형식: 브랜치명, 커밋 목록, check:release 결과, 테스트 커버 목록(5절 1~8 대조), 확인 대기 항목(실 API QA 등).
