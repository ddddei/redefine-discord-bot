# 운영 지연 감지·리마인더 v1 계획서

**상태: 코드·자동 검증 완료, 실환경 QA 대기 (2026-07-11, PR #80 이후)**

## 1. 목적

운영 콘솔 Phase 1·2로 처리 경로는 갖춰졌지만, 운영자가 콘솔을 열지 않은 날의 오래된 교환·인증과 마감 임박 미션은 여전히 놓칠 수 있다. Phase 3는 상태를 대신 처리하지 않고, 지연 신호를 한 곳에서 계산해 콘솔과 Discord 운영 채널에 조용히 알려준다.

## 2. 범위

### 포함

- 교환·인증·반응 후속 확인의 대기 시간과 overdue 판정
- active 미션의 마감 임박·경과 상태
- `/admin` 지연·마감 배지
- KST 슬롯별 Discord 운영 채널 집계 알림
- 재시작 중복 방지를 위한 원자 발송 이력
- 이력의 공통 운영 데이터 경로·백업 포함

### 제외

- 참여자 DM·공개 채널 독려
- 자동 승인·취소·미션 종료·포인트 지급
- 주간 운영 리포트와 AI 요약
- 다중 인스턴스 분산 잠금
- Slash Command 변경

## 3. 설계 결정

### 공통 지연 정책

서버와 브라우저가 각자 시간을 계산하면 임계값 경계에서 결과가 달라진다. `opsDelayPolicy`의 순수 helper를 admin API와 리마인더가 함께 사용한다. 프런트는 서버가 준 `waitingHours`, `overdue`, `deadlineStatus`만 표시한다.

### at-most-once 슬롯

Discord 전송과 로컬 JSON을 하나의 원자 transaction으로 묶을 수 없어 완전한 exactly-once는 불가능하다. v1은 중복 알림 방지를 우선해 전송 전에 슬롯을 예약한다. 예약 직후 프로세스가 종료되면 해당 알림을 잃을 수 있지만 같은 슬롯을 두 번 보내지는 않는다. 실패·빈 요약도 상태로 남겨 같은 슬롯을 반복 시도하지 않는다.

### 단일 인스턴스

현재 운영 상태가 local JSON이므로 스케줄러도 단일 Railway replica만 지원한다. 다중 인스턴스가 필요해지면 DB의 unique constraint나 분산 lock을 사용하는 후속 버전으로 전환한다.

### 개인정보 최소화

운영 채널 알림은 종류별 총건수·지연건수·최장 시간·마감 임박 수와 선택적 HTTPS 콘솔 링크만 포함한다. 참여자 ID, 인증 내용, DM 원문, 포인트 잔액은 보내지 않는다.

## 4. 데이터와 상태

`ops-reminders.local.json`은 최근 120개 슬롯 레코드를 보관한다.

```json
{
  "version": 1,
  "isExample": false,
  "records": [
    {
      "dateKst": "2026-07-11",
      "slot": "10:00",
      "status": "sent",
      "reservedAt": "2026-07-11T01:00:12.000Z",
      "finishedAt": "2026-07-11T01:00:13.000Z"
    }
  ]
}
```

허용 상태는 `reserved`, `sent`, `failed`, `skipped`, `skipped-empty`다. 채널 ID, 메시지 본문, 참여자 식별정보는 저장하지 않는다.

## 5. 운영 흐름

1. env off면 timer와 파일을 만들지 않는다.
2. env on이면 현재 KST가 설정 슬롯 window 안인지 확인한다.
3. 동일 `{dateKst, slot}` 예약이 있으면 종료한다.
4. 이력 예약을 원자 저장한다. 실패하면 전송하지 않는다.
5. 공통 정책으로 요약을 계산한다.
6. 신호가 없으면 `skipped-empty`, 채널이 없으면 `skipped`로 끝낸다.
7. 채널 조회·전송 후 `sent` 또는 `failed`로 갱신한다.
8. 다음 슬롯은 이전 결과와 독립적으로 실행한다.

## 6. 단계별 구현

1. 공통 시간·임계값·마감 정책과 경계 테스트
2. 이력 경로·원자 예약·상태 전이와 백업/복원
3. 단일 tick과 scheduler 수명주기
4. admin API metadata와 정적 UI 배지
5. 문서·env·release gate와 전체 회귀

세부 파일·함수·테스트 계약은 [작업 지시서](../prompts/codex/ops-reminder-v1.md)를 따른다.

## 7. 완료 기준

- threshold·KST·미래/잘못된 시각 테스트 통과
- 슬롯 전·window·소급 금지와 재시작 중복 차단 증명
- 예약 저장 실패 시 Discord 전송 0건
- 전송·채널 실패가 봇과 admin 동작에 영향 없음
- 운영 메시지에 개인정보 없음
- history가 공통 경로·backup/restore에 포함
- 기존 admin Phase 1·2, dashboard, backup 테스트와 `check:release` 통과
- 실제 채널·Railway·375px 확인은 운영자 확인 대기로 기록

## 8. 롤백

`OPS_REMINDER_ENABLED=false`로 재배포하면 timer가 시작되지 않는다. 지연 metadata와 UI 배지는 읽기 계산이므로 필요하면 PR revert로 제거한다. 리마인더 이력은 운영 상태 변경의 원장이 아니므로 points·mission 데이터를 되돌리지 않는다.

## 9. 운영자가 나중에 결정할 값

- 운영 리마인더 전용 채널 ID
- 하루 슬롯(권장 시작안: 10:00, 17:00)
- 교환·인증·후속 임계값
- 미션 마감 임박 시간
- HTTPS admin URL

첫 주는 하루 1회와 보수적 임계값으로 시작하고 알림 피로를 확인한 뒤 조정한다.
