# 운영 전 데이터 초기화 가이드

실제 참여자 운영 전에 example 데이터와 테스트용 local 데이터를 구분하고, 관리자 대시보드와 Discord 명령어에서 운영 데이터 상태를 확인하는 절차입니다. 실제 사용자 ID, 채널 ID, 개인정보는 이 문서에 적지 않습니다.

## 1. 문서 목적

운영 시작 전에 `/admin`과 `/운영현황`에서 example/demo/sample 데이터가 실제 운영 데이터처럼 보이지 않는지 확인하고, 운영용 미션과 상점 항목을 준비하기 위한 기준을 제공합니다.

## 2. example 데이터와 운영 데이터의 차이

- `data/*.example.json`은 테스트와 샘플 확인을 위한 파일입니다.
- `data/*.example.json`은 삭제하지 않습니다.
- `data/*.local.json`은 실제 운영 또는 로컬 테스트 데이터일 수 있습니다.
- `data/*.local.json`은 커밋하지 않습니다.
- 관리자 대시보드와 `/api/admin/*`는 example-like 데이터를 운영 조회에서 제외합니다.

## 3. 운영 전 확인해야 할 데이터 파일

- `data/points.local.json`
- `data/shop-items.local.json`
- `data/redemptions.local.json`
- `data/missions.local.json`
- `data/submissions.local.json`
- `data/reaction-approvals.local.json`

파일이 없다면 저장소가 `isExample: false`인 빈 운영 구조를 즉시 생성합니다. example 파일은 실제 운영 상태 fallback으로 사용하지 않습니다. 일부 파일만 있어도 없는 파일만 빈 구조로 생성됩니다.

Railway에서는 영속 Volume mount 경로를 `OPERATION_DATA_DIR`로 지정하고 `PRODUCTION_DATA_STRICT=true`를 권장합니다. 기존 파일별 `*_DATA_PATH`가 있으면 공통 경로보다 우선합니다.

## 4. local JSON 파일 주의사항

테스트 중 생성한 local 데이터에 실제 운영 전에 쓰지 않을 사용자, 신청, 제출, 미션, 상점 항목이 남아 있으면 정리합니다. 운영용 데이터만 남기거나, 운영 전 빈 상태로 시작할지 결정합니다.

`data/*.local.json`은 실제 운영 데이터가 될 수 있으므로 Git 커밋 대상에서 제외합니다.

## 5. 관리자 대시보드에서 확인할 것

- `/admin` 접속과 Basic Auth 로그인이 정상인지 확인합니다.
- 상단 안내에 `읽기 전용 · local-json · example 데이터 제외`가 보이는지 확인합니다.
- 교환 대기, 인증 대기, 최근 포인트 로그가 실제 운영 데이터 기준으로 비어 있거나 정상 데이터만 보이는지 확인합니다.
- 관리자 대시보드에 `user_example`, `rd_example`, `submission_example`, `tx_example`, `2030년` 같은 샘플 데이터가 보이면 안 됩니다.
- `/api/admin/summary`의 `exampleRecordsExcluded` 값이 example 데이터 제외 여부를 설명하는지 확인합니다.

## 6. Discord에서 확인할 것

- `/운영현황`이 정상 작동하는지 확인합니다.
- `/안내`가 참여자에게 정상 표시되는지 확인합니다.
- 실제 운영용 미션은 `/미션관리`로 등록합니다.
- 실제 운영용 상점 항목은 `/상점관리`로 등록합니다.
- 미션 인증 채널에서 ✅/❌ 반응 승인을 테스트합니다.
- 교환 신청 알림이 `POINT_REDEEM_CHANNEL_ID` 채널로 전송되는지 확인합니다.

## 7. 운영 전 최소 세팅 순서

1. Railway Variables에 필수 환경변수를 입력합니다.
2. Public Domain을 생성합니다.
3. `/admin` 접속과 Basic Auth를 확인합니다.
4. 로그/알림 채널 권한을 확인합니다.
5. 테스트용 local 데이터가 남아 있는지 확인합니다.
6. 운영용 미션과 상점 항목을 등록합니다.
7. `/운영현황`과 `/admin`을 함께 확인합니다.
8. 운영 데이터 백업 방법을 확인합니다.
9. `node scripts/check-local-operation-data.js`로 example 혼입과 파일 간 참조를 확인합니다.

## 8. 운영 시작 전 체크리스트

- [ ] Railway Variables에 필수 환경변수를 모두 입력했다.
- [ ] Public Domain을 생성했다.
- [ ] `/admin` 접속과 Basic Auth 로그인을 확인했다.
- [ ] 관리자 대시보드에 example 데이터가 보이지 않는다.
- [ ] `/운영현황`이 정상 작동한다.
- [ ] `/안내`가 정상 작동한다.
- [ ] `/미션관리`로 운영용 미션을 등록했다.
- [ ] `/상점관리`로 운영용 상점 항목을 등록했다.
- [ ] 미션 인증 채널에서 ✅/❌ 반응 승인을 테스트했다.
- [ ] 교환 신청 알림 채널을 확인했다.
- [ ] 운영 데이터 백업 방법을 확인했다.

## 9. 운영 중 백업 주의사항

운영 시작 후에는 `/운영내보내기`로 주기적으로 백업합니다. 내보낸 파일에는 사용자 ID, 표시 이름, 인증 내용, 운영 메모가 포함될 수 있으므로 공유 범위와 보관 위치를 제한합니다.

## 10. DM 대화 로그 보존 정리와 삭제 요청 처리

DM 대화 로그(`data/dm-chat-logs.local.json` 또는 `DM_CHAT_LOG_PATH`)는 `scripts/cleanup-dm-chat-logs.js`로만 정리합니다. 로그 파일을 직접 열어 편집하지 않습니다.

- **보존 기간 경과 정리(월 1회 권장)**: `node scripts/cleanup-dm-chat-logs.js`로 dry-run 결과를 먼저 확인한 뒤 `node scripts/cleanup-dm-chat-logs.js --apply`로 적용합니다. `DM_CHAT_RETENTION_DAYS`(기본 90일) 경과 메시지가 제거되며, 안전 감지 레코드는 180일까지 별도로 보존됩니다.
- **참여자 요청 삭제**: `node scripts/cleanup-dm-chat-logs.js --user <discordId> --apply`로 해당 사용자의 메시지·notices·historyResets를 전부 제거합니다. 실행 전 신원(Discord ID)을 확인합니다.
- 두 작업 모두 적용 전 `dm-chat-logs.backup-<타임스탬프>.json` 사본을 자동 생성합니다. 이 백업 사본에는 정리 전 데이터가 남아 있으므로, 삭제 요청 회신 시 "완전 삭제는 아니며 백업 사본은 별도 보관 규정에 따른다"는 점을 정직하게 안내합니다.
- 상세 운영 절차와 SOP는 `docs/dm-chat-operation-guide.md`의 "삭제 요청 처리"·"보존 정리 루틴" 절을 따릅니다.
