# Google Sheets 운영 데이터 연동 설계

이 문서는 현재 `main` 기준 리디파인 디스코드 봇의 local JSON 운영 데이터를 Google Sheets와 함께 사용하는 현실적인 MVP 설계를 정리합니다. 이번 단계의 목표는 전체 DB 전환이 아니라, 기존 `data/*.local.json` 저장을 유지하면서 운영자가 Google Sheets에서 포인트와 미션 인증 흐름을 확인하고 백업할 수 있도록 append-only 로그를 함께 남기는 것입니다.

## 1. 배경과 필요성

현재 봇은 포인트, 인증 제출, 교환 신청, 반응 승인, 오늘의 미션 안내 이력을 `data/*.local.json`에 저장합니다. 이 방식은 초기 구현과 로컬 검증에는 단순하지만, Railway 재배포나 커밋/머지 후 배포 과정에서 파일 시스템 상태가 유지되지 않으면 `/포인트로그`, `/운영현황`, `/admin`에서 실제 운영 내역이 사라질 수 있습니다.

운영자는 Discord 명령어와 반응 승인으로 운영을 처리하면서도, 별도의 관리자 화면 없이 Google Sheets에서 필터링, 정산, 백업, 수동 확인을 하고 싶어합니다. 따라서 1단계에서는 봇의 기존 동작을 바꾸지 않고 Google Sheets를 운영 확인용 append-only 로그 저장소로 추가하는 방향이 적합합니다.

## 2. 현재 local JSON 저장 구조의 한계

- `data/*.local.json`은 커밋 대상이 아닌 런타임 상태 파일이라 배포 환경의 파일 보존 정책에 영향을 받습니다.
- Railway 재배포, 새 인스턴스 실행, 파일 시스템 초기화가 발생하면 운영 데이터가 사라지거나 과거 상태로 돌아갈 수 있습니다.
- 여러 인스턴스가 동시에 실행되면 JSON 파일 쓰기 충돌이나 상태 불일치가 생길 수 있습니다.
- 운영자가 데이터를 직접 확인하려면 `/운영내보내기` 결과를 다시 내려받아 보관해야 합니다.
- 로컬 파일은 필터, 정렬, 정산 메모, 수동 백업 같은 운영자 친화 기능이 약합니다.

## 3. Google Sheets 연동의 장점과 주의사항

장점:

- 운영자가 익숙한 UI에서 필터, 정렬, 조건부 서식, 피벗, 백업을 직접 사용할 수 있습니다.
- Discord 봇 재배포와 독립적인 외부 로그 복사본을 남길 수 있습니다.
- 개발 초기에는 DB 스키마와 관리자 CRUD 화면 없이도 운영 확인성을 크게 높일 수 있습니다.
- CSV 내보내기보다 실시간에 가까운 운영 기록 확인이 가능합니다.

주의사항:

- Google Sheets는 고동시성 트랜잭션 DB가 아니므로 포인트 원장과 중복 지급의 최종 권한을 바로 넘기면 위험합니다.
- API 실패, Apps Script 지연, Google 쿼터 제한, 네트워크 장애를 고려해야 합니다.
- 시트 편집 권한을 넓게 열면 운영 데이터가 임의 수정될 수 있습니다.
- 사용자 ID, 표시 이름, 인증 원문, 첨부 URL, 운영 메모는 개인정보 또는 민감 운영 데이터로 취급해야 합니다.
- 첨부파일 URL은 Discord/CDN 정책에 따라 접근 가능 기간이나 권한이 달라질 수 있으므로 영구 보관 원본으로 보장하지 않습니다.

## 4. 추천 MVP 방향

1단계는 **Google Apps Script Web App 방식**을 추천합니다.

- 봇은 기존 local JSON 저장을 먼저 수행합니다.
- 저장 성공 후 Sheets append 요청을 비동기로 시도합니다.
- Sheets append 실패가 Discord 운영 처리 성공을 막지 않도록 합니다.
- 실패한 append 이벤트는 별도 재시도 큐 파일 또는 운영 로그로 남겨 수동 재처리할 수 있게 합니다.
- 1단계 적재 범위는 `point_transactions`, `mission_submissions`입니다.

