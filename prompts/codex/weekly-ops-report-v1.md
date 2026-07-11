# 주간 운영 리포트 v1 작업 지시서

## 목표

`docs/weekly-ops-report-v1-plan.md` 계약에 따라 개인정보를 최소화한 주간 운영 리포트를 집계하고 운영 콘솔과 운영진 Discord 채널에서 사용할 수 있게 한다.

## 구현 범위

1. 별도 순수 모듈에서 KST 주간 범위와 운영 집계를 생성한다.
2. admin server에 Basic Auth·no-store가 적용되는 읽기 전용 API를 추가한다.
3. admin 정적 UI에 자동 초기 조회 없이 주간 리포트 카드와 이전 주 선택을 추가한다.
4. Discord 메시지 포매터, 수동 실행 함수, 기본 off 주간 스케줄러와 주차별 원자 이력을 구현한다.
5. 이력 경로를 `operationDataPaths`, preflight, backup manifest에 포함한다.
6. `.env.example`, 운영 가이드, QA 체크리스트, 로드맵, release gate를 현행화한다.

## 허용 파일

- `src/weeklyOpsReport.js`, `src/weeklyOpsReportScheduler.js` 신규
- `src/adminServer.js`, `src/index.js`, `src/operationDataPaths.js`, 백업 관련 최소 파일
- `public/admin/*`
- `.env.example`
- `scripts/test-weekly-ops-report-flow.js`와 관련 회귀 테스트·release gate
- 관련 `docs/`, `prompts/` 인덱스

## 필수 제약

- CommonJS, 2칸 들여쓰기, plain Node `assert` 테스트를 유지한다.
- example 데이터와 참여자 ID/이름 목록, DM·인증 원문, 첨부·URL, 메모를 리포트에 넣지 않는다.
- 조회 API와 콘솔 조회는 어떤 운영 파일도 변경하지 않는다.
- 자동 발송은 `WEEKLY_OPS_REPORT_ENABLED=true`가 아니면 시작하지 않는다.
- Discord 발송은 운영 채널만 사용하고 `allowedMentions: { parse: [] }`를 지정한다.
- 기존 `opsDelayPolicy`, JSON 원자 저장, 공통 운영 데이터 경로를 재사용한다.
- Slash Command·데이터 스키마·참여자 기능은 변경하지 않는다.

## 검증

- KST 월요일 경계, `weekOffset`, 상태별 집계, 양수·음수 포인트 합계
- example 제외와 금지 문자열/민감 필드 비노출
- Basic Auth, no-store, 잘못된 offset 400
- 조회 전후 운영 파일 checksum·mtime 불변
- 주차 중복 발송 방지, 채널 누락·전송 실패·성공 이력
- 백업 포함, 기존 admin/ops reminder 회귀, `git diff --check`, `npm run check:release`

## 완료 기준

계획서 상태와 로드맵을 코드·자동 검증 완료/실환경 QA 대기로 변경하고, 작업 범위 밖 변경 없이 검수 가능한 상태로 넘긴다. 커밋·푸시·PR·머지는 주 에이전트가 담당한다.

