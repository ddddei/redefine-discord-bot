# Codex 작업 지시서

## 작업 이름

운영 데이터 백업 및 내보내기 MVP v1

## 목표

프로젝트 리디파인 디스코드 봇의 여정 포인트 운영 데이터를 운영자가 디스코드 안에서 확인하고 백업할 수 있도록 내보내기 기능을 추가한다.

현재 봇에는 참여자 기능과 운영자 기능이 대부분 구현되어 있다.

현재 참여자 기능:

* /포인트
* /상점
* /교환
* /체크인
* /미션
* /인증

현재 운영자 기능:

* /포인트관리
* /교환관리
* /포인트로그
* /인증관리
* /운영현황
* /미션관리
* /상점관리

이번 작업에서는 운영자 전용 내보내기 명령어를 추가한다.

추가할 명령어:

* /운영내보내기

이번 작업의 목적은 local JSON 기반 MVP 운영에서 데이터 유실 위험을 줄이고, 추후 Google Sheets 또는 PostgreSQL 연동 전 데이터 구조와 출력 형식을 정리하는 것이다.

이번 작업에서는 Google Sheets 연동, PostgreSQL 연동, 웹 대시보드, 자동 정산 페이지는 구현하지 않는다.

## 현재 전제

현재 프로젝트에는 아래 구조가 있다.

* src/pointsStore.js
* src/pointsRepository.js
* src/handlers.js
* src/embeds.js
* src/logging.js
* scripts/test-points-store.js
* scripts/test-points-repository.js
* scripts/test-point-activity-flow.js
* scripts/test-admin-management-flow.js
* data/points.example.json
* data/shop-items.example.json
* data/redemptions.example.json
* data/missions.example.json
* data/submissions.example.json
* docs/journey-point-system-plan.md
* docs/point-data-structure-plan.md
* docs/operation-guide.md