이 구조에서 local JSON은 계속 봇의 즉시 처리 기준이고, Google Sheets는 운영 확인과 백업을 위한 보조 원장입니다. 포인트의 신뢰 기준은 `point_transactions` append-only 로그이며, `participants.total_points`는 운영자가 보기 쉬운 요약값으로만 둡니다.

## 5. 추천 Spreadsheet 탭 구조

| 탭 | 성격 | 1단계 여부 | 설명 |
| --- | --- | --- | --- |
| `point_transactions` | append-only 로그 | 포함 | 모든 포인트 증감 기록. 포인트 원장의 기준 |
| `mission_submissions` | append-only 로그 | 포함 | 인증 제출 접수 기록. 제출 원문 위치와 검토 전 상태 기록 |
| `mission_reviews` | append-only 로그 | 이후 확장 | 인증 승인/반려와 지급 연결 기록 |
| `participants` | 현재 상태 요약 | 이후 확장 | 사용자별 표시 이름, 상태, 현재 포인트 요약 |
| `redemptions` | 상태 테이블 또는 이벤트 로그 | 이후 확장 | 교환 신청, 완료, 취소, 환불 상태 |
| `daily_announcements` | append-only 로그 | 이후 확장 | 오늘의 미션 안내 발송 이력 |
| `append_failures` | 운영 재처리 큐 | 권장 | Sheets 적재 실패 이벤트와 재시도 상태 |

탭 이름은 영문 snake_case로 고정합니다. Apps Script와 봇 코드에서 탭명을 상수로 관리하고, 운영자가 탭명을 바꾸지 않도록 시트 보호를 권장합니다.

## 6. 탭별 컬럼 설계

### 6.1 `point_transactions`

포인트 변경 기록은 반드시 append-only로 남깁니다. 기존 행을 수정하거나 삭제하지 않고, 정정은 `adjust`, 환불은 `refund` 같은 새 거래 행으로 기록합니다.

| 컬럼명 | 설명 |
| --- | --- |
| `event_id` | Sheets 적재 이벤트 ID. 재시도 중복 방지용 |
| `transaction_id` | 봇 내부 포인트 거래 ID |
| `created_at` | 거래 생성 시각 ISO-8601 |
| `created_date_kst` | 운영 필터용 KST 날짜 |
| `user_id` | Discord 사용자 ID |
| `display_name` | 거래 당시 표시 이름 |
| `type` | `earn`, `spend`, `adjust`, `redeem`, `refund`, `cancel` |
| `amount` | 증감 포인트. 차감은 음수 |
| `balance_after` | 거래 직후 봇이 계산한 잔액 |
| `reason` | 지급/차감 사유 |
| `related_type` | `missionSubmission`, `todayMissionSubmission`, `missionReactionApproval`, `redemption`, `checkin`, `manual` 등 |
| `related_id` | 연결 제출, 메시지, 교환, 체크인 ID |
| `created_by` | 처리자 또는 사용자 ID |
| `source_surface` | `slash_command`, `reaction_approval`, `today_mission_channel`, `system` 등 |
| `discord_message_url` | 원본 메시지가 있으면 Discord 메시지 링크 |
| `note` | 운영 메모. 민감 정보 최소화 |
| `appended_at` | Sheets에 기록된 시각 |

중복 방지 기준은 `transaction_id`와 `event_id`입니다. Apps Script는 같은 `event_id` 또는 `transaction_id`가 이미 있으면 새 행을 추가하지 않고 `duplicate` 응답을 반환해야 합니다.

### 6.2 `mission_submissions`

인증 제출 접수 시점의 로그입니다. 승인/반려 결과는 나중에 `mission_reviews`에 별도 append하는 구조를 권장합니다.

