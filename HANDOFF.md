# 리디파인 디스코드 봇 — 작업 인수인계

작성일: 2026-07-12. 아키텍처·규칙 지식은 이 문서가 아니라 **[CLAUDE.md](CLAUDE.md)와 5개 AGENTS.md가 원천**이다 (루트/src/data/scripts/docs). 이 문서는 그 위에 얹는 "현재 상태·결정·미결"만 담는다.

## 목표

프로젝트 리디파인 운영용 디스코드 봇 — 참여자 안내·FAQ/지식 검색·리디파인 포인트·미션 승인·상점/교환·운영 콘솔(`/admin`)·미니게임·DM 챗. 로컬 JSON 상태의 MVP, Railway 배포 대상. **핵심 기능은 운영 투입 가능 수준으로 완성**(PR #85까지), 현재는 실운영 준비·고도화 단계다.

## 확정된 결정사항 (+ 상태 갱신 주의)

- CommonJS·무번들러·plain Node 스모크 테스트. 게이트는 `npm run check:release` (전 구문검사+스모크). 상세 관례는 CLAUDE.md.
- 포인트/교환/미션 상태 변경은 `src/pointsRepository.js` 단일 경로 — 우회 금지 (CLAUDE.md 안티패턴 절).
- **D-2 완료**: `src/handlers.js`는 68줄 라우터/재수출로 축소, 도메인 모듈 분할 끝 (PR #78).
- **D-3 완료**: `/질문` AI 폴백 구현됨 — `src/ai.js`의 `getAiFallbackAnswer`를 `participantHandlers.js`가 사용. ai.js는 DM 챗 AI와 공용.
- **주의 — 낡은 맥락 함정**: `docs/handlers-split-plan.md`(D-2)·`docs/ai-fallback-plan.md`(D-3)가 **미커밋 상태로 남아 있지만, 두 작업 모두 이미 실행 완료됐다.** "승인 대기 중" 문구를 믿고 착수하지 말 것. 문서 처리 방침은 미결 ①.
- 운영 콘솔은 읽기 전용 MVP에서 **Phase 1 쓰기 기능 도입으로 스코프 확장됨** (PR #79~82: 웹게임 처리·주간 지급·참여자 카드).
- 저장소 자체 워크플로 스킬 4종 존재 (`6bcb9a0` 커밋) — 작업 시 이 관례 우선.

## 미결 사항 (다음 세션이 사용자에게 물어야 할 것)

1. 미커밋 계획서 2종 처리: 완료 기록으로 커밋할지, 삭제할지 (내용은 이미 구현과 일치 여부 재확인 필요).
2. D-3의 OpenAI **실호출 QA** 수행 여부 — 계획서 6절 기준, `OPENAI_API_KEY` 필요. 미수행이면 "확인 대기"일 수 있음.
3. 신규 슬래시 명령의 `npm run deploy` 반영 여부 (deploy는 커밋과 별개 수동 단계 — 어느 시점까지 반영됐는지 사용자만 안다).
4. Railway 실배포 상태 (로컬 완성 ≠ 운영 반영).

## 지금까지 확인된 사실 (재조사 불필요)

- 테스트 방식: Jest 없음. `scripts/test-*.js`를 node로 직접 실행, 통합은 `check:release`.
- 슬래시 명령 스키마는 `src/deploy-commands.js`, 변경 시 `npm run deploy` 필수 (빌드 아님).
- 관리자 대시보드는 example/demo 레코드를 실데이터로 노출하면 안 됨 (CLAUDE.md).
- 디렉터리별 세부 지식은 해당 AGENTS.md를 먼저 읽는 것이 규칙.

## 환경별 제약

- `.env`, 운영 Discord ID, 참여자 데이터, `data/*.local.json` — **절대 커밋 금지**.
- 봇 실기동·Discord 실계정 확인은 토큰/서버 접근이 있는 환경에서만. 코드·스모크 테스트는 어디서나 (`npm ci && npm run check:release`).
- OpenAI 실호출 QA는 `OPENAI_API_KEY` 보유 환경에서만.

## 다음 단계

0. 환경: `npm ci` → `npm run check:release`로 기준선 green 확인.
1. `git status`로 미커밋 계획서 2종이 그대로인지 확인 → 미결 ① 사용자 확인.
2. 미결 ②~④ 확인 후, 저장소 스킬 관례로 다음 작업 착수.

## 입력 파일 목록

- `data/*.example.json` — 데이터 형태 픽스처 (실데이터 아님)
- `.env.example` — 필요한 환경변수 목록
- `docs/` — 운영 런북·QA·릴리스 문서 (docs/AGENTS.md가 색인)
- `prompts/codex/` — 재사용 작업 프롬프트 (런타임 코드 아님)