현재 실제 운영 데이터는 data/*.local.json 형태로 저장될 수 있다.

data/*.local.json은 커밋하지 않는다.

## 중요 운영 정책

### 내보내기 명령어의 목적

/운영내보내기는 운영자가 아래 데이터를 확인하고 백업하기 위한 명령어다.

* 포인트 거래 로그
* 교환 신청 내역
* 인증 제출 내역
* 미션 설정
* 상점 설정
* 운영 전체 요약

### 권한

/운영내보내기는 운영자 전용 명령어다.

ManageMessages 권한 또는 Administrator 권한이 있는 사용자만 사용할 수 있어야 한다.

일반 참여자가 실행하면 “운영진 전용 명령어예요.” 정도로 ephemeral 안내한다.

### 응답 공개 범위

/운영내보내기 응답은 반드시 ephemeral로 한다.

운영 데이터에는 사용자 ID, 닉네임, 제출 내용, 포인트 기록이 포함될 수 있으므로 공개 채널에 노출하지 않는다.

### 개인정보 최소화

내보내기 데이터는 운영 확인에 필요한 최소 정보만 포함한다.

가능하면 displayName, userId, submission content 등은 필요한 범위에서만 출력한다.

사용자 ID는 전체 노출이 꼭 필요하지 않으면 짧게 표시하거나 운영용 식별 정도로만 둔다.

단, 운영자가 실제 지급/정산 확인을 해야 하는 경우에는 userId가 필요할 수 있으므로 JSON 내보내기에는 userId를 포함할 수 있다.

문서에 개인정보 외부 공유 금지와 보관 주의사항을 명시한다.

### 저장소 안정성

현재 local JSON 저장소는 MVP용이다.

Railway 재배포, 재시작, 환경 변경 상황에서 데이터 유지가 불안정할 수 있다.

이번 작업은 장기 저장소 전환 전 임시 백업/내보내기 기능이다.

추후 Google Sheets 또는 PostgreSQL 연동을 검토해야 한다.

## 중요 주의사항

* .env 파일은 수정하지 않는다.
* 실제 토큰, API Key, 실제 채널 ID, 실제 참여자 개인정보는 작성하지 않는다.
* package.json, package-lock.json은 수정하지 않는다.
* Railway, GitHub 설정은 변경하지 않는다.
* npm run deploy는 실행하지 않는다.
* git commit, git push는 하지 않는다.
* data/*.local.json은 커밋하지 않는다.
* Google Sheets 연동은 구현하지 않는다.
* PostgreSQL 연동은 구현하지 않는다.
* 웹 대시보드는 구현하지 않는다.
* 파일 첨부 기능은 discord.js 기본 기능만 사용한다.
* 외부 패키지는 추가하지 않는다.
* Slash Command가 추가되므로 작업 완료 후 사용자가 직접 npm run deploy를 실행해야 한다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

* src/deploy-commands.js
* src/handlers.js
* src/embeds.js
* src/pointsRepository.js
* src/exportUtils.js
* scripts/test-operation-export-flow.js
* scripts/test-points-store.js
* scripts/test-points-repository.js
* scripts/test-point-activity-flow.js
* scripts/test-admin-management-flow.js
* scripts/check-release.js
* docs/journey-point-system-plan.md
* docs/point-data-structure-plan.md
* docs/operation-guide.md
* docs/export-and-backup-guide.md
* prompts/codex/operation-export-mvp-v1.md

.env.example은 이번 작업에서 새 환경변수가 꼭 필요하지 않다면 수정하지 않는다.

## 작업 1. Slash Command 추가

src/deploy-commands.js에 /운영내보내기 명령어를 추가한다.

### /운영내보내기

설명 예시:

운영자가 포인트 운영 데이터를 내보내거나 백업합니다.

옵션:

* 종류: string, required

  * choices:

    * 전체
    * 포인트
    * 교환
    * 인증
    * 미션
    * 상점
    * 요약

* 형식: string, optional

  * choices:

    * 요약
    * JSON
    * CSV
  * 기본값: 요약

* 개수: integer, optional

  * 기본값: 50
  * 최소 1
  * 최대 200

권한:

* 운영자 전용
* ManageMessages 권한 적용
* 응답은 ephemeral

주의:

* Discord 메시지 길이 제한을 고려한다.
* 형식이 JSON 또는 CSV일 경우 가능한 한 파일 첨부를 사용한다.
* 파일 첨부가 어렵거나 데이터가 작으면 코드블록 요약으로 보여줄 수 있다.
* 전체 내보내기는 데이터가 길 수 있으므로 JSON 파일 첨부를 우선한다.

## 작업 2. export utility 추가

src/exportUtils.js 파일을 새로 만든다.

역할:

* repository에서 가져온 데이터를 요약, JSON, CSV 형태로 변환한다.
* Discord 메시지 길이 제한에 맞게 텍스트를 자른다.
* 파일 첨부용 Buffer 또는 문자열을 생성한다.
* 외부 라이브러리를 사용하지 않는다.

필요한 함수 후보:

* truncateForDiscord(text, limit)
* toSafeJson(data)
* toCsv(rows, columns)
* normalizeExportKind(kind)
* normalizeExportFormat(format)
* buildExportFilename(kind, format, now)
* buildSummaryExport(data, options)
* buildJsonExport(data, options)
* buildCsvExport(data, options)
* buildOperationExportPayload(repository, options)

종류 매핑:

* all
* points
* redemptions
* submissions
* missions
* shopItems
* summary

CSV 변환 시 주의:

* 값에 콤마, 줄바꿈, 큰따옴표가 있으면 CSV escape 처리한다.
* 배열이나 객체는 짧은 JSON 문자열로 변환한다.
* 개인정보가 포함될 수 있으므로 문서에 보관 주의사항을 남긴다.

## 작업 3. repository 조회 함수 보강

src/pointsRepository.js에 필요한 조회 함수를 보강한다.

이미 있는 함수가 있으면 재사용한다.

추가 또는 보강할 함수 후보:

* getExportData(kind, limit)
* getAllOperationData(limit)
* getPointsExportData(limit)
* getRedemptionsExportData(limit)
* getSubmissionsExportData(limit)
* getMissionsExportData(limit)
* getShopItemsExportData(limit)
* getSummaryExportData()

각 함수는 local JSON 저장소에서 데이터를 읽어 반환한다.

주의:

* 데이터 파일이 없을 경우 example 또는 빈 구조를 기준으로 안전하게 반환한다.
* 파일이 없어도 봇이 죽지 않게 한다.
* 실제 운영 데이터 파일을 새로 생성하는 동작은 필요한 경우에만 수행한다.
* 조회 함수는 가능한 한 원본 데이터를 직접 mutate하지 않는다.

## 작업 4. /운영내보내기 구현

src/handlers.js에 /운영내보내기 처리 함수를 추가한다.

운영자 전용이다.

흐름:

1. 운영자 권한을 확인한다.
2. 종류 옵션을 읽는다.
3. 형식 옵션을 읽는다.
4. 개수 옵션을 읽는다.
5. repository에서 데이터를 조회한다.
6. exportUtils로 출력 데이터를 만든다.
7. 요약 형식이면 embed 또는 코드블록 텍스트로 ephemeral 응답한다.
8. JSON 또는 CSV 형식이면 파일 첨부를 우선한다.
9. 파일 첨부가 실패하면 잘린 텍스트 요약과 오류 안내를 보여준다.

응답 예시:

제목: 운영 데이터 내보내기

내용:

* 종류: 포인트
* 형식: CSV
* 포함 개수: 50
* 생성 시간
* 파일을 안전한 위치에 보관해 주세요.
* 외부 공유 시 개인정보 포함 여부를 반드시 확인해 주세요.

주의:

* 응답은 반드시 ephemeral.
* 민감정보가 포함될 수 있으므로 공개 채널에 노출하지 않는다.
* 사용자에게 보낼 용도의 파일이 아니라 운영자 백업용임을 안내한다.
* Discord AttachmentBuilder를 사용할 수 있다면 사용한다.
* discord.js v14 방식에 맞게 구현한다.

## 작업 5. Embed 보강

필요하다면 src/embeds.js에 아래 helper를 추가한다.

* createOperationExportSummaryEmbed
* createOperationExportResultEmbed

기존 embed 톤과 색상을 유지한다.

Embed 제한을 고려한다.

## 작업 6. 테스트 스크립트 추가

scripts/test-operation-export-flow.js 파일을 새로 만든다.

역할:

* 임시 디렉터리에서 export utility와 repository 내보내기 흐름을 테스트한다.
* 실제 data/*.local.json은 만들지 않는다.
* os.tmpdir() 아래 테스트용 파일만 사용한다.
* Node 기본 assert만 사용한다.
* 외부 테스트 라이브러리는 추가하지 않는다.

테스트 항목:

* summary export 생성
* points JSON export 생성
* redemptions JSON export 생성
* submissions JSON export 생성
* missions JSON export 생성
* shopItems JSON export 생성
* points CSV export 생성
* redemptions CSV export 생성
* CSV escape 처리
* filename 생성
* Discord 길이 제한 truncation
* 없는 데이터가 있어도 안전하게 동작

성공 시 출력:

operation export flow smoke test passed

## 작업 7. check-release 반영

scripts/check-release.js에 아래 파일 문법 검사 또는 smoke test를 반영한다.

* src/exportUtils.js
* scripts/test-operation-export-flow.js

가능하다면 check-release에서 아래 테스트도 실행하도록 한다.

* node scripts/test-points-store.js
* node scripts/test-points-repository.js
* node scripts/test-point-activity-flow.js
* node scripts/test-admin-management-flow.js
* node scripts/test-operation-export-flow.js

기존 validate:data, test:questions 흐름은 유지한다.

## 작업 8. 문서 보강

아래 문서를 필요한 만큼 보강한다.

### docs/export-and-backup-guide.md 새로 작성

문서 제목:

# 운영 데이터 내보내기 및 백업 가이드

포함 내용:

* /운영내보내기 목적
* 내보낼 수 있는 데이터 종류
* 요약, JSON, CSV 형식 차이
* 개인정보 및 운영 데이터 보관 주의사항
* data/*.local.json은 MVP용이며 커밋하지 않는다는 점
* Railway 재배포/재시작 시 데이터 유지 방식 확인 필요
* 실제 운영 전 Google Sheets 또는 PostgreSQL 검토 필요
* 추천 운영 루틴

  * 행사 전 백업
  * 행사 후 백업
  * 주 1회 백업
  * 교환 처리 전후 백업
* 파일 공유 시 주의사항
* 다음 단계로 Google Sheets 연동을 검토할 수 있다는 점

### docs/operation-guide.md 보강

포함 내용:

* 운영자는 /운영내보내기로 데이터를 확인하고 백업할 수 있음
* 포인트, 교환, 인증, 미션, 상점 데이터를 종류별로 내보낼 수 있음
* 내보낸 파일은 개인정보가 포함될 수 있으므로 외부 공유 주의
* 백업 파일은 안전한 내부 저장소에 보관

### docs/point-data-structure-plan.md 보강

포함 내용:

* 운영 데이터 내보내기 기능 추가
* CSV/JSON export는 Google Sheets 또는 PostgreSQL 연동 전 중간 단계
* local JSON 기반 저장소의 한계
* 장기 운영 전 영속 저장소 검토 필요

### docs/journey-point-system-plan.md 보강

포함 내용:

* 운영 안정화를 위해 내보내기/백업 기능을 우선 구현
* Google Sheets 또는 웹 대시보드는 후속 단계로 검토

## 작업 9. docs/README.md 수정

docs/README.md에 export-and-backup-guide.md 링크를 추가한다.

설명은 다음 취지로 작성한다.

* 운영 데이터 내보내기, 백업, 개인정보 보관 주의사항을 정리한 가이드

## 검증

작업 완료 후 아래 명령어를 실행한다.

* node scripts/test-points-store.js
* node scripts/test-points-repository.js
* node scripts/test-point-activity-flow.js
* node scripts/test-admin-management-flow.js
* node scripts/test-operation-export-flow.js
* npm run validate:data
* npm run test:questions
* npm run check:release

주의:

* npm run deploy는 실행하지 않는다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

* 변경된 파일 목록
* 추가된 Slash Command 목록
* /운영내보내기 동작 요약
* 지원하는 내보내기 종류
* 지원하는 내보내기 형식
* JSON/CSV 파일 첨부 여부
* 운영자 권한 검사 방식
* 개인정보 보관 주의사항
* Google Sheets나 PostgreSQL 연동은 하지 않았다는 점
* 웹 대시보드는 만들지 않았다는 점
* data/*.local.json은 커밋하지 않는다는 점
* node scripts/test-points-store.js 결과
* node scripts/test-points-repository.js 결과
* node scripts/test-point-activity-flow.js 결과
* node scripts/test-admin-management-flow.js 결과
* node scripts/test-operation-export-flow.js 결과
* npm run validate:data 결과
* npm run test:questions 결과
* npm run check:release 결과
* npm run deploy는 실행하지 않았다는 점
* 작업 후 사용자가 직접 npm run deploy를 실행해야 한다는 점