| 컬럼명 | 설명 |
| --- | --- |
| `event_id` | Sheets 적재 이벤트 ID |
| `submission_id` | 봇 내부 제출 ID |
| `submitted_at` | 제출 접수 시각 ISO-8601 |
| `submitted_date_kst` | 운영 필터용 KST 날짜 |
| `type` | `mission`, `todayMission` |
| `mission_id` | 일반 미션 ID. 오늘의 미션이면 비울 수 있음 |
| `mission_title` | 제출 당시 미션명 |
| `today_mission_date` | 오늘의 미션 지급 기준 KST 날짜 |
| `user_id` | Discord 사용자 ID |
| `display_name` | 제출 당시 표시 이름 |
| `content_summary` | 운영 확인용 요약. 긴 원문 전체 저장은 지양 |
| `attachment_count` | 첨부 개수 |
| `attachment_urls` | 첨부 URL 목록. 여러 개면 JSON 문자열 |
| `message_id` | 원본 Discord 메시지 ID |
| `channel_id` | 원본 채널 ID |
| `guild_id` | 서버 ID |
| `discord_message_url` | 원본 메시지 링크 |
| `status_at_submit` | 접수 시점 상태. 보통 `pending` |
| `reward_points` | 승인 시 지급 예정 포인트 |
| `duplicate_key` | 하루 1회 지급 중복 방지 키 |
| `source_surface` | `slash_command`, `today_mission_channel` 등 |
| `appended_at` | Sheets에 기록된 시각 |

`content_summary`는 운영자가 구분할 수 있을 정도로만 저장합니다. 첨부 원본 보관이 중요하다면 Discord URL만 신뢰하지 말고 별도 보관 정책을 마련해야 합니다.

### 6.3 `mission_reviews`

인증 제출 검토 결과의 append-only 로그입니다. 1단계 이후 확장 대상입니다.

| 컬럼명 | 설명 |
| --- | --- |
| `event_id` | Sheets 적재 이벤트 ID |
| `review_id` | 검토 이벤트 ID |
| `submission_id` | 연결 제출 ID |
| `reviewed_at` | 승인/반려 시각 |
| `reviewed_date_kst` | 운영 필터용 KST 날짜 |
| `action` | `approve`, `reject`, `duplicate_reward_blocked` |
| `reviewer_id` | 운영자 Discord 사용자 ID |
| `reviewer_display_name` | 운영자 표시 이름 |
| `note` | 검토 메모 |
| `reward_transaction_id` | 승인 지급 거래 ID. 반려나 중복 차단이면 비울 수 있음 |
| `reward_points` | 실제 지급 포인트 |
| `duplicate_reward_blocked` | 오늘의 미션 중복 지급 차단 여부 |
| `discord_message_url` | 원본 제출 메시지 링크 |
| `appended_at` | Sheets에 기록된 시각 |

### 6.4 `participants`

참여자 현재 상태 요약 테이블입니다. append-only 원장이 아니라 최신 상태를 보기 쉽게 정리하는 탭입니다.

| 컬럼명 | 설명 |
| --- | --- |
| `user_id` | Discord 사용자 ID |
| `display_name` | 최근 표시 이름 |
| `nickname` | 운영자가 관리하는 별칭 |
| `status` | `active`, `inactive`, `blocked` 등 |
| `total_points` | 요약 잔액. 신뢰 기준은 `point_transactions` 합계 |
| `last_transaction_id` | 마지막 반영 거래 ID |
| `last_submission_id` | 마지막 제출 ID |
| `last_seen_at` | 마지막 활동 시각 |
| `updated_at` | 요약 행 갱신 시각 |
| `note` | 운영 메모 |

`total_points`는 운영 편의를 위한 캐시입니다. 정산이나 분쟁 확인 시에는 `point_transactions`를 사용자별로 합산해 검증합니다.

### 6.5 `redemptions`

교환은 상태 변화가 중요하므로 두 방식 중 하나를 선택할 수 있습니다. MVP에서는 운영자가 보기 쉬운 현재 상태 테이블을 두고, 장기적으로는 `redemption_events` append-only 로그를 추가하는 방향을 권장합니다.

