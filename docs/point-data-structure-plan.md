# 여정 포인트 시스템 데이터 구조 설계 v1

## 1. 문서 목적

이 문서는 리디파인 봇의 여정 포인트 시스템을 구현하기 전에 잔액, 거래, 상점, 교환, 미션, 인증 기록의 데이터 구조를 정리하는 기준 문서입니다. [journey-point-system-plan.md](journey-point-system-plan.md)에서 정리한 기능개발 방향을 실제 저장 모델, 상태값, 참조 관계와 복구 원칙으로 구체화합니다.

이번 범위는 설계와 구조 확인용 example JSON 작성까지입니다. 실제 slash command, 저장/조회 모듈, 알림 또는 외부 연동 구현은 후속 작업에서 진행합니다.

## 2. 설계 전제

- MEE6는 환대, 채팅 EXP, 레벨업 용도로만 사용하며 여정 포인트 잔액과 연계하지 않습니다.
- 리디파인 봇이 한글 명령어 기반의 자체 여정 포인트를 관리합니다.
- 리디파인 봇은 청년동 포인트 지급 사이트와 직접 연동하지 않습니다.
- `/교환` 신청이 유효하면 여정 포인트를 자동 차감하고 신청을 `pending`으로 기록합니다.
- 운영자가 청년동 포인트 사이트에서 실제 지급한 뒤 `/교환관리`로 지급 완료 또는 취소를 처리합니다.
- 지급이 불가능해 취소된 차감 건은 별도 환불 거래로 반환합니다.
- 모든 지급, 차감, 교환, 환불과 운영자 정정은 삭제하지 않는 로그로 남깁니다.
- 실제 운영 전에는 JSON 기반 MVP로 충분한지, DB 또는 Google Sheets 연동이 필요한지 다시 결정합니다.

## 3. 데이터 모델 전체 구조

| 모델 | 역할 | 주요 필드 | 참조 관계 | 운영상 주의사항 |
| --- | --- | --- | --- | --- |
| `users` | 참여자별 현재 잔액과 최소 식별 정보 관리 | `userId`, `displayName`, `nickname`, `totalPoints`, `status` | 거래, 교환, 제출의 `userId` 대상 | 잔액/순위 비공개, 최소 정보만 저장, 거래 합계와 잔액 일치 필요 |
| `pointTransactions` | 모든 포인트 증감의 감사 로그 | `id`, `userId`, `type`, `amount`, `balanceAfter`, `relatedId` | `users`, `redemptions`, `submissions`와 연결 | 기록 삭제 금지, 사유와 처리자 필수, 중복 처리 방지 |
| `shopItems` | `/상점`에 노출할 신청 가능 항목 | `id`, `name`, `cost`, `stock`, `status`, `type` | 여러 `redemptions.itemId`의 원본 | 비용/재고/한도 확정 필요, 내부 사용처임을 명시 |
| `redemptions` | `/교환` 신청과 지급 처리 상태 관리 | `id`, `userId`, `itemId`, `status`, `transactionId` | 사용자, 항목, 차감/환불 거래 참조 | 완료 전 실제 지급 확인, 장기 `pending` 점검 |
| `missions` | 선택형 활동 및 보상 기준 관리 | `id`, `title`, `rewardPoints`, `status`, `maxPerUser` | 여러 `submissions.missionId`의 원본 | 기간과 중복 지급 기준을 게시 전 확정 |
| `submissions` | `/인증` 제출 및 검토 결과 관리 | `id`, `missionId`, `userId`, `status`, `rewardTransactionId` | 사용자, 미션, 승인 지급 거래 참조 | 최소 인증 내용만 수집, 중복 승인 금지 |

## 4. `users` 구조

`users`는 여정 포인트 잔액과 참여자 기본 식별 정보를 관리합니다.

