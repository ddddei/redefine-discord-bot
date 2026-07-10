# 운영 데이터 안전화 v1 계획서 — 빈 환경 초기화·Railway 영속 경로·백업 완결성

**상태: 구현 완료·실환경 QA 대기. 코드 검증은 완료했으며 Railway Volume 재배포·복원 리허설은 운영자 확인이 필요합니다.**

구현 결과:

- [x] 빈 환경에서 example 없는 포인트·상점·교환·미션·인증 구조 생성
- [x] `OPERATION_DATA_DIR`과 기존 개별 경로 우선순위 유지
- [x] strict 시작 preflight와 비strict 경고
- [x] 포인트·상점·교환 그룹 저장 rollback 안전망
- [x] schema v2 백업 manifest와 웹게임 필수 데이터 포함
- [x] 복원 구버전 호환과 무결성 교차 참조 점검
- [x] 빈 환경·부분 파일·경로·실패 주입·백업 회귀 테스트를 릴리즈 게이트에 포함
- [ ] Railway Volume 재배포 전후 보존 및 실제 Discord 리허설

현재 봇은 포인트·교환·미션·DM·웹게임 등 운영 기능이 충분히 구현되어 있지만, 실제 운영 데이터는 `*.local.json`에 저장됩니다. 이 계획은 기능을 늘리는 작업이 아니라, 완전히 새로 배포된 환경과 Railway 재배포 상황에서도 예시 데이터가 운영에 섞이지 않고 운영 기록을 복구할 수 있도록 만드는 선행 안정화 작업입니다.

이 작업은 [DM 실운영 준비 v1 계획서](dm-live-operation-readiness-v1-plan.md)의 필수 선행조건입니다. 참여자 DM을 열기 전에 최소한 1~4절이 완료되어야 합니다.

## 0. 조사에서 확인된 문제

### 0.1 빈 환경의 example fallback

`points.local.json`, `shop-items.local.json`, `redemptions.local.json`이 없는 새 환경에서 `pointsRepository`는 대응하는 `*.example.json`을 읽습니다. 이 상태에서는 다음 문제가 발생할 수 있습니다.

- 참여자 `/상점`에 example의 active 상품이 표시됨
- 첫 포인트 변경 시 example 사용자·거래가 실제 `points.local.json`에 함께 저장됨
- example 교환 신청·상점 항목이 local 파일로 복제됨
- 생성된 local 파일에 `isExample: true`가 남음

관리자 대시보드에서 example-like 레코드를 숨기는 기능은 이미 있지만, 이는 표시 단계 방어이며 저장소 초기화 문제를 해결하지 않습니다.

### 0.2 Railway 데이터 경로

기본 저장 위치는 저장소 내부 `data/*.local.json`입니다. Railway Volume 또는 외부 영속 저장소가 연결되지 않은 경우 재배포·인스턴스 교체 시 데이터가 사라질 수 있습니다. 현재는 파일별 `*_DATA_PATH` 환경변수가 흩어져 있고, 하나의 운영 데이터 루트 경로를 지정하는 방식이 없습니다.

### 0.3 백업 범위 누락

자동 운영 백업은 포인트·상점·교환·미션·인증·DM·던전월드 등을 포함하지만, 웹게임 계정 연결·점수·소셜·리플레이 진단 파일은 현재 기본 스냅샷에 포함되지 않습니다. 따라서 자동 백업이 성공해도 웹게임 랭킹과 연결 정보는 복구되지 않을 수 있습니다.

### 0.4 파일 간 부분 저장

교환 신청처럼 포인트·상점·교환 파일을 함께 변경하는 작업은 각 파일을 원자적으로 저장하지만 세 파일 전체가 하나의 트랜잭션은 아닙니다. 중간 저장 실패 시 파일 간 상태가 달라질 수 있습니다. v1에서는 감지·복구 안전망을 추가하고, 저장소 전체 DB 전환은 별도 v2로 둡니다.

## 1. 목표와 완료 정의