| 컬럼명 | 설명 |
| --- | --- |
| `redemption_id` | 교환 신청 ID |
| `user_id` | Discord 사용자 ID |
| `display_name` | 신청 당시 표시 이름 |
| `item_id` | 상점 항목 ID |
| `item_name` | 항목명 |
| `cost` | 차감 포인트 |
| `status` | `pending`, `completed`, `cancelled`, `refunded` |
| `requested_at` | 신청 시각 |
| `completed_at` | 완료 시각 |
| `cancelled_at` | 취소 시각 |
| `refunded_at` | 환불 시각 |
| `reviewed_by` | 처리 운영자 ID |
| `transaction_id` | 신청 차감 거래 ID |
| `refund_transaction_id` | 환불 거래 ID |
| `note` | 운영 메모 |
| `updated_at` | Sheets 행 갱신 시각 |

교환도 감사 추적이 필요해지면 `redemption_events`를 별도 탭으로 두고 신청, 완료, 취소, 환불을 모두 append-only로 기록합니다.

### 6.6 `daily_announcements`

오늘의 미션 안내 발송 이력입니다.

| 컬럼명 | 설명 |
| --- | --- |
| `event_id` | Sheets 적재 이벤트 ID |
| `announcement_date_kst` | 안내 기준 KST 날짜 |
| `sent_at` | 발송 시각 |
| `channel_id` | 발송 채널 ID |
| `message_id` | 안내 메시지 ID |
| `discord_message_url` | 안내 메시지 링크 |
| `status` | `sent`, `skipped`, `failed` |
| `reason` | `SENT`, `ALREADY_SENT_TODAY`, `MISSING_CHANNEL_ID` 등 |
| `appended_at` | Sheets에 기록된 시각 |

현재 구현은 오늘의 미션 안내 이력을 `daily-mission-announcements.local.json`에 저장합니다. Sheets 확장 시에도 하루 1회 안내 여부는 `announcement_date_kst` 기준으로 확인할 수 있게 합니다.

## 7. Discord 원본 메시지와 첨부파일 URL 저장 방식

Discord 원본 메시지는 가능한 경우 다음 필드를 함께 저장합니다.

- `guild_id`
- `channel_id`
- `message_id`
- `discord_message_url`

링크 형식은 Discord 표준 메시지 링크를 사용합니다. 실제 링크 값은 문서에 적지 않고, 런타임에서 생성된 값을 Sheets에만 저장합니다.

첨부파일은 다음 원칙을 권장합니다.

- 일반 미션 slash command 제출은 `attachment.id`, `attachment.name`, `attachment.url`, `contentType`, `size`를 구조화해 저장할 수 있습니다.
- 오늘의 미션 채널 메시지 제출은 우선 `attachment_count`와 `discord_message_url`을 저장하고, 필요하면 첨부 URL 목록을 추가합니다.
- 첨부 URL은 영구 보관 저장소가 아니라 원본 확인 링크로 취급합니다.
- 인증 원문과 첨부 URL은 접근 권한이 있는 운영진만 볼 수 있게 Spreadsheet 공유 범위를 제한합니다.

## 8. 오늘의 미션 하루 1회 지급 중복 방지 기준

오늘의 미션 포인트 지급 중복 방지 기준은 다음 키를 권장합니다.

```text
todayMission:{today_mission_date}:{user_id}
```

향후 템플릿 기반 반복 미션으로 확장하면 다음처럼 미션 템플릿까지 포함합니다.

```text
dailyMission:{template_id}:{active_date_kst}:{user_id}
```

현재 코드의 오늘의 미션 승인 흐름은 같은 사용자, 같은 `todayMissionDate`, 이미 승인되었고 `rewardTransactionId`가 있으며 `duplicateRewardBlocked`가 아닌 제출이 있으면 추가 지급을 막는 구조입니다. Sheets 설계도 이 기준을 따르되, `mission_submissions.duplicate_key`와 `mission_reviews.duplicate_reward_blocked`를 함께 남겨 운영자가 중복 제출과 중복 지급 차단을 구분할 수 있게 합니다.