| 필드 | 형식 예시 | 설명 |
| --- | --- | --- |
| `userId` | `user_example_001` | 내부 참조용 사용자 식별자. example에는 실제 Discord ID를 사용하지 않음 |
| `displayName` | `참여자 예시 1` | 운영 확인용 최소 표시 이름 |
| `nickname` | `예시별` | 필요한 경우 사용하는 별칭 |
| `totalPoints` | `50` | 현재 사용 가능한 여정 포인트 잔액 |
| `createdAt` | ISO 8601 문자열 | 사용자 기록 생성 시각 |
| `updatedAt` | ISO 8601 문자열 | 잔액 또는 기본 정보 최종 변경 시각 |
| `status` | `active`, `inactive` | 운영 대상 상태 |
| `note` | 문자열 또는 `null` | 운영에 필요한 최소 참고 메모 |

실제 Discord `userId`는 지급 확인을 위해 필요한 경우에만 저장하고, 표시 이름도 운영 확인에 필요한 최소 범위로 제한합니다. 참여자는 본인 잔액만 확인할 수 있어야 하며, 다른 참여자의 잔액이나 순위를 공개하지 않습니다. `totalPoints`를 저장하는 경우 항상 해당 사용자의 `pointTransactions.amount` 합계와 맞아야 합니다.

## 5. `pointTransactions` 구조

`pointTransactions`는 포인트 증감 사실을 보존하는 핵심 로그입니다.

| 필드 | 형식 예시 | 설명 |
| --- | --- | --- |
| `id` | `tx_example_001` | 변경 불가능한 거래 식별자 |
| `userId` | `user_example_001` | 대상 사용자의 `users.userId` |
| `type` | `earn` | 거래 유형 |
| `amount` | `150`, `-100` | 증가는 양수, 차감은 음수로 저장 |
| `balanceAfter` | `50` | 이 거래 반영 직후 잔액 |
| `reason` | 문자열 | 지급, 차감, 정정 또는 환불 사유 |
| `relatedType` | `mission`, `redemption`, `manual` | 연결된 업무 기록 종류 |
| `relatedId` | `rd_example_001` | 연결된 신청/제출 등의 ID 또는 `null` |
| `createdBy` | `operator_example_a` | 요청 또는 처리 주체의 예시 식별자 |
| `createdAt` | ISO 8601 문자열 | 거래 생성 시각 |
| `note` | 문자열 또는 `null` | 정정 관계 등 보충 설명 |

| `type` | 의미 | `amount` 기준 | 대표 사용 상황 |
| --- | --- | --- | --- |
| `earn` | 활동 승인 또는 정해진 기준에 따른 지급 | 양수 | 승인된 미션, 체크인 지급 |
| `spend` | 일반 리워드 사용에 따른 차감 | 음수 | 굿즈 신청 등 |
| `adjust` | 운영자 정정 또는 사유 있는 수동 조정 | 양수 또는 음수 | 잘못된 지급 상쇄, 누락 보정 |
| `redeem` | 청년동 포인트 전환 등 교환 신청 시 차감 | 음수 | `redemptions` 생성과 함께 기록 |
| `refund` | 취소된 차감 건의 반환 | 양수 | 취소 교환의 원상 회복 |
| `cancel` | 기록된 거래 자체를 되돌릴 필요를 표시하는 보정 유형 후보 | 원 거래의 반대 부호 | 정책 확정 후 `adjust`와 구분할 때만 사용 |

거래 기록은 삭제하지 않습니다. 오류가 있으면 `adjust` 또는 확정된 정정 유형의 반대 거래를 추가하고 사유와 원 거래 ID를 남깁니다. 운영자 수동 지급과 차감에는 `reason`과 `createdBy`가 반드시 필요하며, 교환 차감과 환불은 `relatedType: "redemption"` 및 동일한 `relatedId`로 신청과 연결합니다.

