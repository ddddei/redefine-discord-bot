# 운영 자동화 안정성 보강 v1 작업 지시서

## 목표

`docs/ops-stability-hardening-v1-plan.md`에 따라 기존 운영 리마인더·주간 리포트·admin 수동 발송의 실패 처리와 회귀 검증을 강화한다.

## 구현 지시

1. `weeklyOpsReportScheduler`의 config·예약·완료 저장 실패를 안전한 결과 코드로 처리한다.
2. 전송 성공 후 완료 저장 실패는 중복 재전송하지 않도록 예약을 유지하고 `SENT_HISTORY_FAILED`로 반환한다.
3. start 즉시 실행·tick 중첩·새 모듈 로드 후 동일 이력 재예약 방지 테스트를 추가한다.
4. `/api/admin/weekly-report/send`를 기존 admin write 감사 로그·운영 알림 계약에 편입한다. 감사 로그에는 집계 숫자나 참여자 정보가 아니라 action/actor/result/errorCode만 남긴다.
5. 375px admin CSS와 민감정보 비노출 테스트를 보강한다.
6. 관련 문서·release gate를 현행화한다.

## 제약

- 새 env·Slash Command·데이터 스키마를 추가하지 않는다.
- 자동 재시도와 실패 이력 삭제 기능을 만들지 않는다.
- example, 사용자 ID/이름 목록, DM·인증 원문, attachment/url/note를 API·메시지·감사 로그에 넣지 않는다.
- 기존 CommonJS·원자 저장·Basic Auth·write token·no-store 계약을 유지한다.
- 커밋·푸시·PR·머지는 주 에이전트가 담당한다.

## 검증

- invalid config, reservation/finish JSON 오류, send 성공+finish 실패
- 동시 tick, 재시작을 모사한 동일 history 재호출
- 수동 발송 401/403/성공/중복과 admin audit
- 375px 정적 UI 계약, 민감정보 금지 문자열
- backup/restore/admin/ops reminder/weekly report 회귀, `git diff --check`, `npm run check:release`