Sheets는 중복 지급 방지의 최종 락으로 사용하지 않습니다. 1단계에서는 봇의 local JSON 검사를 기준으로 지급 여부를 결정하고, Sheets는 결과를 감사 로그로 남깁니다. 나중에 Sheets를 더 강한 상태 저장소로 쓰려면 Apps Script `LockService` 또는 DB 수준 unique constraint가 필요합니다.

## 9. 포인트 잔액 관리 방식

권장 원칙:

- `point_transactions`가 포인트 원장입니다.
- 모든 지급, 차감, 정정, 환불은 새 거래 행으로 append합니다.
- `participants.total_points`는 운영자 확인용 요약값입니다.
- 잔액 불일치가 의심되면 `point_transactions.amount`를 사용자별로 합산해 검증합니다.
- `balance_after`는 거래 당시 봇이 계산한 결과를 남기는 감사 필드입니다.

정정이 필요할 때 기존 거래 행을 수정하지 않습니다. 예를 들어 중복 지급을 회수해야 하면 `adjust` 거래를 새로 만들고 `related_id` 또는 `note`로 원 거래를 연결합니다.

## 10. append-only 로그와 현재 상태 테이블을 분리하는 이유

append-only 로그는 무엇이 언제 누구에 의해 발생했는지 복구하고 검증하는 기준입니다. 현재 상태 테이블은 운영자가 지금 처리해야 할 대상과 요약을 빠르게 보기 위한 뷰입니다.

둘을 섞으면 다음 문제가 생깁니다.

- 상태 행을 덮어쓰는 과정에서 과거 승인, 반려, 환불 이력이 사라집니다.
- 운영자가 시트에서 직접 수정한 값과 봇이 기록한 원장이 구분되지 않습니다.
- 포인트 분쟁이나 누락 지급 확인 시 신뢰 기준이 흐려집니다.
- 이후 PostgreSQL 같은 DB로 전환할 때 이벤트 로그 재생이 어려워집니다.

따라서 포인트와 검토 이벤트는 append-only 로그로 남기고, 참여자 잔액과 교환 대기 목록은 별도 현재 상태 탭으로 관리합니다.

## 11. Apps Script Web App 방식과 Google Sheets API 직접 연동 비교

| 항목 | Apps Script Web App | Google Sheets API 직접 연동 |
| --- | --- | --- |
| 인증 | 공유 secret 또는 서명 토큰으로 단순화 가능 | 서비스 계정 또는 OAuth 설정 필요 |
| Railway 환경변수 | URL과 secret 중심 | 서비스 계정 JSON/키 관리 필요 |
| 운영자 소유 시트 연결 | Apps Script가 시트와 같은 Google 계정에서 관리 가능 | 서비스 계정에 시트 공유 필요 |
| 구현 난이도 | 낮음. HTTP POST로 append 위임 | 중간. Google API 클라이언트와 인증 처리 필요 |
| 동시성 제어 | `LockService`로 간단한 append 락 가능 | API 호출 측에서 재시도와 중복 확인 구현 필요 |
| 응답/쿼터 | Apps Script 실행 시간과 쿼터 제한 주의 | Sheets API 쿼터와 인증 실패 처리 주의 |
| 보안 | Web App URL 유출 방지와 secret 검증 필요 | 서비스 계정 키 보관이 핵심 |
| 장기 확장성 | 간단한 운영 로그에 적합 | 구조가 커지면 더 명확하고 테스트 가능 |

현재 프로젝트에는 **Apps Script Web App 방식**을 1단계 기본안으로 추천합니다. 이유는 운영자 확인용 append 로그가 목표이고, 봇 코드에는 HTTPS POST 클라이언트와 재시도/fallback만 추가하면 되며, 서비스 계정 키를 Railway에 넣는 부담을 줄일 수 있기 때문입니다.

다만 다음 조건이 생기면 Google Sheets API 직접 연동이나 PostgreSQL을 다시 검토합니다.

- Sheets를 읽어서 봇의 지급 여부를 결정해야 하는 경우
- 많은 동시 요청에서 강한 중복 방지와 원자성이 필요한 경우
- Apps Script 쿼터나 실행 시간이 운영에 영향을 주는 경우
- 테스트 가능한 저장소 어댑터와 엄격한 에러 처리가 더 중요해지는 경우