`balanceAfter`를 저장하면 조회와 운영 확인이 빠르고 특정 시점의 이상을 추적하기 쉽습니다. 반면 동시 처리 중 잘못 기록되면 거래 합계와 불일치할 수 있으므로 원자적 업데이트와 정합성 검사가 필요합니다. 합계로만 계산하면 단일 원장이 기준이 되지만 조회량이 늘고 운영 화면의 시점별 확인이 복잡해집니다. MVP에서는 `amount`를 원장 기준으로 삼고 `balanceAfter`와 `users.totalPoints`를 함께 저장하되, 변경마다 합계 일치를 검증하는 방식을 제안합니다.

## 6. `shopItems` 구조

`shopItems`는 `/상점`에 표시되는 신청 가능 항목과 운영 가능 상태를 관리합니다.

| 필드 | 설명 |
| --- | --- |
| `id` | 상점 항목 식별자 |
| `name` | 참여자에게 표시할 항목명 |
| `description` | 제공 방식, 이용 범위, 확인 절차 안내 |
| `cost` | 필요한 여정 포인트 |
| `stock` | 제공 가능 수량. 무제한 정책이면 별도 규칙을 확정해야 함 |
| `monthlyLimit` | 사용자별 또는 운영 정책상 월간 신청 한도 |
| `status` | `active`, `paused`, `soldOut`, `hidden` |
| `type` | `youthCenterPoint`, `reward`, `goods`, `event` |
| `createdAt` | 항목 생성 시각 |
| `updatedAt` | 비용, 재고, 상태 최종 변경 시각 |
| `note` | 운영자 참고 메모 |

청년동 포인트 전환권은 `youthCenterPoint`로 구분합니다. 이는 청년동 내부에서 정한 사용처를 위한 운영진 수동 지급 신청이며, 현금 환급이나 외부 재화 교환, 양도 가능한 보상으로 안내하지 않습니다. 실제 비용, 재고, 한도와 지급 소요 시간은 운영진이 확정한 뒤 노출합니다.

## 7. `redemptions` 구조

`redemptions`는 `/교환` 신청 접수부터 운영자의 실제 지급 확인 및 환불까지 추적합니다.

| 필드 | 설명 |
| --- | --- |
| `id` | 교환 신청 식별자 |
| `userId` | 신청 사용자 ID |
| `itemId` | 신청한 `shopItems.id` |
| `cost` | 신청 시 차감된 여정 포인트 |
| `status` | `pending`, `completed`, `cancelled`, `refunded` |
| `requestedAt` | 신청 및 차감이 기록된 시각 |
| `completedAt` | 실제 지급 확인 완료 시각 또는 `null` |
| `cancelledAt` | 지급 취소 결정 시각 또는 `null` |
| `refundedAt` | 환불 거래 완료 시각 또는 `null` |
| `reviewedBy` | 지급/취소를 처리한 운영자 예시 식별자 또는 `null` |
| `transactionId` | 최초 차감 `redeem` 또는 `spend` 거래 ID |
| `refundTransactionId` | 환불 `refund` 거래 ID 또는 `null` |
| `note` | 지급 사유, 취소 사유, 점검 메모 |

| 상태 | 의미 | 필수 연결 기록 |
| --- | --- | --- |
| `pending` | 신청 완료, 여정 포인트 차감 완료, 실제 지급 대기 | `transactionId` |
| `completed` | 운영자가 실제 청년동 포인트 또는 리워드 지급을 확인함 | `transactionId`, `completedAt`, `reviewedBy` |
| `cancelled` | 지급 불가 또는 오류로 신청을 취소했고 환불 처리가 필요하거나 진행 중임 | `transactionId`, `cancelledAt`, `reviewedBy` |
| `refunded` | 취소 후 차감된 여정 포인트 반환까지 완료함 | `transactionId`, `refundTransactionId`, `cancelledAt`, `refundedAt` |

MVP에서는 처리 큐에 필요한 `pending`, `completed`, `cancelled`를 우선 사용하고, 환불 자체는 반드시 별도의 `refund` 거래로 남깁니다. 상태 조회에서 반환 완료 구분이 필요하면 `refunded`를 함께 사용합니다. `pending`은 운영자가 주기적으로 확인하며, `completed`는 실제 지급 완료 확인 후에만 기록합니다.