다음 조건을 모두 만족하면 v1을 완료로 판단합니다.

1. local 파일이 하나도 없는 상태에서 참여자 명령을 실행해도 example 사용자·상품·교환이 노출되지 않는다.
2. 첫 실제 쓰기가 일어나도 생성된 모든 local 파일은 `isExample: false`이고 빈 운영 구조에서 시작한다.
3. Railway Volume 등 하나의 영속 디렉터리를 `OPERATION_DATA_DIR`로 지정할 수 있다.
4. 개별 `*_DATA_PATH`를 명시한 기존 환경은 하위 호환된다.
5. 운영 시작 모드에서는 영속 경로·쓰기 권한·example 혼입·필수 파일 구조를 시작 시 점검한다.
6. 자동 백업에 운영 필수 local 데이터가 빠짐없이 포함되고 복원 dry-run이 통과한다.
7. 포인트·교환·재고의 부분 저장 이상을 로컬 데이터 점검기가 발견한다.
8. 완전히 빈 디렉터리, 기존 정상 데이터, example 혼입 데이터, 읽기 전용 경로에 대한 테스트가 릴리즈 게이트에 포함된다.
9. 실제 Railway 재배포 전후 데이터 유지와 백업 복원은 수동 QA 항목으로 보고된다.

## 2. 작업 A — example과 운영 데이터의 완전 분리

### 2.1 초기 데이터 팩토리

`pointsRepository`에 다음 빈 운영 구조를 만드는 명시적 팩토리를 둡니다.

- points: 빈 `users`, 빈 `pointTransactions`
- shopItems: 빈 `shopItems`
- redemptions: 빈 `redemptions`
- missions: 빈 `missions`와 필요한 게시 상태 배열
- missionTemplates: 운영 정책상 example 템플릿을 읽기 전용 후보로 사용할지 별도 결정
- submissions: 빈 `submissions`
- reactionApprovals/operatorSupport: 기존 빈 구조 유지

운영 상태 읽기와 문서용 example 읽기를 분리합니다. `*.example.json`은 테스트·설명·템플릿 미리보기에서만 사용하고, 참여자·운영자 실제 상태의 fallback으로 사용하지 않습니다.

### 2.2 첫 읽기 동작

- local 파일이 없으면 메모리에서만 example을 반환하지 않고 즉시 빈 local 구조를 생성합니다.
- 생성 파일은 `isExample: false`를 강제합니다.
- 상점·포인트·교환 세 파일 중 일부만 존재하면, 없는 파일만 빈 구조로 생성합니다.
- 기존 정상 local 파일은 마이그레이션 없이 그대로 읽습니다.
- 기존 local 파일에 `isExample: true` 또는 example-like 레코드가 있으면 자동 삭제하지 않고 운영 시작을 차단하거나 명시적 경고를 냅니다.

### 2.3 mission template 결정

미션 템플릿 example은 운영자가 복사해 쓰는 후보 데이터로 의도된 부분이 있으므로 다음 중 하나를 구현 전 확정합니다.

- **제안 기본값:** example 템플릿은 운영자 미리보기에서만 표시하고 실제 active 미션으로 자동 전환하지 않는다.
- 대안: 별도의 커밋 가능한 `mission-templates.defaults.json`을 만들고 example과 운영 기본값을 구분한다.

## 3. 작업 B — 영속 데이터 루트 경로

### 3.1 `OPERATION_DATA_DIR`

신규 환경변수 `OPERATION_DATA_DIR`을 추가합니다.

경로 우선순위는 다음과 같습니다.

1. 파일별 환경변수(`POINTS_DATA_PATH`, `DM_CHAT_LOG_PATH` 등)
2. `OPERATION_DATA_DIR/<기본 파일명>`
3. 저장소 내부 `data/<기본 파일명>`

파일별 환경변수를 사용 중인 기존 배포는 동작이 바뀌지 않아야 합니다.

### 3.2 공통 경로 해석기