## 12. 필요한 환경변수 목록

Apps Script Web App 방식 1단계:

| 환경변수 | 설명 |
| --- | --- |
| `GOOGLE_SHEETS_LOGGING_ENABLED` | Sheets append 활성화 여부. `true`일 때만 전송 |
| `GOOGLE_SHEETS_WEB_APP_URL` | Apps Script Web App HTTPS URL |
| `GOOGLE_SHEETS_WEB_APP_SECRET` | 요청 검증용 공유 secret |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | 대상 Spreadsheet ID. Apps Script에서 고정하면 생략 가능 |
| `GOOGLE_SHEETS_APPEND_TIMEOUT_MS` | append 요청 타임아웃 |
| `GOOGLE_SHEETS_APPEND_RETRY_COUNT` | 실패 시 재시도 횟수 |
| `GOOGLE_SHEETS_APPEND_FAILURE_PATH` | 실패 이벤트 로컬 큐 파일 경로. 기본값은 `data/google-sheets-append-failures.local.json` 권장 |

Google Sheets API 직접 연동을 선택할 경우 추가 후보:

| 환경변수 | 설명 |
| --- | --- |
| `GOOGLE_SHEETS_CLIENT_EMAIL` | 서비스 계정 이메일 |
| `GOOGLE_SHEETS_PRIVATE_KEY` | 서비스 계정 private key. 줄바꿈 처리 주의 |
| `GOOGLE_SHEETS_PRIVATE_KEY_BASE64` | private key를 base64로 넣는 대안 |

환경변수에는 실제 URL, 토큰, 키, Discord ID를 문서나 Git에 남기지 않습니다.

## 13. 보안 주의사항

- Spreadsheet 공유 범위는 운영진 최소 인원으로 제한합니다.
- Apps Script Web App URL과 secret은 `.env`, Railway Variables 같은 비공개 환경에만 둡니다.
- Web App은 요청 본문 secret, HMAC 서명, timestamp 허용 범위 중 최소 하나 이상으로 검증합니다. 가능하면 `event_id + timestamp + body` 기반 HMAC을 권장합니다.
- secret이 틀리거나 timestamp가 오래된 요청은 append하지 않습니다.
- Apps Script 실행 로그에 전체 인증 원문, 첨부 URL, 토큰을 남기지 않습니다.
- 운영자 메모에는 민감한 참여자 사연이나 건강 정보 같은 내용을 최소화합니다.
- Spreadsheet를 외부 공유할 때는 사용자 ID, 표시 이름, 인증 원문, 첨부 URL 열을 제거한 사본을 사용합니다.

## 14. API 실패와 fallback 전략

1단계에서는 Sheets append가 실패해도 Discord 운영 처리 자체를 실패로 되돌리지 않습니다. 대신 다음 순서를 권장합니다.

1. local JSON 저장을 완료합니다.
2. Sheets append 요청을 보냅니다.
3. 성공하면 응답의 `event_id`, `tab`, `row_number`, `appended_at`을 운영 로그에 남길 수 있습니다.
4. 실패하면 실패 이벤트를 `data/google-sheets-append-failures.local.json` 같은 local 큐에 저장합니다.
5. 운영자에게는 심각도에 따라 로그 채널 알림을 보냅니다.
6. 재시도 스크립트 또는 운영자 명령은 별도 후속 단계로 설계합니다.

중복 append를 막기 위해 모든 payload에는 안정적인 `event_id`를 포함합니다. 예를 들어 `point_transactions:{transaction_id}`, `mission_submissions:{submission_id}`처럼 원본 엔티티 ID에서 파생합니다.

## 15. 구현 단계별 계획

### 1단계. 운영 로그 append MVP