## 8. `missions` 구조

`missions`는 `/미션`에서 제시할 선택형 활동과 승인 시 지급 기준을 관리합니다.

| 필드 | 설명 |
| --- | --- |
| `id` | 미션 식별자 |
| `title` | 표시 제목 |
| `description` | 활동 방식과 인증 기준 |
| `rewardPoints` | 승인 또는 완료 시 지급할 여정 포인트 |
| `activeDate` | 단일 활성 날짜 또는 운영 표시용 기준 날짜 |
| `startAt`, `endAt` | 신청 가능 기간 |
| `status` | `draft`, `active`, `closed`, `archived` |
| `requiresSubmission` | 인증 제출 필요 여부 |
| `maxPerUser` | 사용자별 승인/지급 최대 횟수 |
| `note` | 내부 기준 메모 |

미션은 참여 강제가 아닌 선택형 활동이어야 합니다. 게시 전 지급 기준, 참여 기간, 인증 여부와 중복 지급 방지 기준을 명확히 공지하고, 개인정보가 필요한 인증을 과도하게 요구하지 않습니다.

## 9. `submissions` 구조

`submissions`는 `/인증`으로 제출된 수행 내용을 검토하고 지급 거래와 연결합니다.

| 필드 | 설명 |
| --- | --- |
| `id` | 제출 식별자 |
| `missionId` | 대상 `missions.id` |
| `userId` | 제출 사용자 ID |
| `content` | 검토에 필요한 최소 범위의 텍스트 |
| `status` | `pending`, `approved`, `rejected` |
| `reviewedBy` | 검토 운영자 예시 식별자 또는 `null` |
| `createdAt` | 접수 시각 |
| `reviewedAt` | 검토 시각 또는 `null` |
| `rewardTransactionId` | 승인 지급 `earn` 거래 ID 또는 `null` |
| `note` | 반려 안내나 운영 메모 |

제출 내용은 지급 판단에 필요한 최소 정보만 받습니다. `approved` 처리 시 `pointTransactions`에 `earn`을 추가하고 해당 ID를 연결합니다. `rejected`에는 필요한 안내 사유를 기록하되 참여자를 평가하는 표현을 사용하지 않습니다. 같은 미션/사용자 조합의 승인 횟수는 `maxPerUser`를 넘지 않도록 확인합니다.

## 10. 주요 관계 정리

- `users` 한 명은 여러 `pointTransactions`를 가질 수 있습니다.
- `users` 한 명은 여러 `redemptions`를 가질 수 있습니다.
- `shopItems` 한 개는 여러 `redemptions`와 연결될 수 있습니다.
- `redemptions` 한 개는 차감 `redeem` 또는 `spend` 거래 한 건과 연결됩니다.
- 취소된 `redemptions`는 필요 시 반환 `refund` 거래 한 건과 연결됩니다.
- `missions` 한 개는 여러 `submissions`와 연결될 수 있습니다.
- 승인된 `submissions` 한 건은 지급 `earn` 거래 한 건과 연결됩니다.

```text
users 1 --- N pointTransactions
  |                 ^    ^
  |                 |    |
  +--- N redemptions +    +--- approved submissions
             ^                         ^
             |                         |
shopItems 1--+             missions 1--+--- N submissions
```

## 11. 포인트 증감 규칙

- 활동 또는 승인에 따른 지급은 `earn`, 운영자가 사유를 남긴 조정은 `adjust`로 기록합니다.
- 교환 신청 차감은 전환 성격을 구분할 수 있도록 `redeem`을 기본으로 하고, 일반 사용과 구분하지 않기로 확정하는 경우에만 `spend`로 통일합니다.
- 취소 후 반환은 원 신청 ID를 연결한 `refund`로 기록합니다.
- 운영자 실수 정정은 기존 기록을 제거하지 않고 `adjust`로 반대 금액을 추가합니다.
- 어떤 거래 처리 이후에도 `users.totalPoints`가 음수가 되어서는 안 됩니다.
- 차감 직전에 최신 잔액과 항목 상태, 재고, 신청 한도를 확인합니다.
- 동일한 `redemptions.id`에는 차감 거래를 한 번만 연결합니다.
- 동일한 취소 신청에는 환불 거래를 한 번만 연결합니다.
- 미션 승인 지급은 동일 사용자/미션의 `maxPerUser`를 확인한 뒤 기록합니다.