`src/operationDataPaths.js`와 같은 단일 모듈에서 포인트·미션·DM·던전월드·웹게임·백업 상태 경로를 계산합니다. 각 저장소가 독자적으로 `path.join(__dirname, '..', 'data')`를 반복하지 않도록 하되, 이번 작업에서 비즈니스 로직은 변경하지 않습니다.

### 3.3 시작 전 점검

운영 모드에서 다음을 확인합니다.

- 데이터 디렉터리 존재/생성 가능
- 임시 파일 쓰기와 rename 가능
- local 파일 JSON 파싱 가능
- local 파일에 `isExample: true` 없음
- example-like 사용자·거래·교환·상점 혼입 없음
- DM 로그 경로와 백업 경로가 같은 영속 루트 정책을 따름

권장 환경변수 `PRODUCTION_DATA_STRICT=true`를 두어 strict 모드에서는 치명 항목이 있으면 봇 로그인을 시작하지 않습니다. 기본값은 기존 배포 호환을 위해 `false`로 두되, Railway 운영 가이드는 `true`를 권장합니다.

## 4. 작업 C — 자동 백업 범위 완결

### 4.1 백업 manifest

백업 스냅샷에 `schemaVersion`과 파일별 manifest를 추가합니다.

필수 대상:

- points, shopItems, redemptions
- missions, missionTemplates, submissions
- reactionApprovals, operatorSupport
- dailyMissionAnnouncements
- dmChatLogs
- dungeonworldLogs, dungeonworldConfig
- webgameLinks, webgameScores, webgameSocial
- webgameReplayMismatch는 개인정보·행동 로그 성격을 고려해 기본 제외 또는 별도 암호화 보관 여부 결정

`webgameReplayMismatch`는 현재 문서상 백업 제외 방침이므로, **제안 기본값은 제외 유지**하고 manifest에 `excludedByPolicy`로 기록합니다.

### 4.2 백업 성공 기준

- 필수 파일이 없으면 `null`만 넣지 않고 `missingFiles`에 명시합니다.
- strict 운영 모드에서 핵심 파일 누락이 있으면 성공으로 기록하지 않습니다.
- 업로드 성공 후 파일명, 크기, 포함/제외 파일 수를 백업 상태에 남깁니다.
- Discord 첨부 한도 초과 시 운영자에게 범위 분할 또는 외부 보관 필요를 안내합니다.

### 4.3 복원 검증

복원 스크립트는 다음을 지원합니다.

- 기본 dry-run
- schemaVersion 호환 확인
- 덮어쓸 파일 목록과 누락 파일 표시
- 복원 후 `check-local-operation-data` 자동 안내
- 운영 중인 봇에 덮어쓰지 않도록 중지 확인 문구

## 5. 작업 D — 부분 저장 감지와 사고 복구

v1에서는 저장 구조 전체를 DB로 바꾸지 않고 다음 안전망을 추가합니다.

1. 포인트 거래의 마지막 `balanceAfter`와 사용자 잔액 일치 확인
2. 교환 차감 거래와 redemption의 상호 참조 확인
3. 환불 거래와 redemption 상태 일치 확인
4. 재고 감소가 있는 교환 신청의 참조 확인
5. 인증 승인 거래와 submission/reactionApproval 참조 확인
6. 이상 발견 시 자동 수정하지 않고 파일·레코드 ID와 복구 절차를 보고

복수 파일 저장 전에는 변경 전 상태를 작은 recovery snapshot으로 남기고, 전 파일 저장 성공 후 정리하는 방식을 검토합니다. 구체 구현은 테스트로 실패 주입이 가능한 가장 단순한 방법을 선택합니다.

## 6. 작업 E — 운영 도구와 문서