- Apps Script Web App을 만들고 `point_transactions`, `mission_submissions` 탭 append를 구현합니다.
- 봇에는 Sheets logging client를 추가하되 기존 저장 로직은 유지합니다.
- 포인트 거래 생성 성공 후 `point_transactions`에 append합니다.
- 일반 미션 인증과 오늘의 미션 제출 접수 성공 후 `mission_submissions`에 append합니다.
- Sheets 실패 시 local 실패 큐와 운영 로그 알림으로 fallback합니다.
- `/포인트로그`, `/운영현황`, `/admin`은 계속 local JSON을 읽습니다.

### 2단계. 검토 결과와 교환 확장

- 인증 승인/반려 시 `mission_reviews`에 append합니다.
- 교환 신청, 완료, 취소, 환불을 `redemptions` 또는 `redemption_events`에 기록합니다.
- `participants` 요약 탭을 갱신해 운영자가 현재 잔액과 상태를 빠르게 볼 수 있게 합니다.

### 3단계. 운영 자동화와 복구 보강

- 실패 큐 재시도 도구를 추가합니다.
- append 누락 여부를 local JSON과 Sheets 간에 비교하는 점검 스크립트를 추가합니다.
- 오늘의 미션 안내 이력을 `daily_announcements`에 append합니다.
- 운영자용 필터 뷰, 보호 범위, 조건부 서식을 시트에 적용합니다.

### 4단계. 저장소 전환 여부 판단

- Sheets 로그가 충분히 쌓이면 point transaction 원장 기반 복구 절차를 문서화합니다.
- 동시성, 데이터량, 감사 요구가 커지면 Supabase 또는 PostgreSQL로 전환할지 판단합니다.
- DB 전환 시에도 Sheets는 운영자 확인용 read model 또는 export 대상으로 남길 수 있습니다.

## 16. `data/*.local.json`을 당장 제거하지 않는 이유

- 현재 봇 기능은 local JSON repository helper를 기준으로 이미 동작합니다.
- `/포인트로그`, `/운영현황`, `/admin`, `/운영내보내기`가 local JSON 상태를 읽습니다.
- Sheets append를 먼저 도입하면 운영 데이터 보존성을 보강하면서 기존 기능 회귀 위험을 낮출 수 있습니다.
- Google Sheets는 1단계에서 원자적 DB가 아니라 보조 로그이므로, 즉시 주 저장소로 쓰면 중복 지급과 잔액 계산의 책임 경계가 불명확해집니다.
- 운영자가 실제 Sheets 확인 흐름을 써본 뒤 필요한 컬럼과 필터를 조정할 수 있습니다.

## 17. 향후 Supabase 또는 PostgreSQL 전환 시 고려사항

DB 전환 시에는 다음 기준을 먼저 정합니다.

- `point_transactions.transaction_id` 또는 DB primary key의 유일성
- 오늘의 미션 중복 지급 키의 unique constraint
- 포인트 잔액을 거래 로그 합산으로 계산할지, 별도 balance 테이블과 트랜잭션으로 관리할지
- submission, review, redemption 이벤트의 감사 로그 보존 기간
- Discord 원본 메시지와 첨부 URL 보관 정책
- 관리자 대시보드가 읽기 전용을 유지할지, 쓰기 기능을 가질지
- local JSON과 Sheets에서 DB로 이관하는 migration/reconciliation 절차

Supabase/PostgreSQL로 전환하더라도 append-only `point_transactions` 원칙은 유지합니다. DB가 주 저장소가 되면 Sheets는 운영자가 보기 쉬운 read-only export 또는 BI용 뷰로 낮추는 것이 안전합니다.

## 18. 결정 요약

- 1단계 저장 기준: 기존 local JSON 유지
- 1단계 Sheets 범위: `point_transactions`, `mission_submissions` append-only 적재
- 추천 연동 방식: Apps Script Web App
- 포인트 신뢰 기준: `point_transactions` append-only 원장
- 참여자 잔액: `participants.total_points`는 요약값, 원장 합산으로 검증
- 오늘의 미션 중복 지급 기준: KST 날짜와 사용자 ID 기반 dedup key
- 실패 전략: Discord 처리 성공 유지, Sheets 실패 큐와 운영 로그 알림