## 12. 청년동 포인트 전환 데이터 흐름

### 신청 및 지급 완료

1. 참여자가 `/교환`에서 `shopItems.type`이 `youthCenterPoint`인 항목을 선택합니다.
2. 봇이 항목 상태와 한도, `users.totalPoints` 또는 거래 합산 잔액을 확인합니다.
3. 잔액과 정책 조건이 충족되면 `redemptions`를 `pending`으로 생성합니다.
4. 같은 처리 단위에서 `pointTransactions`에 음수 `redeem`을 추가하고 `redemptions.transactionId`에 연결합니다.
5. `users.totalPoints`와 거래의 `balanceAfter`를 차감 후 잔액으로 갱신합니다.
6. 운영자 전용 채널에 개인정보를 최소화한 `redemptions.id` 포함 지급 요청을 알립니다.
7. 운영자가 청년동 포인트 지급 사이트에서 청년동 내부 사용처용 포인트를 실제 지급합니다.
8. 운영자가 `/교환관리`로 `completed`를 선택하면 `completedAt`과 `reviewedBy`를 기록합니다.

### 취소 및 환불

1. 운영자가 재고, 지급 제한 또는 처리 오류로 지급 불가를 확인합니다.
2. 신청을 `cancelled`로 바꾸고 `cancelledAt`, `reviewedBy`, 취소 사유를 기록합니다.
3. 해당 신청의 `refundTransactionId`가 비어 있고 원 차감 거래가 존재하는지 확인합니다.
4. 원 `redemptions.id`를 연결한 양수 `refund` 거래를 추가합니다.
5. `users.totalPoints`와 `balanceAfter`를 반환 후 잔액으로 갱신합니다.
6. 상태 표시가 필요한 운영 화면에서는 `refunded`로 전환하고 `refundedAt`, `refundTransactionId`를 기록합니다.

## 13. JSON MVP 파일 구조 제안

이번 작업의 example 파일은 구조 이해와 후속 구현 논의를 위한 더미 데이터입니다. MVP v1의 실제 local JSON 기본 경로는 `data/missions.local.json`, `data/submissions.local.json`이며 커밋하지 않습니다.

| 파일 | 포함 최상위 키 | 표현하는 범위 |
| --- | --- | --- |
| `data/points.example.json` | `users`, `pointTransactions` | 잔액, 지급, 교환 차감, 환불, 정정 로그 |
| `data/shop-items.example.json` | `shopItems` | 전환권과 비현금성 항목의 비용/재고/상태 |
| `data/redemptions.example.json` | `redemptions` | `pending`, `completed`, `cancelled`, `refunded` 처리 예 |
| `data/missions.example.json` | `missions` | 선택형 미션, 기간, 보상과 인증 필요 여부 |
| `data/submissions.example.json` | `submissions` | `pending`, `approved`, `rejected` 검토 결과 |

example에는 실제 Discord 사용자 ID, 운영자 이름, 채널 ID 또는 실제 참여자 인증 내용을 넣지 않습니다. `*.local.json` 운영 파일은 JSON repository MVP용이며 장기 운영 저장소가 아닙니다. 실제 참여자 운영이 길어지거나 동시 처리량이 늘면 PostgreSQL 같은 트랜잭션 저장소를 우선 검토합니다.

### 참여 활동 MVP local 저장소

| 파일 | 기본 경로 | 환경변수 override | 운영 메모 |
| --- | --- | --- | --- |
| 미션 목록 | `data/missions.local.json` | `MISSIONS_DATA_PATH` | 없으면 example 구조를 참고해 빈 `missions` 배열로 시작 |
| 인증/체크인 기록 | `data/submissions.local.json` | `SUBMISSIONS_DATA_PATH` | 없으면 example 구조를 참고해 빈 `submissions` 배열로 시작 |