- `.env.example`: `OPERATION_DATA_DIR`, `PRODUCTION_DATA_STRICT`와 누락된 파일별 path 변수 정리
- `railway-env-guide.md`: Volume mount 경로를 확인하고 `OPERATION_DATA_DIR`을 설정하는 절차
- `production-data-reset-guide.md`: “example fallback으로 안전하게 시작” 문구 제거, 빈 구조 생성 기준 반영
- `export-and-backup-guide.md`: 실제 자동 백업 포함/제외 범위 명시
- `prelaunch-qa-checklist.md`: 재배포 전후 checksum/건수 비교 추가
- `/운영현황` 환경 점검: 실제 비밀값은 노출하지 않고 경로 유형, 쓰기 가능, strict 상태만 표시

실제 Railway 프로젝트 설정 변경은 코드 머지와 별도 운영 작업입니다. 계획 구현 에이전트는 실제 Variables·Volume·서비스 상태를 임의로 변경하지 않습니다.

## 7. 수정 예상 파일

핵심 후보:

- `src/pointsRepository.js`
- `src/pointsStore.js`
- `src/operationBackup.js`
- `src/dmChatRepository.js`
- `src/dungeonworld.js`
- `src/webgameRepository.js`
- `src/dailyMissionAnnouncement.js`
- 신규 공통 경로 모듈
- `scripts/check-local-operation-data.js`
- `scripts/restore-operation-backup.js`
- 관련 테스트·문서·`.env.example`

`public/` 게임 로직과 참여자 콘텐츠 JSON은 이번 범위에서 수정하지 않습니다.

## 8. 테스트 계획

신규 또는 확장 테스트:

1. 완전 빈 디렉터리에서 초기화 후 모든 local 파일 `isExample: false`
2. 빈 환경 `/상점` 결과 0건
3. 첫 포인트 지급 후 example ID·2030년 데이터가 저장되지 않음
4. 일부 local 파일만 있는 상태에서 나머지 빈 구조 생성
5. `OPERATION_DATA_DIR` 적용과 개별 path 우선순위
6. 쓰기 불가 경로에서 strict 시작 실패
7. example 혼입 local 파일 strict 시작 실패
8. 웹게임 데이터 포함 백업과 정책상 제외 manifest
9. 구버전 백업 복원 dry-run 호환
10. 포인트·교환·환불 참조 불일치 감지
11. 저장 실패 주입 시 recovery 정보 생성

완료 검증:

```bash
npm run check:release
npm run check:local-data
git diff --check
```

## 9. 수동 QA

1. Railway 테스트 환경에 Volume을 연결하고 `OPERATION_DATA_DIR` 설정
2. 완전히 빈 Volume에서 봇 부팅
3. `/상점`이 빈 상태를 안내하는지 확인
4. 테스트 포인트 지급→교환 신청→취소→환불 진행
5. DM 1회와 웹게임 연결·점수 1회 생성
6. 자동 백업 실행 및 포함 파일 확인
7. 재배포 후 각 데이터 건수 유지 확인
8. 별도 디렉터리에 복원 dry-run·apply 후 건수 재확인

실제 Discord·Railway 확인을 수행하지 못한 경우 최종 보고서에 `확인 대기`로 남기며 통과로 간주하지 않습니다.

## 10. 커밋·배포·롤백

권장 커밋 구분:

1. 빈 운영 데이터 초기화와 example 분리
2. 공통 영속 경로
3. 백업·복원 manifest 확장
4. 무결성 점검과 recovery 안전망
5. 테스트
6. 환경변수·운영 문서

- Slash Command 구조 변경이 없으면 `npm run deploy`는 불필요합니다.
- Railway에는 신규 env 설정 후 재배포가 필요합니다.
- 롤백 전 반드시 현재 Volume과 최신 자동 백업을 보존합니다.
- 이전 코드로 롤백해도 개별 path 변수는 계속 사용할 수 있도록 하위 호환을 유지합니다.

## 11. 범위 밖 후속

- PostgreSQL/SQLite 전환
- 다중 인스턴스 동시 쓰기
- 백업 외부 오브젝트 스토리지 자동 업로드
- 저장 데이터 암호화와 키 회전
- 관리자 웹에서 데이터 직접 수정

위 항목은 장기 운영 규모와 실제 장애 데이터를 확인한 뒤 v2에서 설계합니다.