`/체크인`은 `submissions`에 `type: "checkin"` 기록을 남기고, 한국 시간 기준 `YYYY-MM-DD` 문자열인 `checkinDate`와 `userId` 조합으로 하루 1회 지급을 막습니다. 기본 지급량은 10P이며 운영진 안내에 따라 조정될 수 있습니다.

`/인증` 제출은 `type: "mission"`과 `status: "pending"`으로 저장됩니다. 운영자가 `/인증관리`에서 승인하면 `status: "approved"`로 바꾸고 `pointTransactions`의 `earn` 거래 ID를 `rewardTransactionId`에 연결합니다. 반려하면 `status: "rejected"`와 운영 메모만 남기며 포인트를 지급하지 않습니다. `approved` 또는 `rejected` 상태인 제출은 다시 처리하지 않습니다.

## 14. 저장 방식별 운영 판단

| 방식 | 장점 | 단점 | 적합한 단계 | 운영 리스크 | 추천 여부 |
| --- | --- | --- | --- | --- | --- |
| JSON 파일 기반 | 구조가 단순하고 로컬에서 빠르게 확인 가능 | 동시 갱신, 원자적 처리, 백업과 조회에 취약 | 설계 검토, MVP v1 | 파일 충돌이나 손상으로 잔액/로그 불일치 | 초기 운영 검증에만 권장 |
| SQLite | 단일 파일에서 트랜잭션과 제약을 사용할 수 있음 | 배포 환경의 영속 디스크와 백업 확인 필요 | 단일 인스턴스의 소규모 시험 운영 후보 | 파일 유실, 다중 인스턴스 충돌 | 배포/백업 조건 확인 시 후보 |
| PostgreSQL | 트랜잭션, 동시성, 제약, 정산 조회 확장에 유리 | 스키마 마이그레이션, 접근 통제, 운용 부담 | 실제 참여자 운영 및 확장 | 권한 설정/백업/마이그레이션 실수 | 실제 운영의 우선 검토 후보 |
| Google Sheets 연동 | 운영진이 정산 현황을 직접 확인하기 쉬움 | 원자적 처리와 감사 로그 확보가 어렵고 API 권한 관리 필요 | 정산 조회 또는 보조 워크플로 | 동시 편집, 개인정보 공유 범위 초과 | 보조 정산 도구로 검토 |

로컬 설계와 초기 MVP 논의는 JSON example로 시작할 수 있습니다. 그러나 지급과 환불의 이력이 중요한 실제 참여자 운영을 단순 JSON에 장기간 의존하는 것은 위험합니다. 실제 운영 전에는 PostgreSQL을 우선 검토하고, 운영진 정산 확인이 필요하면 접근 권한과 동시성 정책을 정한 Google Sheets 보조 연동을 검토합니다.

## 15. 권한과 개인정보 기준

- 참여자는 본인의 포인트 잔액과 본인 신청 상태만 확인할 수 있어야 합니다.
- 운영자는 권한 확인 후 포인트 지급/차감, 교환 완료/취소, 로그 조회를 수행합니다.
- 일반 참여자는 `/포인트로그`, `/포인트관리`, `/교환관리`를 사용할 수 없어야 합니다.
- 운영자 명령어 응답은 가능한 한 ephemeral로 표시합니다.
- 지급 요청 알림은 운영진만 접근할 수 있는 채널에 한정합니다.
- 실제 사용자 ID, 표시 이름과 인증 내용은 업무에 필요한 최소 범위만 저장합니다.
- 로그 또는 정산 자료를 내보낼 때 불필요한 개인정보와 인증 원문이 포함되지 않도록 점검합니다.

## 16. 오류와 복구 시나리오

| 상황 | 권장 복구 방식 |
| --- | --- |
| 교환 신청 후 청년동 포인트 지급을 못 한 경우 | `cancelled` 처리 사유를 남기고 원 신청에 연결한 `refund` 거래를 생성한 뒤 반환 완료를 기록함 |
| 운영자가 `completed`를 잘못 처리한 경우 | 완료 기록을 삭제하지 않고 정정 사유를 남김. 실제 미지급이면 취소/환불 절차로 복구하며 처리 이력을 보존함 |
| 여정 포인트가 중복 차감된 경우 | 중복 차감 거래를 식별하고 삭제 대신 동일 금액의 `adjust` 또는 정책상 `refund` 거래를 추가함 |
| 여정 포인트가 중복 지급된 경우 | 중복 지급 원인을 기록하고 음수 `adjust`로 정정하되, 음수 잔액이 발생하면 운영진 검토 후 처리함 |
| `shopItem` 재고가 부족한 경우 | 신규 신청을 막도록 항목을 `soldOut` 또는 `paused`로 전환하고 이미 차감된 미지급 신청은 취소/환불함 |
| `pending` 신청이 장기간 방치된 경우 | 운영자 점검 목록에서 처리 기한 초과 건을 확인하고 지급 완료 또는 사유 있는 취소/환불로 종결함 |
| 데이터 파일 또는 DB 오류가 발생한 경우 | 지급/차감 처리를 중지하고 백업과 거래 로그를 기준으로 정합성을 점검한 뒤 복구 내역을 별도 기록함 |

## 17. 구현 전 확정해야 할 항목

- [ ] 여정 포인트 명칭 확정
- [ ] 청년동 포인트 전환 비율 확정
- [ ] 월별 전환 한도 확정
- [ ] 1일 또는 1주 적립 상한 확정
- [ ] 청년동 포인트 실제 지급 담당자 확정
- [ ] 운영자 알림 채널 및 접근 권한 확정
- [ ] 취소와 환불 처리 기준 및 처리 기한 확정
- [ ] 상점 항목, 비용과 재고 확정
- [ ] 실제 운영 저장 방식과 백업/복구 방식 확정
- [ ] 정산 조회 및 내보내기 방식 확정
- [ ] 사용자 식별 정보와 인증 내용 보관 범위/기간 확정

## 18. 다음 작업 제안

| 순서 | 작업 | 목적 | 위험도 | 수정 예상 파일 | `npm run deploy` 필요 여부 |
| --- | --- | --- | --- | --- | --- |
| 1 | 포인트 example JSON 검토 및 스키마 확정 | 모델/상태/참조 규칙을 운영진과 확정 | 낮음 | `data/*.example.json`, 본 문서 | 아니오 |
| 2 | 포인트 저장/조회 유틸 모듈 구현 | 잔액과 거래 원장의 일관된 읽기/쓰기 확보 | 높음: 동시성/정합성 | 신규 데이터 모듈, 테스트, 운영 데이터 경로 | 아니오. 명령어 등록 변경 없음 |
| 3 | `/포인트`, `/상점` 조회 구현 | 참여자가 본인 잔액과 신청 가능 항목 조회 | 중간: 개인정보/노출 정책 | 명령어 정의 및 처리 모듈 | 신규 slash command 등록 시 필요 |
| 4 | `/교환` 신청 및 운영자 알림 구현 | 차감과 지급 요청을 연결 | 높음: 중복 차감/권한 | 명령어, 저장/알림/로그 모듈 | 신규 slash command 등록 시 필요 |
| 5 | `/포인트관리`, `/교환관리`, `/포인트로그` 구현 | 지급, 환불, 정산 감사 흐름 제공 | 높음: 운영자 권한/정정 | 명령어, 권한/로그 모듈 | 신규 slash command 등록 시 필요 |
| 6 | `/체크인`, `/미션`, `/인증` 구현 | 선택형 활동 승인 지급 지원 | 높음: 중복 지급/인증 정보 | 명령어, 미션/제출 모듈 | 신규 slash command 등록 시 필요 |
| 7 | CSV 또는 Google Sheets 정산 연동 검토 | 운영진의 기간별 정산 확인 보조 | 높음: 접근권한/동시성 | 내보내기 또는 연동 모듈, 운영 문서 | 명령어가 변경될 때만 필요 |

이 문서와 example 파일 작성 단계에서는 실제 명령어를 구현하거나 배포하지 않습니다.

## 19. pointsStore v1 구현 메모

- `pointsStore` v1은 Slash Command 구현이 아닌 내부 데이터 저장/조회 유틸 모듈입니다.
- 실제 운영 데이터 파일은 생성하지 않으며, example JSON을 기준으로 smoke test를 수행합니다.
- 운영 데이터 저장 방식은 아직 확정하지 않았습니다.
- 실제 참여자 운영 전에는 PostgreSQL 또는 Google Sheets 등 영속 저장소를 다시 검토해야 합니다.
- `users.totalPoints`와 `pointTransactions.amount` 합계의 정합성을 검증하는 함수를 사용해야 합니다.

## 20. 운영자 관리 명령과 local JSON 갱신

운영자 관리 MVP v1에서는 `/운영현황`, `/미션관리`, `/상점관리`가 local JSON repository를 직접 갱신합니다. 이 구조는 디스코드 안에서 운영 흐름을 검증하기 위한 MVP용이며, 장기 운영 저장소로 확정된 것은 아닙니다.

### mission status

| status | 의미 | 참여자 노출 |
| --- | --- | --- |
| `draft` | 생성 후 검토 중 | 노출 안 함 |
| `active` | 현재 참여 가능 | `/미션`에 노출 |
| `paused` | 일시 중지 | 노출 안 함 |
| `closed` | 종료 | 노출 안 함 |
| `archived` | 보관 | 노출 안 함 |

### shopItem status

| status | 의미 | 참여자 노출 |
| --- | --- | --- |
| `active` | 신청 가능 | `/상점`에 노출 |
| `paused` | 운영자 검토 또는 일시 중지 | 노출 안 함 |
| `soldOut` | 재고 소진 | 노출 안 함 |
| `hidden` | 운영자 내부 보관 | 노출 안 함 |

`/미션관리`는 미션 제목, 설명, 지급 포인트, 인증 필요 여부, 날짜, 메모를 수정할 수 있습니다. `/상점관리`는 항목 이름, 설명, 비용, 재고, 월한도, 유형, 메모를 수정할 수 있습니다. 포인트와 비용은 0보다 큰 정수여야 하며 재고와 월한도는 0 이상의 정수 또는 미지정 값으로 둡니다.

local JSON은 동시성, 백업, 감사 로그 면에서 제한이 있으므로 실제 참여자 운영 전에는 PostgreSQL 또는 Google Sheets 보조 연동을 다시 검토해야 합니다. 이번 MVP v1에는 Google Sheets, PostgreSQL, 웹 대시보드를 포함하지 않습니다.

## 21. 운영 데이터 내보내기 MVP v1

운영 데이터 내보내기 기능은 local JSON 기반 MVP 저장소의 한계를 보완하기 위한 중간 단계입니다. `/운영내보내기`는 포인트 거래, 교환 신청, 인증 제출, 미션 설정, 상점 설정, 운영 요약을 요약, JSON, CSV 형식으로 출력합니다.

CSV와 JSON export는 Google Sheets 또는 PostgreSQL 연동 전 데이터 구조와 운영 확인 형식을 정리하는 역할을 합니다. 이번 단계에서는 외부 저장소와 직접 동기화하지 않으며, 운영자가 디스코드 안에서 필요한 백업 파일을 내려받는 흐름만 제공합니다.

local JSON 저장소는 동시성, 장기 보관, 장애 복구, 배포 환경의 파일 유지 측면에서 제한이 있습니다. 실제 운영 전 또는 정산 감사가 중요해지는 시점에는 PostgreSQL 같은 영속 저장소나 Google Sheets 보조 정산 연동을 별도 단계로 검토해야 합니다.
